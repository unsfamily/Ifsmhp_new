// Real API / MySQL browser verification. All mutations use namespaced test fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256, signAccessToken } = require('../dist/utils/security');
const { assertSafePath } = require('../dist/utils/fileStorage');
const base = process.env.COMMUNITY_API_URL || 'http://127.0.0.1:5004/api/v1';
const site = process.env.COMMUNITY_WEB_URL || 'http://127.0.0.1:5176';
const output = process.env.COMMUNITY_SCREENSHOT_DIR || '/private/tmp/ifsmhp-community-browser';
const prefix = `moderation-browser-${crypto.randomUUID().slice(0, 8)}`;
const users = [], errors = [], checks = [];
let browser, communityId;
async function actor(name, role = 'MEMBER') {
  const user = await prisma.user.create({ data: { fullName: `Community ${name}`, email: `${prefix}-${name}@example.test`, role, status: 'ACTIVE' } }); users.push(user.id);
  if (role === 'MEMBER') await prisma.memberProfile.create({ data: { userId: user.id, institution: 'Research Institute', professionalType: 'Scientist' } });
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { ...user, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function api(actor, url, method = 'GET', body) {
  if (body && /\/community\/(messages|members)\/[^/]+\/report$/.test(url)) body = { submissionId: crypto.randomUUID(), ...body };
  if (body && /\/admin\/community\/reports\/[^/]+(?:\/actions)?$/.test(url) && method !== 'GET' && !body.operationId) {
    const report = await api(actor, url.replace(/\/actions$/, ''));
    body = { operationId: crypto.randomUUID(), expectedRevision: report.revision, expectedTargetVersion: report.targetVersion, ...body };
  }
  const response = await fetch(`${base}${url}`, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result.data;
}
async function pageFor(actor, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), actor.token);
  const page = await context.newPage(); page.setDefaultTimeout(22000); page.on('pageerror', e => { errors.push(e.message); console.error('Page error:', e.message); });
  page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText));
  page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
  return page;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
}
const message = (page, content) => page.locator('article').filter({ has: page.getByText(content, { exact: true }) });
async function openMember(page, name) {
  await page.goto(`${site}/dashboard/community`);
  await page.getByRole('button', { name: new RegExp(name) }).click();
}
async function memberChat(page, name) { await openMember(page, name); await page.getByRole('button', { name: /^General/ }).click(); }
async function expectText(page, text) { await page.getByText(text, { exact: true }).waitFor({ state: 'visible' }); }
async function send(page, text) { await page.getByRole('textbox', { name: 'Message', exact: true }).fill(text); await page.getByRole('button', { name: 'Send', exact: true }).click(); await expectText(page, text); }
async function run() {
  await fs.mkdir(output, { recursive: true });
  const admin = await actor('Administrator', 'ADMIN'), member = await actor('Reporter'), peer = await actor('Author');
  const name = `Moderation reliability ${prefix.slice(-8)}`;
  const group = await api(admin, '/admin/community/communities', 'POST', { name, slug: prefix, description: 'Reliable moderation', category: 'Research', visibility: 'PUBLIC', status: 'ACTIVE' }); communityId = group.id;
  for (const user of [member, peer]) await api(user, `/community/communities/${communityId}/join`, 'POST');
  const conversation = (await api(admin, `/admin/community/conversations?communityId=${communityId}`)).items[0];
  const content = 'Original text for reliable review';
  const posted = await api(peer, `/community/conversations/${conversation.id}/messages`, 'POST', { content });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const memberPage = await pageFor(member), adminPage = await pageFor(admin);
  await memberChat(memberPage, name);
  await message(memberPage, content).getByRole('button', { name: 'Report', exact: true }).click();
  await memberPage.getByRole('dialog').locator('textarea').fill('Lost response report');
  const submissions = [];
  await memberPage.route('**/community/messages/*/report', async route => {
    submissions.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (submissions.length === 1) await route.abort(); else await route.fulfill({ response });
  });
  await memberPage.getByRole('button', { name: 'Submit report' }).click();
  await memberPage.getByRole('alert').filter({ hasText: 'Could not reach' }).waitFor();
  assert.equal(await memberPage.getByRole('dialog').locator('textarea').inputValue(), 'Lost response report');
  await memberPage.getByRole('button', { name: 'Submit report' }).click();
  await memberPage.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(submissions.length, 2); assert.equal(submissions[0].submissionId, submissions[1].submissionId);
  assert.equal(await prisma.communityReport.count({ where: { reportedMessageId: posted.id } }), 1);
  await message(memberPage, content).getByRole('button', { name: 'Report', exact: true }).click();
  await memberPage.getByRole('dialog').locator('textarea').fill('Lost response report');
  await memberPage.getByRole('button', { name: 'Submit report' }).click();
  await memberPage.getByText('You have already reported this content. Your report is awaiting review.', { exact: true }).waitFor();
  checks.push('Member lost-response retries preserve drafts and submission IDs; duplicate reports display a distinct receipt');

  await adminPage.goto(`${site}/admin/community/moderation`);
  const row = adminPage.getByRole('row').filter({ hasText: 'Lost response report' }); await row.waitFor();
  const report = (await api(admin, `/admin/community/reports?communityId=${communityId}`)).items[0];
  await row.getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('WARN_MEMBER');
  await adminPage.getByLabel('Notes / reason').fill('Warning with a lost response');
  let failRefresh = true;
  await adminPage.route(`**/admin/community/reports/${report.id}`, async route => {
    if (failRefresh) { failRefresh = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary report refresh failure' }) }); }
    await route.continue();
  });
  await adminPage.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated')));
  await adminPage.getByRole('button', { name: 'Retry report refresh' }).waitFor();
  assert.ok(await adminPage.getByRole('button', { name: 'Apply action' }).isDisabled());
  assert.equal(await adminPage.getByLabel('Notes / reason').inputValue(), 'Warning with a lost response');
  await adminPage.getByRole('button', { name: 'Retry report refresh' }).click();
  await adminPage.getByRole('button', { name: 'Retry report refresh' }).waitFor({ state: 'detached' });
  await adminPage.unroute(`**/admin/community/reports/${report.id}`);
  const operations = [];
  await adminPage.route(`**/admin/community/reports/${report.id}/actions`, async route => {
    operations.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (operations.length === 1) await route.abort(); else await route.fulfill({ response });
  });
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('alert').filter({ hasText: 'Could not reach' }).waitFor();
  // Polling observes the committed operation before the lost-response retry.
  await adminPage.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated')));
  await adminPage.getByRole('dialog').getByText('Status: UNDER REVIEW', { exact: true }).waitFor();
  assert.equal(await adminPage.getByLabel('Notes / reason').inputValue(), 'Warning with a lost response');
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(operations[0], operations[1]);
  assert.equal(await prisma.notification.count({ where: { userId: peer.id, body: 'Warning with a lost response' } }), 1);
  assert.equal((await api(admin, `/admin/community/reports/${report.id}`)).actionHistory.length, 1);
  await adminPage.unroute(`**/admin/community/reports/${report.id}/actions`);
  checks.push('Failed report refresh preserves notes and offers retry; committed warnings with lost responses retry without duplicate warnings/history');

  // Hold an old list response across a mutation. It must not undo the newer list.
  let release, captured;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { captured = resolve; });
  let hold = true;
  await adminPage.route('**/admin/community/reports?*', async route => {
    if (!hold) return route.continue(); hold = false;
    const response = await route.fetch(); captured(); await gate; await route.fulfill({ response });
  });
  await adminPage.evaluate(() => window.dispatchEvent(new Event('focus'))); await ready;
  await row.getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('RESOLVE_REPORT');
  await adminPage.getByLabel('Notes / reason').fill('Explicit closure'); await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await row.getByText('RESOLVED', { exact: true }).waitFor();
  const oldResponse = adminPage.waitForResponse(response => response.url().includes('/reports?'));
  release(); await oldResponse;
  assert.equal(await row.getByText('UNDER REVIEW', { exact: true }).count(), 0);
  await adminPage.unroute('**/admin/community/reports?*');
  checks.push('A list request started before moderation cannot overwrite the resulting status');

  // The existing modal explicitly reopens, then dismisses, preserving notes on conflict.
  await row.getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('REOPEN_REPORT');
  await adminPage.getByLabel('Notes / reason').fill('Reconsider original evidence'); await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await row.getByText('OPEN', { exact: true }).waitFor();
  assert.equal((await api(admin, `/admin/community/reports/${report.id}`)).resolutionNotes, undefined);
  await row.getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('DISMISS_REPORT');
  await adminPage.getByLabel('Notes / reason').fill('Retained decision draft');
  await api(peer, `/community/messages/${posted.id}`, 'PATCH', { content: 'Edited while reviewing' });
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('button', { name: 'Review latest report' }).waitFor();
  assert.ok(await adminPage.getByRole('button', { name: 'Apply action' }).isDisabled());
  assert.equal(await adminPage.getByLabel('Notes / reason').inputValue(), 'Retained decision draft');
  await screenshot(adminPage, 'moderation-version-conflict');
  await adminPage.getByRole('button', { name: 'Review latest report' }).click();
  await adminPage.getByRole('dialog').getByText('Edited while reviewing', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await row.getByText('DISMISSED', { exact: true }).waitFor();
  checks.push('Explicit reopening clears resolution notes; edited targets require fresh review without losing action notes');

  await row.getByRole('button', { name: 'View report' }).click();
  await adminPage.getByRole('region', { name: 'Original evidence' }).getByText(content, { exact: true }).waitFor();
  await adminPage.getByRole('dialog').getByText('Edited while reviewing', { exact: true }).waitFor();
  // Hold a drawer request, delete through the real API, then invalidate the resource.
  let releaseDetail, capturedDetail;
  const detailGate = new Promise(resolve => { releaseDetail = resolve; });
  const detailReady = new Promise(resolve => { capturedDetail = resolve; }); let holdDetail = true;
  await adminPage.route(`**/admin/community/reports/${report.id}`, async route => {
    if (!holdDetail) return route.continue(); holdDetail = false;
    const response = await route.fetch(); capturedDetail(); await detailGate; await route.fulfill({ response });
  });
  await adminPage.evaluate(() => window.dispatchEvent(new Event('focus'))); await detailReady;
  await api(admin, `/admin/community/messages/${posted.id}`, 'DELETE');
  await adminPage.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated')));
  await adminPage.getByRole('dialog').getByText('This message was deleted.', { exact: true }).waitFor();
  const oldDetail = adminPage.waitForResponse(response => response.url().endsWith(`/reports/${report.id}`)); releaseDetail(); await oldDetail;
  assert.equal(await adminPage.getByRole('dialog').getByText('Edited while reviewing', { exact: true }).count(), 0);
  await screenshot(adminPage, 'moderation-original-and-deleted');
  await adminPage.unroute(`**/admin/community/reports/${report.id}`);
  checks.push('Original evidence remains unchanged; old drawer responses cannot revive deleted content');
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Status', exact: true }).selectOption('OPEN');
  await adminPage.getByText('No reports found', { exact: true }).waitFor();
  await adminPage.getByRole('combobox', { name: 'Status', exact: true }).selectOption('DISMISSED'); await row.waitFor();
  await adminPage.reload(); await row.waitFor();
  const mobile = await pageFor(admin, true); await mobile.goto(`${site}/admin/community/moderation`);
  await mobile.getByRole('row').filter({ hasText: 'Lost response report' }).getByRole('button', { name: 'View report' }).click();
  await mobile.getByRole('region', { name: 'Original evidence' }).waitFor(); await screenshot(mobile, 'moderation-mobile-evidence');
  checks.push('Status filtering, persisted reload, and mobile evidence review');
  // Dashboard polling uses the same invalidation rules as the report panels.
  await api(admin, `/admin/community/reports/${report.id}/actions`, 'POST', { action: 'REOPEN_REPORT', notes: 'Dashboard count check' });
  const dashboard = await pageFor(admin); await dashboard.goto(`${site}/admin/community`);
  await dashboard.getByText('Lost response report', { exact: true }).waitFor();
  let releaseDashboard, capturedDashboard;
  const dashboardGate = new Promise(resolve => { releaseDashboard = resolve; });
  const dashboardReady = new Promise(resolve => { capturedDashboard = resolve; }); let holdDashboard = true;
  await dashboard.route('**/admin/community/dashboard', async route => {
    if (!holdDashboard) return route.continue(); holdDashboard = false;
    const response = await route.fetch(); capturedDashboard(); await dashboardGate; await route.fulfill({ response });
  });
  await dashboard.evaluate(() => window.dispatchEvent(new Event('focus'))); await dashboardReady;
  await api(admin, `/admin/community/reports/${report.id}/actions`, 'POST', { action: 'DISMISS_REPORT', notes: 'Dashboard closure' });
  await dashboard.evaluate(() => window.dispatchEvent(new Event('ifsmhp:community-updated')));
  await dashboard.getByText('Lost response report', { exact: true }).waitFor({ state: 'detached' });
  const oldDashboard = dashboard.waitForResponse(response => response.url().endsWith('/community/dashboard')); releaseDashboard(); await oldDashboard;
  assert.equal(await dashboard.getByText('Lost response report', { exact: true }).count(), 0);
  await dashboard.close();
  checks.push('A stale dashboard response cannot restore a closed report or its count');
  for (let n = 0; n < 12; n++) {
    const item = await api(peer, `/community/conversations/${conversation.id}/messages`, 'POST', { content: `Pagination target ${n}` });
    await api(member, `/community/messages/${item.id}/report`, 'POST', { reason: `Paged report ${n}` });
  }
  await adminPage.getByRole('combobox', { name: 'Status', exact: true }).selectOption('OPEN');
  await adminPage.getByText('Page 1 of 2', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Next page' }).click(); await adminPage.getByText('Page 2 of 2', { exact: true }).waitFor();
  await adminPage.getByPlaceholder('Search reports').fill('Paged report 11');
  await adminPage.getByText('Page 1 of 1', { exact: true }).waitFor();
  await adminPage.getByRole('row').filter({ hasText: 'Paged report 11' }).waitFor();
  checks.push('Report pagination and search reset to the matching page');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: checks, screenshots: output }, null, 2));
}
run().catch(async error => { console.error(error); console.error('Runtime errors:', errors); if (browser) { for (const [n, context] of browser.contexts().entries()) for (const page of context.pages()) await page.screenshot({ path: path.join(output, `failure-${n}.png`), fullPage: true }).catch(() => undefined); } process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await prisma.community.deleteMany({ where: { createdById: { in: users } } });
  const files = await prisma.fileObject.findMany({ where: { communityManaged: true, uploaderId: { in: users } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  for (const file of files) await fs.unlink(assertSafePath(file.storageKey)).catch(() => undefined);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
