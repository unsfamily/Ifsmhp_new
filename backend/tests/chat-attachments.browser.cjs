// Run only with isolated MySQL/uploads and the matching local API/frontend.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256, hashPassword } = require('../dist/utils/security');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
const site = process.env.CHAT_WEB_URL || 'http://127.0.0.1:5179';
const base = process.env.CHAT_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.CHAT_SCREENSHOT_DIR || '/private/tmp/ifsmhp-chat-browser';
let browser, admin, member, conversation, ap, mp;
const checks = [], errors = [], users = [];
const subject = `Attachment review ${crypto.randomUUID().slice(0, 8)}`;
async function account(role) {
  const password = 'ChatVerification!2026';
  const user = await prisma.user.create({ data: { email: `chat-${crypto.randomUUID()}@example.test`, fullName: role === 'ADMIN' ? 'CRO Attachment Reviewer' : 'Member Attachment Sender', role, status: 'ACTIVE', passwordHash: role === 'ADMIN' ? await hashPassword(password) : null } }); users.push(user);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let response;
  if (role === 'ADMIN') response = await context.request.post(base + '/auth/login', { data: { email: user.email, password } });
  else {
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    await prisma.emailOtp.create({ data: { email: user.email, purpose: 'LOGIN', codeHash: sha256(`LOGIN:${user.email}:${code}`), expiresAt: new Date(Date.now() + 300000) } });
    response = await context.request.post(base + '/auth/otp/verify', { data: { email: user.email, purpose: 'LOGIN', code } });
  }
  assert.equal(response.status(), 200); const token = (await response.json()).data.accessToken;
  await context.addInitScript(({ token, site }) => { if (window.top === window && location.origin === site && window.localStorage) localStorage.setItem('ifsmhp.accessToken', token); }, { token, site });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  return { user, page, context, token };
}
async function screenshot(page, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflow');
  await page.screenshot({ path: path.join(output, name + '.png') });
}
async function download(page, name, bytes, button) {
  const waiting = page.waitForEvent('download');
  await (button || page.getByRole('button', { name: 'Download ' + name, exact: true })).click();
  const file = await waiting; assert.equal(file.suggestedFilename(), name);
  const saved = path.join(output, 'download-' + crypto.randomUUID()); await file.saveAs(saved);
  const actual = await fs.readFile(saved); assert.equal(actual.length, bytes.length); assert.equal(sha256(actual), sha256(bytes)); await fs.unlink(saved);
}
async function send(page, text, name, bytes, mime) {
  await page.getByPlaceholder(/Write your reply/).fill(text);
  const upload = page.waitForResponse(r => r.url().endsWith('/files/upload') && r.request().method() === 'POST');
  await page.locator('input[type=file]').first().setInputFiles({ name, mimeType: mime, buffer: bytes }); assert.equal((await upload).status(), 201);
  const sent = page.waitForResponse(r => r.url().endsWith(`/conversations/${conversation.id}/messages`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send Reply', exact: true }).click(); assert.equal((await sent).status(), 200);
  await page.getByRole('button', { name: 'Download ' + name, exact: true }).waitFor();
}
async function memberThread() {
  await mp.goto(site + '/dashboard/messages'); await mp.getByText(subject, { exact: true }).first().click();
  await mp.getByPlaceholder('Write your reply...', { exact: true }).waitFor();
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  admin = await account('ADMIN'); member = await account('MEMBER'); ap = admin.page; mp = member.page;
  const created = await member.context.request.post(base + '/members/me/conversations', { headers: { Authorization: `Bearer ${member.token}` }, data: { subject, category: 'General Inquiry', body: 'Attachment verification thread' } });
  assert.equal(created.status(), 201); conversation = (await created.json()).data;
  await memberThread();
  const image = await fs.readFile(path.join(__dirname, 'fixtures/chat/sample.png'));
  const name = 'member-résumé.png';
  await send(mp, 'Member upload', name, image, 'image/png');
  await ap.goto(site + `/admin/messages/${conversation.id}`);
  await download(ap, name, image); await ap.reload(); await download(ap, name, image);
  await ap.getByRole('button', { name: 'Preview ' + name, exact: true }).click();
  await ap.getByRole('dialog').getByRole('img', { name }).waitFor();
  assert.equal(admin.context.pages().length, 1);
  await download(ap, name, image, ap.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }));
  await screenshot(ap, 'chat-admin-preview'); await ap.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('Member UI upload → admin detail download/reload/preview preserve Unicode name, bytes, checksum; preview stays in-app');
  await ap.goto(site + '/admin/messages'); await ap.getByText(subject, { exact: true }).first().click(); await download(ap, name, image);
  await screenshot(ap, 'chat-admin-inbox'); checks.push('Admin inbox filename starts a verified download');
  await ap.goto(site + `/admin/messages/${conversation.id}`);
  const doc = await fs.readFile(path.join(__dirname, 'fixtures/chat/sample.docx'));
  await send(ap, 'CRO document', 'cro-protocol.docx', doc, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  await memberThread(); await download(mp, 'cro-protocol.docx', doc);
  assert.equal(await mp.getByRole('button', { name: 'Preview cro-protocol.docx', exact: true }).count(), 0);
  checks.push('Admin UI upload → member reload/download preserves DOCX; unsupported preview control is absent');
  // All supported image previews and PDF are opened via the same modal.
  for (const [ext, mime] of [['jpeg','image/jpeg'], ['webp','image/webp'], ['pdf','application/pdf']]) {
    const bytes = await fs.readFile(path.join(__dirname, `fixtures/chat/sample.${ext}`));
    await send(ap, 'Preview fixture ' + ext, `cro-preview.${ext}`, bytes, mime);
    await memberThread(); await mp.getByRole('button', { name: `Preview cro-preview.${ext}`, exact: true }).click();
    await mp.getByRole('dialog').locator(ext === 'pdf' ? 'iframe' : 'img').waitFor();
    await download(mp, `cro-preview.${ext}`, bytes, mp.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }));
    await mp.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  }
  checks.push('PDF, JPEG and WebP previews open in-app with working downloads');
  await mp.getByPlaceholder('Write your reply...', { exact: true }).fill('Keep my unsent reply');
  let downloads = 0; const count = () => downloads++; mp.on('download', count);
  await mp.route('**/files/*/download?*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'File is unavailable', errors: [] }) }));
  await mp.getByRole('button', { name: 'Download cro-protocol.docx', exact: true }).click();
  await mp.getByText('This attachment is unavailable.', { exact: false }).waitFor();
  assert.equal(await mp.getByPlaceholder('Write your reply...', { exact: true }).inputValue(), 'Keep my unsent reply'); assert.equal(downloads, 0);
  await mp.unroute('**/files/*/download?*');
  await download(mp, 'cro-protocol.docx', doc, mp.getByRole('button', { name: 'Retry', exact: true }));
  checks.push('Blob JSON failure displays an unavailable-file error, preserves reply draft and retries without false download success');
  await mp.route('**/files/*/download?*', route => route.abort('failed'));
  await mp.getByRole('button', { name: 'Download cro-protocol.docx', exact: true }).click();
  await mp.getByText('Could not reach the server.', { exact: false }).waitFor(); await mp.unroute('**/files/*/download?*');
  checks.push('Network failures display actionable errors beside the attachment');
  await mp.setViewportSize({ width: 390, height: 844 });
  await download(mp, name, image); await mp.getByRole('button', { name: 'Preview ' + name, exact: true }).click();
  await mp.getByRole('dialog').getByRole('img', { name }).waitFor(); await screenshot(mp, 'chat-member-mobile-preview');
  await mp.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await mp.getByRole('button', { name: 'Download cro-protocol.docx', exact: true }).scrollIntoViewIfNeeded(); await screenshot(mp, 'chat-member-mobile');
  checks.push('Mobile download and preview fit the viewport and preserve the composer');
  // A late successful response must not initiate a download after logout/session change.
  let release, intercepted;
  const reached = new Promise(resolve => { intercepted = resolve; });
  await mp.route('**/files/*/download?*', async route => { const response = await route.fetch(); intercepted(); await new Promise(resolve => { release = resolve; }); await route.fulfill({ response }).catch(() => {}); });
  const before = downloads;
  await mp.getByRole('button', { name: 'Download cro-protocol.docx', exact: true }).click(); await reached;
  assert.equal(await mp.getByRole('button', { name: 'Download cro-protocol.docx', exact: true }).isDisabled(), true);
  await mp.evaluate(async () => { const client = await import('/src/api/client.ts'); client.setAccessToken(null); });
  release(); await mp.unroute('**/files/*/download?*', { behavior: 'wait' });
  assert.equal(downloads, before); checks.push('Duplicate clicks are disabled and session changes cancel pending transfers');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ checks, errors }, null, 2)); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); for (const [page, name] of [[ap,'admin'],[mp,'member']]) if (page) await page.screenshot({ path: path.join(output, 'failure-'+name+'.png'), fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (conversation) await prisma.conversation.delete({ where: { id: conversation.id } });
  const ids = users.map(u => u.id); const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: ids } } });
  await prisma.emailOtp.deleteMany({ where: { email: { in: users.map(u => u.email) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await Promise.all(files.map(f => fs.unlink(path.join(process.env.UPLOAD_STORAGE_PATH, f.storageKey)).catch(() => {})));
  await prisma.$disconnect();
});
