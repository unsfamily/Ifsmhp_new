// Real sessions/cookies against isolated MySQL. Only transport failures are simulated.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { env } = require('../dist/config/env');
const { hashPassword } = require('../dist/utils/security');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
const api = process.env.STATUS_API_URL || 'http://127.0.0.1:5007/api/v1';
const site = process.env.STATUS_WEB_URL || 'http://127.0.0.1:5179';
const output = process.env.SESSION_SCREENSHOT_DIR || '/private/tmp/ifsmhp-community-session-browser';
const prefix = 'session-browser-' + crypto.randomUUID().slice(0, 8);
const users = [], checks = [], errors = [];
let browser, page, context, community, membership, token, refreshes = 0;
const expired = value => { const { sub, sessionId, role } = jwt.decode(value); return jwt.sign({ sub, sessionId, role }, env.JWT_ACCESS_SECRET, { expiresIn: -5, issuer: 'ifsmhp-api', audience: 'ifsmhp-client' }); };
async function install(value) {
  await page.evaluate(value => { const oldValue = localStorage.getItem('ifsmhp.accessToken'); if (value) localStorage.setItem('ifsmhp.accessToken', value); else localStorage.removeItem('ifsmhp.accessToken'); window.dispatchEvent(new StorageEvent('storage', { key: 'ifsmhp.accessToken', oldValue, newValue: value })); }, value);
}
const response = (endpoint, status = 200) => page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1' + endpoint && r.status() === status);
async function focus() { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }
async function login(user) { const r = await context.request.post(api + '/auth/login', { data: { email: user.email, password: 'SessionBrowserVerification!2026' } }); assert.equal(r.status(), 200, await r.text()); return (await r.json()).data.accessToken; }
async function shot(name) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, name + '.png') }); }
async function run() {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const [name, role] of [['Recovery Admin', 'ADMIN'], ['Second Admin', 'ADMIN'], ['Community Member', 'MEMBER']]) users.push(await prisma.user.create({ data: { fullName: name, email: `${prefix}-${users.length}@example.test`, role, status: 'ACTIVE', passwordHash: role === 'ADMIN' ? await hashPassword('SessionBrowserVerification!2026') : null } }));
  token = await login(users[0]);
  const created = await context.request.post(api + '/admin/community/communities', { headers: { Authorization: `Bearer ${token}` }, data: { name: 'Session Recovery Community', slug: prefix, description: 'Session recovery test fixture', category: 'Research', visibility: 'PUBLIC', status: 'ACTIVE' } });
  assert.equal(created.status(), 201, await created.text()); community = (await created.json()).data;
  membership = await prisma.communityMembership.create({ data: { communityId: community.id, userId: users[2].id, status: 'ACTIVE', joinedAt: new Date() } });
  await context.addInitScript(({ token, site }) => { if (location.origin === site && !sessionStorage.getItem('fixture-loaded')) { if (!localStorage.getItem('ifsmhp.accessToken')) localStorage.setItem('ifsmhp.accessToken', token); sessionStorage.setItem('fixture-loaded', 'true'); } }, { token, site });
  page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message)); page.on('request', r => { if (r.url().endsWith('/auth/refresh')) refreshes++; });
  const screens = [['', 'Community Dashboard', '/dashboard'], ['/communities', 'Manage Communities', '/communities'], ['/members', 'Member Directory', '/members'], ['/chats', 'Community Chats', '/communities'], ['/moderation', 'Reports & Moderation', '/reports']];
  for (const [url, heading, endpoint] of screens) { console.log('Checking', heading); const ready = response('/admin/community' + endpoint); await page.goto(site + '/admin/community' + url); await ready; await page.locator('#main').getByRole('heading', { name: heading, exact: true }).waitFor(); if (url === '/chats') { const conversations = response('/admin/community/conversations'); await page.getByRole('button', { name: community.name, exact: true }).click(); await conversations; } }
  checks.push('All five Admin Community pages load real persisted data with a verified session');
  await page.goto(site + '/admin/community/members'); await page.getByLabel('Search members').fill(users[2].email);
  const row = () => page.getByRole('row').filter({ hasText: users[2].email }); const dialog = () => page.getByRole('dialog');
  await row().getByRole('button', { name: 'Block', exact: true }).click(); await dialog().getByLabel(/^Reason/).fill('Keep this note through expiry');
  const before = refreshes; await install(expired(token));
  const recovered = response('/admin/community/members'); const renewed = response('/auth/refresh'); await focus(); await renewed; await recovered;
  assert.equal(refreshes - before, 1); assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Keep this note through expiry'); assert.equal(await page.getByLabel('Search members').inputValue(), users[2].email);
  await shot('community-session-recovered-desktop');
  checks.push('Parallel options/member reads share one real refresh; filters and open confirmation notes survive');
  // Recoverable refresh failures preserve the account and the draft, including a failed mutation.
  const current = await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken')); await install(expired(current));
  await page.route('**/auth/refresh', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary session service failure. Retry.', errors: [] }) }));
  const failed = response('/auth/refresh', 503); await dialog().getByRole('button', { name: 'Block', exact: true }).click(); await failed;
  await dialog().getByRole('alert').getByText('Temporary session service failure. Retry.').waitFor(); assert.equal(await dialog().getByLabel(/^Reason/).inputValue(), 'Keep this note through expiry');
  assert.ok(await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken'))); await page.unroute('**/auth/refresh');
  const saved = response(`/admin/community/members/${membership.id}/status`); await dialog().getByRole('button', { name: 'Block', exact: true }).click(); await saved; await dialog().waitFor({ state: 'hidden' });
  await row().getByRole('button', { name: 'Unblock', exact: true }).click(); const restored = response(`/admin/community/members/${membership.id}/status`); await dialog().getByRole('button', { name: 'Unblock', exact: true }).click(); await restored; await dialog().waitFor({ state: 'hidden' });
  checks.push('Temporary refresh failures preserve session and notes; retry saves, and Unblock restores Active');
  // Actual interval polling, without injecting a focus event.
  const pollingToken = await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken')); await install(expired(pollingToken));
  const poll = response('/auth/refresh'); await poll; await row().getByRole('button', { name: 'Suspend', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await page.getByLabel('Search members').fill(users[2].email); await row().getByRole('button', { name: 'Suspend', exact: true }).click(); await dialog().getByLabel(/^Reason/).fill('Mobile session verification'); await shot('community-session-mobile'); await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Visible polling renews expired tokens; mobile navigation and reload retain access');
  const sibling = await context.newPage(); sibling.setDefaultTimeout(20000); sibling.on('pageerror', e => errors.push(e.message)); sibling.on('request', r => { if (r.url().endsWith('/auth/refresh')) refreshes++; });
  await sibling.goto(site + '/admin/community'); await sibling.locator('#main').getByRole('heading', { name: 'Community Dashboard', exact: true }).waitFor();
  const sharedBefore = refreshes, sharedToken = await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken'));
  await install(expired(sharedToken)); const sharedRenewal = context.waitForEvent('response', { predicate: r => r.url().endsWith('/auth/refresh') && r.status() === 200 }); const primaryReady = response('/admin/community/members');
  const siblingReady = sibling.waitForResponse(r => r.url().endsWith('/admin/community/dashboard') && r.status() === 200);
  await Promise.all([page.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated'))), sibling.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated')))]); await Promise.all([sharedRenewal, primaryReady, siblingReady]);
  assert.equal(refreshes - sharedBefore, 1); assert.ok(!page.url().includes('/login')); assert.ok(!sibling.url().includes('/login')); await sibling.close();
  checks.push('Two open tabs coordinate cookie rotation and remain signed in after simultaneous expiry');

  // Initial account restoration must be retryable, not falsely redirect to sign-in.
  await page.route('**/auth/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary account lookup failure', errors: [] }) }));
  await page.reload(); await page.getByText('Temporary account lookup failure', { exact: false }).waitFor(); assert.ok(!page.url().includes('/login'));
  await page.unroute('**/auth/me'); const retry = response('/admin/community/members'); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await retry;
  checks.push('Temporary account restoration failure offers Retry and recovers without fake authentication');
  // Delay an old /me response, switch to a different real administrator, then release it.
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release, signal, held = false; const reached = new Promise(r => signal = r);
  await page.route('**/auth/me', async route => { if (held) return route.continue(); held = true; const r = await route.fetch(); signal(); await new Promise(r => release = r); await route.fulfill({ response: r }); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await reached;
  const second = await login(users[1]); await install(second); await page.locator('aside').getByText(users[1].fullName, { exact: true }).waitFor(); release(); await page.unrouteAll({ behavior: 'wait' });
  await page.locator('aside').getByText(users[1].fullName, { exact: true }).waitFor(); assert.equal(await page.locator('aside').getByText(users[0].fullName, { exact: true }).count(), 0);
  checks.push('An old account response cannot overwrite a new verified sign-in');
  // Logout while refresh is in flight must not resurrect protected data.
  let releaseRefresh, signalRefresh; const refreshing = new Promise(r => signalRefresh = r);
  await page.route('**/auth/refresh', async route => { const r = await route.fetch(); signalRefresh(); await new Promise(r => releaseRefresh = r); await route.fulfill({ response: r }); });
  await install(expired(second)); await focus(); await refreshing; await install(null); await page.waitForURL('**/login'); releaseRefresh(); await page.unrouteAll({ behavior: 'wait' });
  assert.equal(await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken')), null); assert.equal(await page.getByRole('heading', { name: 'Member Directory', exact: true }).count(), 0);
  checks.push('Sign-out during refresh discards the late token and clears protected pages');
  token = await login(users[0]); await install(token); await page.goto(site + '/admin/community/members'); await page.getByLabel('Search members').fill(users[2].email); await row().getByRole('button', { name: 'Block', exact: true }).click(); await dialog().getByLabel(/^Reason/).fill('Must not save after revocation');
  await prisma.session.updateMany({ where: { userId: users[0].id }, data: { revokedAt: new Date() } });
  await dialog().getByRole('button', { name: 'Block', exact: true }).click(); await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken')), null); assert.equal((await prisma.communityMembership.findUniqueOrThrow({ where: { id: membership.id } })).status, 'ACTIVE');
  checks.push('Real revocation rejects access and refresh, redirects to sign-in, and leaves membership unchanged');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (community) await prisma.community.delete({ where: { id: community.id } });
  const ids = users.map(u => u.id); await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
});
