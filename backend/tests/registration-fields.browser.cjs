// Run against an isolated *_test database/API with SMTP disabled.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256, signAccessToken } = require('../dist/utils/security');
const { assertSafePath } = require('../dist/utils/fileStorage');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'Use an isolated *_test database');
const site = process.env.REGISTRATION_WEB_URL || 'http://127.0.0.1:5179';
const base = process.env.REGISTRATION_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.REGISTRATION_SCREENSHOT_DIR || '/private/tmp/ifsmhp-registration-browser';
const prefix = `registration-browser-${crypto.randomUUID().slice(0, 8)}`;
const email = `${prefix}@example.test`;
const checks = [], errors = [], files = [];
let browser, page;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
async function deliveredCode(purpose) {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const otp = await prisma.emailOtp.findFirstOrThrow({ where: { email, purpose, consumedAt: null } });
  // Test mailbox fixture: replace only the code hash; retain the actual API draft.
  await prisma.emailOtp.update({ where: { id: otp.id }, data: { codeHash: sha256(`${purpose}:${email}:${code}`) } });
  return code;
}
async function shot(name) {
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll('body *')).filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(e => ({tag:e.tagName, classes:e.className})) }));
  assert.ok(overflow.scroll <= overflow.width, 'Horizontal overflow: ' + JSON.stringify(overflow));
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  page.on('response', async response => { if (response.url() === base + '/files/registration' && response.status() === 201) files.push((await response.json()).data.id); });
  await page.goto(site + '/register');
  for (const [label, value] of Object.entries({ 'First Name': 'Jane', 'Last Name': 'O’Connor', Email: email, 'Phone Number': '0123456789', 'Type of Professional Organization / Independent Professionals': 'Independent Researcher', 'Communication Address': '10 Research Road\nChennai 600001', 'Permanent Address': '20 Home Street\nMadurai 625001', 'Professional Credentials': 'Licensed clinical research professional', Education: 'PhD Clinical Psychology, Test University', 'Research Interests': 'Community mental health and wellbeing' })) await page.getByLabel(label, { exact: false }).fill(value);
  await page.getByLabel('Professional Type').selectOption('Lecturer');
  for (let index = 0; index < 2; index++) await page.locator('input[type=file]').nth(index).setInputFiles({ name: `${prefix}-${index}.pdf`, mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('checkbox').check();
  await page.route('**/auth/otp/request', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Check your address', errors: [{ field: 'communicationAddress', message: 'Address could not be saved. Try again.' }] }) }));
  await page.getByRole('button', { name: 'Submit Application', exact: true }).click();
  await page.getByText('Address could not be saved. Try again.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Communication Address').inputValue(), '10 Research Road\nChennai 600001');
  await page.setViewportSize({ width: 390, height: 844 }); await shot('registration-mobile-validation');
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.unroute('**/auth/otp/request');
  const submitted = page.waitForRequest(r => r.url() === base + '/auth/otp/request' && r.method() === 'POST');
  await page.getByRole('button', { name: 'Submit Application', exact: true }).click();
  const payload = (await submitted).postDataJSON();
  assert.equal(payload.firstName, 'Jane'); assert.equal(payload.lastName, 'O’Connor'); assert.equal(payload.permanentAddress, '20 Home Street\nMadurai 625001');
  await page.getByRole('heading', { name: 'Verify your email' }).waitFor();
  await page.reload(); await page.getByRole('heading', { name: 'Verify your email' }).waitFor();
  const code = await deliveredCode('REGISTER');
  for (let index = 0; index < 6; index++) await page.getByLabel(`Digit ${index + 1} of 6`).fill(code[index]);
  await page.getByRole('heading', { name: 'Your membership application' }).waitFor();
  await shot('registration-success-desktop');
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { memberProfile: true, membershipApplication: true } });
  assert.equal(user.firstName, 'Jane'); assert.equal(user.memberProfile.communicationAddress, payload.communicationAddress);
  checks.push('Registration form sends split names and addresses, retains failed-save values, and completes real OTP registration after reload');
  const admin = await prisma.user.create({ data: { fullName: 'Registration Reviewer', email: `${prefix}-admin@example.test`, role: 'ADMIN', status: 'ACTIVE' } });
  const session = await prisma.session.create({ data: { userId: admin.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  const adminToken = signAccessToken({ sub: admin.id, role: 'ADMIN', sessionId: session.id });
  const adminContext = await browser.newContext(); await adminContext.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), adminToken);
  const adminPage = await adminContext.newPage(); await adminPage.goto(site + '/admin/members/' + user.membershipApplication.id);
  await adminPage.getByText('10 Research Road\nChennai 600001', { exact: true }).waitFor();
  assert.equal((await context.request.post(`${base}/admin/membership/${user.membershipApplication.id}/evidence-review`, { headers: { Authorization: `Bearer ${adminToken}` }, data: {} })).status(), 200);
  for (const action of ['review', 'approve']) {
    const response = await context.request.post(`${base}/admin/members/${user.membershipApplication.id}/${action}`, { headers: { Authorization: `Bearer ${adminToken}` }, data: {} }); assert.equal(response.status(), 200);
  }
  assert.equal((await context.request.post(base + '/auth/otp/request', { data: { purpose: 'LOGIN', email } })).status(), 200);
  const login = await context.request.post(base + '/auth/otp/verify', { data: { purpose: 'LOGIN', email, code: await deliveredCode('LOGIN') } }); assert.equal(login.status(), 200);
  await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), (await login.json()).data.accessToken);
  await page.goto(site + '/dashboard/profile');
  await page.getByText(payload.communicationAddress, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Profile' });
  assert.equal(await dialog.getByLabel('Permanent Address').inputValue(), payload.permanentAddress);
  await dialog.getByLabel('Communication Address').fill('tiny');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await dialog.getByText('Enter 5–1,000 characters for the address.').waitFor();
  await dialog.getByLabel('Communication Address').fill('30 Updated Road\nChennai 600002');
  await page.route('**/members/me/profile', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Try saving again', errors: [] }) }) : route.continue());
  await dialog.getByRole('button', { name: 'Save Changes' }).click(); await dialog.getByText('Try saving again').waitFor();
  assert.equal(await dialog.getByLabel('Communication Address').inputValue(), '30 Updated Road\nChennai 600002');
  await page.unroute('**/members/me/profile'); await page.setViewportSize({ width: 390, height: 844 }); await shot('address-edit-mobile');
  await dialog.getByLabel('Permanent Address').fill(''); await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await dialog.waitFor({ state: 'hidden' }); await page.reload();
  await page.getByText('30 Updated Road\nChennai 600002', { exact: true }).waitFor();
  const saved = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } }); assert.equal(saved.permanentAddress, null);
  await shot('address-profile-mobile');
  checks.push('Admin review and member details display saved fields; address editing, validation, failed-save recovery, clearing and reload work on mobile');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ passed: checks.length, checks, output }, null, 2));
}
run().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  const stored = await prisma.fileObject.findMany({ where: { id: { in: files } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files } } });
  await Promise.all(stored.map(file => fs.unlink(assertSafePath(file.storageKey)).catch(() => undefined)));
  await prisma.emailOtp.deleteMany({ where: { email } }); await prisma.$disconnect();
});
