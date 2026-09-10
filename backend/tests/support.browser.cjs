// Run after building the backend, with both dev servers running. Fixtures are removed in finally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256, signAccessToken } = require('../dist/utils/security');
const { env } = require('../dist/config/env');
const base = process.env.SUPPORT_API_URL || 'http://127.0.0.1:5002/api/v1';
const site = process.env.SUPPORT_WEB_URL || 'http://127.0.0.1:5174';
const output = process.env.SUPPORT_SCREENSHOT_DIR || '/private/tmp/support-browser';
const prefix = `support-browser-${crypto.randomUUID()}`;
const users = [], files = [], errors = [];
let browser;
async function makeUser(role) {
  const user = await prisma.user.create({ data: {
    fullName: role === 'MEMBER' ? 'Dr. Asha Raman' : 'Support Review Administrator', email: `${prefix}-${role}@example.test`, role, status: 'ACTIVE',
    ...(role === 'MEMBER' ? { memberProfile: { create: { memberId: prefix, professionalType: 'Scientist', institution: 'Clinical Research Institute', approvedAt: new Date() } } } : {}),
  } });
  users.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { ...user, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function api(user, url, method = 'GET', data) {
  const response = await fetch(`${base}${url}`, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result)); return result.data;
}
async function pageFor(user) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((token) => localStorage.setItem('ifsmhp.accessToken', token), user.token);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: viewport overflow`);
}
(async () => {
  try {
    await fs.mkdir(output, { recursive: true });
    const member = await makeUser('MEMBER'), admin = await makeUser('ADMIN');
    await prisma.project.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ ownerId: member.id, title: `Clinical research ${i}`, category: 'Research', description: 'Project selector fixture', updatedAt: new Date(Date.now() - i * 1000) })) });
    const lastProject = await prisma.project.findFirstOrThrow({ where: { ownerId: member.id, title: 'Clinical research 100' } });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const m = await pageFor(member), a = await pageFor(admin);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await m.route('**/api/v1/members/me/support', async (route) => { await gate; await route.continue(); });
    await m.goto(`${site}/dashboard/support`);
    await m.getByText('Loading support requests...', { exact: true }).waitFor();
    release(); await m.getByText('No support requests yet', { exact: true }).waitFor(); await m.unroute('**/api/v1/members/me/support');
    await m.getByRole('button', { name: 'New Request', exact: true }).click();
    await m.getByLabel('Select Project', { exact: true }).selectOption(lastProject.id);
    assert.equal(await m.getByLabel('Select Project', { exact: true }).locator('option').count(), 102);
    await m.locator('label').filter({ has: m.locator('input[name="types"][value="Moral Support"]') }).click();
    await m.locator('label').filter({ has: m.locator('input[name="types"][value="Funding Support"]') }).click();
    await m.getByLabel('Request Title / Subject').fill('Clinical research collaboration support');
    await m.getByLabel('Detailed Request Description').fill('Please help our team coordinate the clinical research collaboration and funding review.');
    await m.getByLabel('I confirm this request is accurate', { exact: false }).check();
    let failCreate = true;
    await m.route('**/api/v1/members/me/support', (route) => route.request().method() === 'POST' && failCreate
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Submission temporarily unavailable', errors: [] }) }) : route.continue());
    await m.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await m.getByText('Submission temporarily unavailable', { exact: true }).waitFor();
    assert.equal(await m.getByLabel('Request Title / Subject').inputValue(), 'Clinical research collaboration support');
    failCreate = false;
    await m.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await m.getByRole('link', { name: 'View Details', exact: true }).waitFor();
    await m.unroute('**/api/v1/members/me/support');
    const row = await prisma.supportRequest.findFirstOrThrow({ where: { requesterId: member.id } });
    assert.equal(row.projectId, lastProject.id);
    await m.getByLabel('Search support requests').fill('Clinical research');
    await m.getByRole('button', { name: 'Message CRO', exact: true }).click();
    await m.getByRole('heading', { name: row.subject, exact: true }).waitFor();
    assert.equal(await m.locator('#support-reply').evaluate((node) => node === document.activeElement), true);
    assert.ok(m.url().includes('q=Clinical') && m.url().endsWith('#reply'));
    await m.locator('#support-reply').fill('Member browser follow-up');
    await m.getByRole('button', { name: 'Send Message', exact: true }).click();
    await m.getByText('Message sent.', { exact: true }).waitFor();
    await m.goBack(); await m.getByRole('link', { name: 'View Details', exact: true }).waitFor();
    assert.equal(await m.getByLabel('Search support requests').inputValue(), 'Clinical research');
    await m.getByRole('link', { name: 'View Details', exact: true }).click();
    await m.getByText('Member browser follow-up', { exact: true }).waitFor();
    await a.goto(`${site}/admin/support?q=${row.id}`);
    await a.getByRole('link', { name: 'Triage', exact: true }).click();
    await a.getByRole('heading', { name: 'Start Review', exact: false }).waitFor();
    await a.getByLabel('Admin Notes / Decision Rationale', { exact: false }).fill('PRIVATE browser triage notes');
    await a.getByRole('button', { name: 'Start Review', exact: true }).nth(1).click();
    await a.getByText('Decision saved.', { exact: true }).waitFor();
    await m.getByText('In Review', { exact: true }).first().waitFor({ timeout: 20000 });
    assert.equal(await m.getByText('PRIVATE browser triage notes', { exact: false }).count(), 0);
    await a.getByLabel('Assigned Administrator').selectOption(admin.id);
    await a.getByText('Request updated.', { exact: true }).waitFor();
    await a.getByLabel('Priority', { exact: true }).selectOption('Low');
    await a.getByText('Low Priority', { exact: false }).first().waitFor();
    await a.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await a.getByLabel('Admin Notes / Decision Rationale', { exact: false }).fill('The research collaboration support is approved.');
    await a.getByLabel('I confirm this approval', { exact: false }).check();
    await a.getByRole('button', { name: 'Approve & Send Response', exact: true }).click();
    await a.getByText('Request Approved', { exact: true }).waitFor();
    await a.getByRole('button', { name: 'Mark Completed', exact: true }).first().click();
    await a.getByLabel('Admin Notes / Decision Rationale', { exact: false }).fill('All requested support has been provided.');
    await a.getByRole('button', { name: 'Mark Complete & Notify', exact: true }).click();
    await a.getByText('Resolved / Completed', { exact: true }).waitFor();
    await m.reload(); await m.getByText('Closed', { exact: true }).first().waitFor();
    await m.locator('#support-reply').fill('Closed request follow-up remains available.');
    let failReply = true;
    await m.route(`**/api/v1/members/me/support/${row.id}/messages`, (route) => failReply
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Reply failed. Retry.', errors: [] }) }) : route.continue());
    await m.getByRole('button', { name: 'Send Message', exact: true }).click();
    await m.getByText('Reply failed. Retry.', { exact: true }).waitFor();
    assert.equal(await m.locator('#support-reply').inputValue(), 'Closed request follow-up remains available.');
    failReply = false; await m.getByRole('button', { name: 'Send Message', exact: true }).click();
    await m.getByText('Message sent.', { exact: true }).waitFor();
    await api(admin, `/admin/conversations/${row.conversationId}/messages`, 'POST', { body: 'Response from shared inbox' });
    await m.getByText('Response from shared inbox', { exact: true }).waitFor({ timeout: 20000 });
    const stored = await prisma.supportRequest.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(stored.status, 'COMPLETED'); assert.equal(stored.assignedAdminId, admin.id); assert.equal(stored.priority, 'Low');
    const form = new FormData();
    form.append('file', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'], { type: 'application/pdf' }), 'support-letter.pdf');
    const uploaded = await fetch(`${base}/files/upload`, { method: 'POST', headers: { Authorization: `Bearer ${admin.token}` }, body: form });
    assert.equal(uploaded.status, 201); const file = (await uploaded.json()).data; files.push(file.id);
    await api(admin, `/admin/support/${row.id}/messages`, 'POST', { body: 'Letter attached.', fileIds: [file.id] });
    await m.reload(); await m.getByRole('button', { name: 'Preview support-letter.pdf' }).waitFor();
    const popupEvent = m.context().waitForEvent('page');
    await m.getByRole('button', { name: 'Preview support-letter.pdf' }).click();
    const popup = await popupEvent; await popup.waitForURL('blob:**'); await popup.close();
    const downloadEvent = m.waitForEvent('download');
    await m.getByRole('button', { name: /support-letter.pdf.*B/ }).click();
    assert.equal((await downloadEvent).suggestedFilename(), 'support-letter.pdf');
    await m.locator('#support-reply').fill('Unsent draft survives a background refresh');
    await api(admin, `/admin/support/${row.id}/messages`, 'POST', { body: 'Polling update' });
    await m.getByText('Polling update', { exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await m.locator('#support-reply').inputValue(), 'Unsent draft survives a background refresh');
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 375, 812]]) {
      await m.setViewportSize({ width, height }); await a.setViewportSize({ width, height });
      await a.reload(); await a.getByText('Resolved / Completed', { exact: true }).waitFor();
      await screenshot(m, `member-detail-${name}`); await screenshot(a, `admin-detail-${name}`);
      await m.goto(`${site}/dashboard/support`); await m.getByRole('link', { name: 'View Details', exact: true }).waitFor();
      await a.goto(`${site}/admin/support?q=${row.id}`); await a.getByRole('link', { name: 'Open', exact: true }).waitFor();
      await screenshot(m, `member-list-${name}`); await screenshot(a, `admin-list-${name}`);
      await m.getByRole('link', { name: 'View Details', exact: true }).click(); await m.getByRole('heading', { name: row.subject }).waitFor();
      await a.getByRole('link', { name: 'Open', exact: true }).click(); await a.getByRole('heading', { name: row.subject }).waitFor();
    }
    let failList = true;
    await m.route('**/api/v1/members/me/support', (route) => failList ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Queue unavailable', errors: [] }) }) : route.continue());
    await m.goto(`${site}/dashboard/support`); await m.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    assert.equal(await m.getByRole('link', { name: 'View Details', exact: true }).count(), 0);
    failList = false; await m.getByRole('button', { name: 'Retry', exact: true }).click(); await m.getByRole('link', { name: 'View Details', exact: true }).waitFor();
    await a.goto(`${site}/admin/support/unknown`); await a.getByText('Support request not found', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`Support browser workflows passed at desktop/tablet/mobile. Screenshots: ${output}`);
  } finally {
    if (browser) await browser.close();
    const rows = await prisma.supportRequest.findMany({ where: { requesterId: { in: users } } });
    if (rows.length) await prisma.notification.deleteMany({ where: { OR: rows.map((r) => ({ link: { endsWith: `/support/${r.id}` } })) } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.supportRequest.deleteMany({ where: { requesterId: { in: users } } });
    await prisma.conversation.deleteMany({ where: { id: { in: rows.flatMap((r) => r.conversationId ? [r.conversationId] : []) } } });
    const stored = await prisma.fileObject.findMany({ where: { id: { in: files } } });
    await prisma.fileObject.deleteMany({ where: { id: { in: files } } });
    for (const f of stored) await fs.unlink(path.resolve(env.UPLOAD_STORAGE_PATH, f.storageKey)).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
