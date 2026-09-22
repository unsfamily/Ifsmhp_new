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
const baseline = process.env.COMMUNITY_BASELINE_URL;
const output = process.env.COMMUNITY_SCREENSHOT_DIR || '/private/tmp/ifsmhp-community-browser';
const prefix = `community-browser-${crypto.randomUUID().slice(0, 8)}`;
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
  const admin = await actor('Administrator', 'ADMIN'), member = await actor('Member'), peer = await actor('Peer'), moderator = await actor('Moderator');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const adminPage = await pageFor(admin), memberPage = await pageFor(member), peerPage = await pageFor(peer), modPage = await pageFor(moderator);
  const name = `Research Network ${prefix.slice(-8)}`;
  await adminPage.goto(`${site}/admin/community/communities`);
  await adminPage.getByRole('button', { name: 'Add Community' }).click();
  await adminPage.getByLabel('Community name').fill(name); await adminPage.getByLabel('Slug', { exact: false }).fill(prefix);
  await adminPage.getByRole('dialog').getByLabel('Category').fill('Research'); await adminPage.getByLabel('Description').fill('A collaborative research community.');
  await screenshot(adminPage, 'admin-create-modal');
  await adminPage.getByRole('button', { name: 'Create community', exact: true }).click();
  await adminPage.getByRole('row').filter({ hasText: name }).waitFor();
  const community = (await api(admin, `/admin/community/communities?search=${encodeURIComponent(name)}`)).items[0]; communityId = community.id;
  const chat = (await api(admin, `/admin/community/conversations?communityId=${communityId}`)).items[0];
  checks.push('Admin creation and automatic General conversation');
  await screenshot(adminPage, 'admin-communities-desktop');
  if (baseline) {
    const oldPage = await pageFor(admin); await oldPage.goto(`${baseline}/admin/community/communities`); await oldPage.getByRole('row').filter({ hasText: name }).waitFor();
    await screenshot(oldPage, 'baseline-admin-communities-desktop');
    const bounds = async page => page.locator('main table').boundingBox();
    const before = await bounds(oldPage), after = await bounds(adminPage);
    assert.deepEqual(after, before, 'Admin table layout changed'); await oldPage.close();
    checks.push('Original admin table geometry preserved');
  }
  await adminPage.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'View', exact: true }).click();
  await adminPage.getByRole('dialog', { name: 'Community details' }).waitFor();
  await adminPage.getByRole('dialog').getByText('Community Administrator', { exact: true }).waitFor();
  await screenshot(adminPage, 'admin-community-details'); await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
  await openMember(memberPage, name); await memberPage.getByRole('button', { name: 'Join Community', exact: true }).click();
  await memberChat(memberPage, name); await send(memberPage, 'Member browser message');
  await adminPage.goto(`${site}/admin/community/chats`); await adminPage.getByRole('button', { name: new RegExp(name) }).click(); await adminPage.getByRole('button', { name: /^General/ }).click();
  await expectText(adminPage, 'Member browser message');
  await send(adminPage, 'Administrator browser reply'); await expectText(memberPage, 'Administrator browser reply');
  await screenshot(memberPage, 'member-chat-desktop'); await screenshot(adminPage, 'admin-chat-desktop');
  checks.push('Public joining, admin/member sends and polling across sessions');
  if (baseline) {
    const oldMember = await pageFor(member); await oldMember.goto(`${baseline}/dashboard/community`);
    await oldMember.getByRole('button', { name: new RegExp(name) }).click(); await oldMember.getByRole('button', { name: /^General/ }).click();
    await expectText(oldMember, 'Administrator browser reply'); await screenshot(oldMember, 'baseline-member-chat-desktop');
    const panelBox = page => page.locator('div.grid').filter({ has: page.getByRole('heading', { name: 'Member directory', exact: true }) }).boundingBox();
    assert.deepEqual(await panelBox(memberPage), await panelBox(oldMember), 'Member panel geometry changed');
    await oldMember.close(); checks.push('Original member panel geometry preserved');
  }

  await message(memberPage, 'Administrator browser reply').getByRole('button', { name: 'Reply', exact: true }).click();
  await send(memberPage, 'A threaded response');
  await message(memberPage, 'Member browser message').getByRole('button', { name: 'Edit', exact: true }).click();
  await memberPage.getByRole('dialog', { name: 'Edit message' }).locator('textarea').fill('Member edited message');
  await memberPage.getByRole('button', { name: 'Save', exact: true }).click(); await expectText(adminPage, 'Member edited message');
  await memberPage.locator('input[type=file]').setInputFiles({ name: 'research.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nResearch attachment') });
  await send(memberPage, 'Message with attachment');
  const downloadPromise = memberPage.waitForEvent('download'); await memberPage.getByRole('link', { name: 'research.pdf' }).click();
  assert.equal((await downloadPromise).suggestedFilename(), 'research.pdf');
  checks.push('Replies, own edits, secure attachment upload/download');
  await api(moderator, `/community/communities/${communityId}/join`, 'POST');
  await adminPage.goto(`${site}/admin/community/members`); await adminPage.getByPlaceholder('Name or email').fill('Community Moderator');
  await adminPage.getByRole('row').filter({ hasText: 'Community Moderator' }).getByRole('button', { name: 'Assign moderator', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Assign moderator role', exact: true }).click();
  await openMember(peerPage, name); await peerPage.getByRole('button', { name: 'Join Community', exact: true }).click();
  await memberChat(peerPage, name); await send(peerPage, 'Reported browser content');
  await expectText(memberPage, 'Reported browser content');
  assert.equal(await message(memberPage, 'Member edited message').getByRole('button', { name: 'Report', exact: true }).count(), 0);
  await message(memberPage, 'Reported browser content').getByRole('button', { name: 'Report', exact: true }).click();
  await memberPage.getByRole('dialog', { name: 'Report message' }).locator('textarea').fill('Canceled report draft');
  await memberPage.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await message(memberPage, 'Reported browser content').getByRole('button', { name: 'Report', exact: true }).click();
  assert.equal(await memberPage.getByRole('dialog').locator('textarea').inputValue(), '');
  await memberPage.getByRole('dialog', { name: 'Report message' }).locator('textarea').fill('Browser moderation review');
  await memberPage.getByRole('button', { name: 'Submit report' }).click();
  await modPage.goto(`${site}/admin/community/moderation`);
  const reportRow = modPage.getByRole('row').filter({ hasText: 'Browser moderation review' });
  await reportRow.waitFor(); assert.equal(await modPage.getByRole('link', { name: 'Manage Communities', exact: true }).count(), 0);
  let reviewRequests = 0;
  await modPage.route('**/admin/community/reports/*', async route => {
    if (route.request().method() === 'PATCH') { reviewRequests++; await new Promise(resolve => setTimeout(resolve, 250)); }
    await route.continue();
  });
  await reportRow.getByRole('button', { name: 'Start review', exact: true }).evaluate(button => { button.click(); button.click(); });
  await reportRow.getByText('UNDER REVIEW', { exact: true }).waitFor();
  assert.equal(reviewRequests, 1); await modPage.unroute('**/admin/community/reports/*');
  await reportRow.getByRole('button', { name: 'Moderation action', exact: true }).click();
  await modPage.getByLabel('Action', { exact: true }).selectOption('HIDE_CONTENT'); await modPage.getByLabel('Notes / reason').fill('Hidden after review'); await modPage.getByRole('button', { name: 'Apply action' }).click();
  await message(memberPage, 'Reported browser content').waitFor({ state: 'detached' });
  await reportRow.getByRole('button', { name: 'View report' }).click(); await expectText(modPage, 'Hidden after review');
  await screenshot(modPage, 'moderator-report-details'); await modPage.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('Report submission, scoped moderator pages, moderation history and automatic content removal');

  const reviewedReport = (await api(admin, `/admin/community/reports?search=Browser%20moderation%20review`)).items[0];
  assert.equal(reviewedReport.actionHistory.filter(action => action.action === 'REPORT_UNDER_REVIEW').length, 1);
  await adminPage.goto(`${site}/admin/community/moderation`);
  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).waitFor();
  await screenshot(adminPage, 'moderation-desktop');
  if (baseline) {
    const oldModeration = await pageFor(admin); await oldModeration.goto(`${baseline}/admin/community/moderation`);
    await oldModeration.getByRole('row').filter({ hasText: 'Browser moderation review' }).waitFor();
    assert.deepEqual(await adminPage.locator('main table').boundingBox(), await oldModeration.locator('main table').boundingBox(), 'Moderation table geometry changed');
    await oldModeration.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
    await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
    await adminPage.getByLabel('Action', { exact: true }).waitFor();
    assert.deepEqual(await adminPage.getByRole('dialog').boundingBox(), await oldModeration.getByRole('dialog').boundingBox(), 'Moderation modal geometry changed');
    await screenshot(oldModeration, 'baseline-moderation-modal'); await screenshot(adminPage, 'moderation-modal');
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await oldModeration.close();
  }
  await memberPage.getByRole('button', { name: 'Report Community Peer', exact: true }).click();
  assert.equal(await memberPage.getByRole('dialog').locator('textarea').inputValue(), '');
  await memberPage.getByRole('dialog').locator('textarea').fill('Member-only review');
  await memberPage.getByRole('button', { name: 'Submit report' }).click();
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click();
  const memberReportRow = adminPage.getByRole('row').filter({ hasText: 'Member-only review' });
  await memberReportRow.getByRole('button', { name: 'Moderation action' }).click();
  const actionOptions = () => adminPage.getByLabel('Action', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value));
  await adminPage.getByLabel('Action', { exact: true }).waitFor();
  assert.deepEqual(await actionOptions(), ['WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER', 'RESOLVE_REPORT', 'DISMISS_REPORT']);
  await adminPage.getByLabel('Notes / reason').fill('Warning retained after failed request');
  await adminPage.route('**/admin/community/reports/*/actions', route => route.abort());
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('dialog').getByRole('alert').filter({ hasText: 'Could not reach the server' }).waitFor();
  assert.equal(await adminPage.getByLabel('Notes / reason').inputValue(), 'Warning retained after failed request');
  await adminPage.unroute('**/admin/community/reports/*/actions');
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await prisma.notification.count({ where: { userId: peer.id, type: 'community', body: 'Warning retained after failed request' } }), 1);
  checks.push('Report cancellation clears drafts; review double-click is deduplicated; member-only actions and failed-action retry work');

  // Delayed detail responses must not populate the subsequently selected report.
  await adminPage.route(`**/admin/community/reports/${reviewedReport.id}`, async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  const delayedResponse = adminPage.waitForResponse(response => response.url().endsWith(`/reports/${reviewedReport.id}`));
  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await memberReportRow.getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).waitFor(); await delayedResponse;
  assert.ok(!(await actionOptions()).includes('RESTORE_CONTENT'));
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await adminPage.unroute(`**/admin/community/reports/${reviewedReport.id}`);

  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('RESOLVE_REPORT');
  await adminPage.getByLabel('Notes / reason').fill('Resolved after review'); await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByText('RESOLVED', { exact: true }).waitFor();
  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('RESTORE_CONTENT');
  await adminPage.getByLabel('Notes / reason').fill('Corrected after resolution'); await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await expectText(memberPage, 'Reported browser content');
  assert.equal((await api(admin, `/admin/community/reports/${reviewedReport.id}`)).status, 'RESOLVED');
  await adminPage.getByRole('row').filter({ hasText: 'Browser moderation review' }).getByRole('button', { name: 'Moderation action' }).click();
  await adminPage.getByLabel('Action', { exact: true }).selectOption('HIDE_CONTENT');
  await adminPage.getByLabel('Notes / reason').fill('Preserve stale action notes');
  await api(admin, `/admin/community/reports/${reviewedReport.id}/actions`, 'POST', { action: 'HIDE_CONTENT', notes: 'Hidden in another session' });
  await adminPage.getByRole('button', { name: 'Apply action' }).click();
  await adminPage.getByRole('alert').filter({ hasText: 'changed. Review the latest state' }).waitFor();
  assert.equal(await adminPage.getByLabel('Notes / reason').inputValue(), 'Preserve stale action notes');
  await adminPage.getByRole('button', { name: 'Review latest report', exact: true }).click();
  await adminPage.getByLabel('Action', { exact: true }).locator('option[value="RESTORE_CONTENT"]').waitFor({ state: 'attached' });
  assert.equal(await adminPage.getByLabel('Action', { exact: true }).inputValue(), '');
  assert.ok(await adminPage.getByRole('button', { name: 'Apply action' }).isDisabled());
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Late responses cannot change selected reports; closed-report corrections and stale-action recovery preserve notes');

  await message(peerPage, 'Message with attachment').getByRole('button', { name: 'Report', exact: true }).click();
  await peerPage.getByRole('dialog').locator('textarea').fill('Attachment evidence'); await peerPage.getByRole('button', { name: 'Submit report' }).click();
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click();
  const attachmentRow = adminPage.getByRole('row').filter({ hasText: 'Attachment evidence' });
  await attachmentRow.getByRole('button', { name: 'View report' }).click();
  const evidenceDownload = adminPage.waitForEvent('download'); await adminPage.getByRole('region', { name: 'Original evidence' }).getByRole('link', { name: 'research.pdf' }).click();
  assert.equal((await evidenceDownload).suggestedFilename(), 'research.pdf');
  await screenshot(adminPage, 'moderation-attachment-details');
  const evidence = (await api(admin, '/admin/community/reports?search=Attachment%20evidence')).items[0];
  await api(admin, `/admin/community/messages/${evidence.reportedMessage.id}`, 'DELETE');
  await adminPage.getByRole('dialog').getByText('This message was deleted.', { exact: true }).waitFor();
  assert.equal(await adminPage.getByRole('dialog').getByRole('link', { name: 'research.pdf' }).count(), 1);
  const retainedDownload = adminPage.waitForEvent('download'); await adminPage.getByRole('region', { name: 'Original evidence' }).getByRole('link', { name: 'research.pdf' }).click();
  assert.equal((await retainedDownload).suggestedFilename(), 'research.pdf');
  await screenshot(adminPage, 'moderation-retained-evidence');
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await attachmentRow.getByText('This message was deleted.', { exact: true }).waitFor();
  const mobileModeration = await pageFor(admin, true); await mobileModeration.goto(`${site}/admin/community/moderation`);
  await mobileModeration.getByRole('row').filter({ hasText: 'Member-only review' }).getByRole('button', { name: 'Moderation action' }).click();
  await mobileModeration.getByLabel('Action', { exact: true }).waitFor(); await screenshot(mobileModeration, 'moderation-mobile-modal');
  await mobileModeration.close();
  checks.push('Report attachments download securely, deletion updates table/drawer automatically, and mobile modal remains usable');

  await modPage.goto(`${site}/admin/community/chats`); await modPage.getByRole('button', { name: new RegExp(name) }).click(); await modPage.getByRole('button', { name: /^General/ }).click();
  await modPage.getByRole('button', { name: 'Lock', exact: true }).click(); await expectText(memberPage, 'This conversation is locked.');
  await modPage.getByRole('button', { name: 'Unlock', exact: true }).click(); await memberPage.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
  await memberPage.getByRole('textbox', { name: 'Message', exact: true }).fill('Unsent draft stays intact');
  await send(peerPage, 'New message during draft'); await expectText(memberPage, 'New message during draft');
  assert.equal(await memberPage.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Unsent draft stays intact');
  checks.push('Conversation locking and draft preservation during refresh');
  const mobile = await pageFor(member, true); await memberChat(mobile, name); await mobile.getByRole('textbox', { name: 'Message', exact: true }).waitFor(); await screenshot(mobile, 'member-chat-mobile');
  assert.ok(await mobile.getByRole('button', { name: 'Send', exact: true }).isVisible(), 'Mobile composer must remain visible');
  await mobile.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).click(); await screenshot(mobile, 'member-community-mobile');
  checks.push('Mobile list/detail/chat navigation and no horizontal overflow');
  // Network failures must remain errors, never replace content with mock data.
  await memberPage.route('**/community/conversations/*/messages', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await memberPage.getByRole('textbox', { name: 'Message', exact: true }).fill('Retry after network failure'); await memberPage.getByRole('button', { name: 'Send', exact: true }).click();
  await memberPage.getByRole('status').filter({ hasText: 'Could not reach the server' }).waitFor();
  assert.equal(await memberPage.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), 'Retry after network failure');
  await memberPage.unroute('**/community/conversations/*/messages'); await memberPage.getByRole('button', { name: 'Send', exact: true }).click(); await expectText(memberPage, 'Retry after network failure');
  checks.push('Network failure preserves draft and retry succeeds');
  await prisma.communityMessage.createMany({ data: Array.from({ length: 125 }, (_, n) => ({ conversationId: chat.id, senderId: peer.id, content: `Browser history ${n}`, createdAt: new Date(Date.now() + n) })) });
  await expectText(memberPage, 'Browser history 124');
  const history = memberPage.locator('div.overflow-y-auto').filter({ has: memberPage.locator('article') });
  assert.equal(await history.count(), 1);
  await history.evaluate(el => { el.scrollTop = 0; });
  await memberPage.getByText('Browser history 0', { exact: true }).waitFor({ state: 'attached' });
  const beforePolling = await history.evaluate(el => el.scrollTop);
  await api(peer, `/community/conversations/${chat.id}/messages`, 'POST', { content: 'Arrival during history reading' });
  await memberPage.getByText('Arrival during history reading', { exact: true }).waitFor({ state: 'attached' });
  assert.ok(Math.abs(await history.evaluate(el => el.scrollTop) - beforePolling) < 5, 'Polling should preserve history scroll');
  checks.push('Older history beyond 100 messages loads and retains scroll while new messages arrive');
  const requester = await actor('Requester'), requestPage = await pageFor(requester);
  const privateName = `Private Practice ${prefix.slice(-8)}`;
  const privateGroup = await api(admin, '/admin/community/communities', 'POST', { name: privateName, slug: `${prefix}-private`, description: 'Private professional exchange', category: 'Practice', visibility: 'PRIVATE', status: 'ACTIVE' });
  await openMember(requestPage, privateName); await requestPage.getByRole('button', { name: 'Request to Join', exact: true }).click();
  await requestPage.getByRole('button', { name: new RegExp(privateName) }).click();
  await requestPage.getByRole('button', { name: 'Cancel Pending Request', exact: true }).click();
  await requestPage.getByRole('button', { name: new RegExp(privateName) }).click();
  await requestPage.getByRole('button', { name: 'Request to Join', exact: true }).click();
  await requestPage.getByRole('button', { name: new RegExp(privateName) }).click();
  await adminPage.goto(`${site}/admin/community/members`); await adminPage.getByPlaceholder('Name or email').fill('Community Requester');
  await adminPage.getByRole('row').filter({ hasText: 'Community Requester' }).getByRole('button', { name: 'Approve', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await requestPage.getByRole('button', { name: /^General/ }).click(); await send(requestPage, 'Approved private conversation');
  await screenshot(requestPage, 'member-private-approved');
  checks.push('Private request, cancellation, approval and live access without reloading');
  await adminPage.goto(`${site}/admin/community/communities`);
  await adminPage.getByRole('row').filter({ hasText: privateName }).getByRole('button', { name: 'Edit', exact: true }).click();
  await adminPage.getByRole('dialog').getByLabel('Description').fill('Updated private description');
  const imageFixture = { name: 'community.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64') };
  await adminPage.getByRole('dialog').getByLabel('Profile image').setInputFiles(imageFixture);
  await adminPage.getByRole('dialog').getByLabel('Banner image').setInputFiles(imageFixture);
  await adminPage.getByRole('img', { name: 'Profile image preview' }).evaluate(image => image.decode());
  await adminPage.getByRole('img', { name: 'Banner image preview' }).evaluate(image => image.decode());
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
  await expectText(requestPage, 'Updated private description');
  await Promise.all(Array.from({ length: 11 }, (_, n) => api(admin, '/admin/community/communities', 'POST', { name: `Pagination ${prefix} ${n}`, slug: `${prefix}-page-${n}`, description: 'Pagination fixture', category: 'Pagination', visibility: 'PUBLIC', status: 'ACTIVE' })));
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Next page', exact: true }).click(); await expectText(adminPage, 'Page 2 of 2');
  await adminPage.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Practice');
  await adminPage.getByRole('row').filter({ hasText: privateName }).waitFor(); await expectText(adminPage, 'Page 1 of 1');
  await adminPage.getByRole('combobox', { name: 'Visibility', exact: true }).selectOption('PUBLIC');
  await expectText(adminPage, 'No communities found');
  await adminPage.getByRole('combobox', { name: 'Visibility', exact: true }).selectOption('PRIVATE');
  await adminPage.getByRole('row').filter({ hasText: privateName }).waitFor();
  checks.push('Community edit refresh, complete category options, filtering and table pagination');
  await api(admin, `/admin/community/communities/${privateGroup.id}`, 'DELETE');
  await requestPage.close();


  await api(admin, `/admin/community/communities/${communityId}/status`, 'PATCH', { status: 'INACTIVE' });
  await memberPage.getByText('Community not found', { exact: true }).waitFor();
  assert.equal(await memberPage.locator('article').count(), 0);
  await api(admin, `/admin/community/communities/${communityId}/status`, 'PATCH', { status: 'ACTIVE' });
  await api(admin, `/admin/community/members/${(await api(admin, `/admin/community/members?communityId=${communityId}&search=Community%20Moderator`)).items[0].id}/role`, 'PATCH', { role: 'MEMBER' });
  await modPage.waitForURL(`${site}/dashboard`);
  checks.push('Unpublishing clears protected content; role revocation removes moderator access');
  await adminPage.goto(`${site}/admin/community/communities`);
  await adminPage.getByPlaceholder('Search communities').fill(name);
  await adminPage.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Archive', exact: true }).click(); await adminPage.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await adminPage.getByRole('row').filter({ hasText: name }).getByText('ARCHIVED', { exact: true }).waitFor();
  await adminPage.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Delete', exact: true }).click(); await adminPage.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await adminPage.getByRole('row').filter({ hasText: name }).waitFor({ state: 'detached' });
  checks.push('Archive and delete dialogs complete the lifecycle');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(JSON.stringify({ passed: checks, screenshots: output }, null, 2));
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
