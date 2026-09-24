// Real sessions and an isolated migrated database; no email is sent.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256, hashPassword } = require('../dist/utils/security');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
const base = process.env.STATUS_API_URL || 'http://127.0.0.1:5007/api/v1';
const site = process.env.STATUS_WEB_URL || 'http://127.0.0.1:5179';
const output = process.env.STATUS_SCREENSHOT_DIR || '/private/tmp/ifsmhp-member-status-browser';
const prefix = 'status-browser-' + crypto.randomUUID().slice(0, 8);
const users = [], checks = [], errors = [];
let browser, page, admin, second, member, community, targetId;
async function account(role, name) {
  const password = 'StatusVerification!2026';
  const user = await prisma.user.create({ data: { email: `${prefix}-${name.toLowerCase()}@example.test`, fullName: name, role, status: 'ACTIVE', passwordHash: role === 'ADMIN' ? await hashPassword(password) : null } }); users.push(user);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let response;
  if (role === 'ADMIN') response = await context.request.post(base + '/auth/login', { data: { email: user.email, password } });
  else { const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0'); await prisma.emailOtp.create({ data: { email: user.email, purpose: 'LOGIN', codeHash: sha256(`LOGIN:${user.email}:${code}`), expiresAt: new Date(Date.now() + 300000) } }); response = await context.request.post(base + '/auth/otp/verify', { data: { email: user.email, purpose: 'LOGIN', code } }); }
  assert.equal(response.status(), 200, await response.text()); const token = (await response.json()).data.accessToken;
  await context.addInitScript(({ token, site }) => { if (window.top === window && location.origin === site) localStorage.setItem('ifsmhp.accessToken', token); }, { token, site });
  return { user, context, token };
}
const row = () => page.getByRole('row').filter({ hasText: member.user.email });
const dialog = () => page.getByRole('dialog');
const api = (actor, method, url, data) => actor.context.request[method](base + url, { headers: { Authorization: `Bearer ${actor.token}` }, ...(data ? { data } : {}) });
const mutationUrl = () => `/admin/community/members/${targetId}/status`;
async function rawChange(status, expectedStatus, reason) { const response = await api(second, 'patch', mutationUrl(), { status, expectedStatus, reason }); assert.equal(response.status(), 200, await response.text()); }
async function ready(status, actions) {
  // Search debounce can replace the row between separate assertions. Check the
  // status and the complete action set together in one DOM snapshot.
  await page.waitForFunction(({ email, status, actions }) => {
    const tr = [...document.querySelectorAll('tbody tr')].find(row => row.textContent.includes(email));
    if (!tr || tr.querySelectorAll('td')[2]?.textContent.trim() !== status) return false;
    const actual = [...tr.querySelectorAll('button')].map(button => button.getAttribute('aria-label')).filter(label => ['Block', 'Unblock', 'Suspend', 'Unsuspend'].includes(label)).sort();
    return JSON.stringify(actual) === JSON.stringify([...actions].sort());
  }, { email: member.user.email, status, actions });
  assert.equal((await prisma.communityMembership.findUniqueOrThrow({ where: { id: targetId } })).status, status);
}
async function open(action, note) { await row().getByRole('button', { name: action, exact: true }).click(); await dialog().waitFor(); if (note !== undefined) await dialog().getByLabel(/^Reason/).fill(note); }
async function confirm(action, status = 200) {
  const response = page.waitForResponse(r => r.url().endsWith(mutationUrl()) && r.request().method() === 'PATCH');
  await dialog().getByRole('button', { name: action, exact: true }).click(); assert.equal((await response).status(), status);
  if (status === 200) await dialog().waitFor({ state: 'hidden' });
}
async function shot(name) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': page overflow'); await page.screenshot({ path: path.join(output, name + '.png') }); }
async function run() {
  await fs.mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  admin = await account('ADMIN', 'DirectoryReviewer'); second = await account('ADMIN', 'SecondReviewer'); member = await account('MEMBER', 'RecoveryMember');
  const created = await api(admin, 'post', '/admin/community/communities', { name: 'Recovery Verification', slug: prefix, category: 'Research', description: 'Member recovery browser tests', visibility: 'PUBLIC', status: 'ACTIVE' }); assert.equal(created.status(), 201); community = (await created.json()).data;
  const joined = await api(member, 'post', `/community/communities/${community.id}/join`); assert.equal(joined.status(), 200);
  targetId = (await prisma.communityMembership.findUniqueOrThrow({ where: { communityId_userId: { communityId: community.id, userId: member.user.id } } })).id;
  const original = await prisma.communityMembership.findUniqueOrThrow({ where: { id: targetId } });
  page = await admin.context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(site + '/admin/community/members'); await page.getByLabel('Search members').fill(member.user.email); await ready('ACTIVE', ['Block', 'Suspend']);
  await open('Block'); assert.equal(await dialog().getByRole('button', { name: 'Block', exact: true }).isDisabled(), true);
  await dialog().getByLabel(/^Reason/).fill('Cancel this decision'); await dialog().getByRole('button', { name: 'Cancel', exact: true }).click(); await ready('ACTIVE', ['Block', 'Suspend']);
  await open('Block', 'Preserve this block reason');
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Preserve this block reason');
  await page.route('**' + mutationUrl(), route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary test failure. Retry.', errors: [] }) }));
  await confirm('Block', 503); await dialog().getByRole('alert').getByText('Temporary test failure. Retry.').waitFor();
  assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Preserve this block reason'); await page.unroute('**' + mutationUrl());
  let releaseSave, signalSave; const saveReached = new Promise(resolve => signalSave = resolve);
  await page.route('**' + mutationUrl(), async route => { const response = await route.fetch(); signalSave(); await new Promise(resolve => releaseSave = resolve); await route.fulfill({ response }); });
  const saving = confirm('Block'); await saveReached;
  assert.equal(await dialog().getByRole('button', { name: 'Saving…', exact: true }).isDisabled(), true);
  assert.equal(await dialog().getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
  releaseSave(); await saving; await page.unroute('**' + mutationUrl());
  await ready('BLOCKED', ['Unblock']); await page.reload(); await page.getByLabel('Search members').fill(member.user.email); await ready('BLOCKED', ['Unblock']);
  await row().getByRole('button', { name: 'View details', exact: true }).click(); await dialog().getByText('BLOCKED', { exact: true }).waitFor(); await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await open('Unblock'); await shot('member-status-unblock-desktop'); await confirm('Unblock'); await ready('ACTIVE', ['Block', 'Suspend']);
  await page.reload(); await page.getByLabel('Search members').fill(member.user.email); await ready('ACTIVE', ['Block', 'Suspend']);
  assert.equal((await prisma.communityMembership.findUniqueOrThrow({ where: { id: targetId } })).reason, null);
  checks.push('Block/Unblock cycle, cancellation, required restriction reason, optional restoration note, details and reload persistence');
  checks.push('Failed requests and focus refresh preserve the confirmation and entered reason; retry succeeds and duplicate submissions are disabled');
  await page.setViewportSize({ width: 390, height: 844 }); await open('Suspend', 'Temporary restriction'); await shot('member-status-suspend-mobile'); await confirm('Suspend'); await ready('SUSPENDED', ['Unsuspend']);
  await page.reload(); await page.getByLabel('Search members').fill(member.user.email); await ready('SUSPENDED', ['Unsuspend']);
  await open('Unsuspend', 'Reviewed on mobile'); await shot('member-status-unsuspend-mobile'); await confirm('Unsuspend'); await ready('ACTIVE', ['Block', 'Suspend']);
  await page.reload(); await page.getByLabel('Search members').fill(member.user.email); await ready('ACTIVE', ['Block', 'Suspend']);
  const restored = await prisma.communityMembership.findUniqueOrThrow({ where: { id: targetId } }); assert.equal(+restored.joinedAt, +original.joinedAt); assert.equal(restored.role, original.role); assert.equal(restored.reason, 'Reviewed on mobile');
  checks.push('Mobile Suspend/Unsuspend cycle survives reload, retains role/join date, and saves an optional restoration note');
  await page.setViewportSize({ width: 1440, height: 1000 }); await open('Suspend', 'Concurrent decision fixture'); await confirm('Suspend'); await ready('SUSPENDED', ['Unsuspend']);
  await open('Unsuspend', 'Keep this restoration note'); await rawChange('ACTIVE', 'SUSPENDED'); await rawChange('BLOCKED', 'ACTIVE', 'Second reviewer blocked');
  await confirm('Unsuspend', 409); await dialog().getByText('Current status: BLOCKED.', { exact: false }).waitFor();
  assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Keep this restoration note'); assert.equal(await dialog().getByRole('button', { name: 'Unsuspend', exact: true }).isDisabled(), true);
  await shot('member-status-conflict-desktop'); await dialog().getByRole('button', { name: 'Review Unblock', exact: true }).click();
  await page.getByRole('dialog', { name: 'Unblock member?' }).waitFor(); assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Keep this restoration note'); await confirm('Unblock'); await ready('ACTIVE', ['Block', 'Suspend']);
  checks.push('Concurrent reviewer conflict preserves notes and requires explicit review of Unblock; stale Unsuspend cannot lift a block');
  let release, signal, held = false; const reached = new Promise(resolve => signal = resolve);
  const listPattern = '**/admin/community/members?*';
  await page.route(listPattern, async route => { if (held) return route.continue(); held = true; const response = await route.fetch(); signal(); await new Promise(resolve => release = resolve); await route.fulfill({ response }); });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await reached;
  await open('Block', 'Stale poll fixture'); await confirm('Block'); await ready('BLOCKED', ['Unblock']); release(); await page.unrouteAll({ behavior: 'wait' });
  await ready('BLOCKED', ['Unblock']); checks.push('A list response started before the mutation cannot restore outdated actions');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('BLOCKED'); await ready('BLOCKED', ['Unblock']); await open('Unblock'); await confirm('Unblock');
  await page.getByText('No members found', { exact: true }).waitFor(); assert.equal(await page.getByRole('combobox', { name: 'Status', exact: true }).inputValue(), 'BLOCKED');
  checks.push('Restoration removes a row from the Blocked filter without clearing selected filters');
  for (let i = 0; i < 10; i++) { const user = await prisma.user.create({ data: { email: `${prefix}-${i}@example.test`, fullName: `Other member ${i}`, role: 'MEMBER', status: 'ACTIVE' } }); users.push(user); await prisma.communityMembership.create({ data: { communityId: community.id, userId: user.id, status: 'ACTIVE', requestedAt: new Date() } }); }
  await prisma.communityMembership.update({ where: { id: targetId }, data: { requestedAt: new Date('2000-01-01') } });
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click(); await page.getByRole('combobox', { name: 'Community', exact: true }).selectOption(community.id); await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('MEMBER'); await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ACTIVE');
  await page.getByText('Page 1 of 2', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Next page', exact: true }).click(); await ready('ACTIVE', ['Block', 'Suspend']);
  await open('Block', 'Pagination fixture'); await confirm('Block'); await page.getByText('Page 1 of 1', { exact: true }).waitFor(); await page.getByText('10 results', { exact: true }).waitFor();
  checks.push('Removing the last matching row on page two refreshes counts and clamps the page');
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click(); await page.getByLabel('Search members').fill(member.user.email); await ready('BLOCKED', ['Unblock']); await open('Unblock');
  await prisma.session.updateMany({ where: { userId: admin.user.id }, data: { revokedAt: new Date() } });
  await confirm('Unblock', 401); await dialog().waitFor({ state: 'hidden' }); await row().waitFor({ state: 'hidden' });
  assert.equal((await prisma.communityMembership.findUniqueOrThrow({ where: { id: targetId } })).status, 'BLOCKED');
  checks.push('Revoked sessions close the confirmation, clear protected directory data and cannot restore membership');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (community) await prisma.community.delete({ where: { id: community.id } });
  const ids = users.map(u => u.id); await prisma.emailOtp.deleteMany({ where: { email: { in: users.map(u => u.email) } } }); await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
});
