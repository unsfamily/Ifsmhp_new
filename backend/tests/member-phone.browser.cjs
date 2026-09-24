// Run only against an isolated database and API, with SMTP disabled.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256 } = require('../dist/utils/security');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'Use an isolated *_test database');
const site = process.env.PHONE_WEB_URL || 'http://127.0.0.1:5179';
const base = process.env.PHONE_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.PHONE_SCREENSHOT_DIR || '/private/tmp/ifsmhp-phone-browser';
const checks = [], errors = [];
let user, browser, context, page, phone, patches = 0;
async function openEditor() {
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit Profile' }).waitFor();
  phone = page.getByRole('textbox', { name: 'Phone', exact: true });
}
async function paste(text) {
  await phone.focus();
  await page.evaluate(text => navigator.clipboard.writeText(text), text);
  await phone.press('ControlOrMeta+V');
}
async function save(status = 200) {
  const response = page.waitForResponse(r => r.url() === base + '/members/me/profile' && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal((await response).status(), status);
  if (status === 200) await page.getByRole('dialog').waitFor({ state: 'hidden' });
  else await page.getByRole('button', { name: 'Save Changes', exact: true }).waitFor();
}
async function shot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': horizontal overflow');
  await page.screenshot({ path: path.join(output, name + '.png') });
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  user = await prisma.user.create({ data: {
    email: `member-phone-${crypto.randomUUID()}@example.test`, fullName: 'Member Phone Reviewer', role: 'MEMBER', status: 'ACTIVE',
    memberProfile: { create: { professionalType: 'Scientist', institution: 'Test Institute', phone: '+44 1234567890' } },
  } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  // A delivered-code fixture avoids external email; the real verification
  // endpoint issues and stores the browser's session normally.
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await prisma.emailOtp.create({ data: { email: user.email, purpose: 'LOGIN', codeHash: sha256(`LOGIN:${user.email}:${code}`), expiresAt: new Date(Date.now() + 300000) } });
  const login = await context.request.post(base + '/auth/otp/verify', { data: { email: user.email, purpose: 'LOGIN', code } });
  assert.equal(login.status(), 200);
  const token = (await login.json()).data.accessToken;
  await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), token);
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', r => { if (r.url() === base + '/members/me/profile' && r.method() === 'PATCH') patches += 1; });
  await page.goto(site + '/dashboard/profile'); await openEditor();
  assert.equal(await phone.inputValue(), '');
  await page.getByText('Saved phone: +44 1234567890.', { exact: false }).waitFor();
  assert.equal(await phone.getAttribute('maxlength'), '10');
  assert.equal(await phone.getAttribute('inputmode'), 'numeric');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  assert.equal(await phone.evaluate(el => el === document.activeElement), true);
  assert.ok(await phone.evaluate(el => el.getAttribute('aria-describedby').split(' ').some(id => document.getElementById(id)?.textContent.includes('Enter exactly 10 digits'))));
  assert.equal(patches, 0);
  await shot('phone-desktop-validation');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).phone, '+44 1234567890');
  checks.push('Legacy phone stays unchanged; correction is required with accessible error and focus');

  await openEditor();
  await phone.pressSequentially('ab+ -().'); assert.equal(await phone.inputValue(), '');
  await page.keyboard.insertText('１２٣'); assert.equal(await phone.inputValue(), '');
  await phone.pressSequentially('12345'); await phone.press('Tab');
  assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click(); assert.equal(patches, 0);
  await phone.fill('1234567890'); await phone.press('End'); await phone.press('1'); assert.equal(await phone.inputValue(), '1234567890');
  await phone.press('Backspace'); assert.equal(await phone.inputValue(), '123456789');
  await phone.press('0'); assert.equal(await phone.inputValue(), '1234567890');
  checks.push('Typing accepts only digits, caps at ten, permits deletion, and blocks incomplete submission');

  for (const invalid of ['12345678901', '987 654 3210', '+919876543210', 'abcdefghij', '１２３４５６７８９０', '1234567890\n']) {
    await phone.press('ControlOrMeta+A'); await paste(invalid);
    assert.equal(await phone.inputValue(), '1234567890', 'Rejected paste: ' + JSON.stringify(invalid));
    assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  }
  await phone.evaluate(el => el.setSelectionRange(3, 6)); await paste('000');
  assert.equal(await phone.inputValue(), '1230007890');
  await phone.press('End'); await paste('1'); assert.equal(await phone.inputValue(), '1230007890');
  await phone.press('ControlOrMeta+A'); await paste('0123456789'); assert.equal(await phone.inputValue(), '0123456789');
  checks.push('Invalid and overlong paste is rejected intact; valid paste respects selection and leading zeros');

  // Simulate autofill/input events bypassing native maxlength and a text drop.
  await phone.evaluate(el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '12345678901');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await phone.inputValue(), '0123456789');
  await phone.evaluate(el => {
    const dataTransfer = new DataTransfer(); dataTransfer.setData('text/plain', '+123');
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  });
  assert.equal(await phone.inputValue(), '0123456789');
  checks.push('Autofill-style oversized input and invalid text drop cannot bypass validation');

  await page.getByLabel('Institutional / Professional Website', { exact: true }).fill('https://example.test/scientist');
  await page.getByLabel('Google Scholar URL', { exact: true }).fill('https://scholar.google.com/citations?user=test');
  await page.getByLabel('ORCID', { exact: true }).fill('0000-0002-1825-0097');
  await page.route('**/members/me/profile', async route => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test service unavailable' }) });
    else await route.continue();
  });
  await save(503); await page.getByRole('alert').filter({ hasText: 'Test service unavailable' }).waitFor();
  assert.equal(await phone.inputValue(), '0123456789');
  assert.equal(await page.getByLabel('ORCID', { exact: true }).inputValue(), '0000-0002-1825-0097');
  assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).phone, '+44 1234567890');
  await page.unroute('**/members/me/profile');
  await save(); await page.getByText('0123456789', { exact: true }).waitFor();
  const stored = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(stored.phone, '0123456789'); assert.equal(stored.websiteUrl, 'https://example.test/scientist');
  assert.equal(stored.scholarUrl, 'https://scholar.google.com/citations?user=test'); assert.equal(stored.orcid, '0000-0002-1825-0097');
  await page.reload(); await openEditor(); assert.equal(await phone.inputValue(), '0123456789');
  await save(); assert.equal(await prisma.auditLog.count({ where: { actorId: user.id, action: 'UserProfileUpdated' } }), 1);
  checks.push('Failed saves preserve drafts; retry persists every field; reload and unchanged saves behave correctly');

  await page.setViewportSize({ width: 390, height: 844 }); await openEditor();
  await phone.fill('12'); await phone.press('Tab'); await shot('phone-mobile-validation');
  await phone.fill('9876543210'); await save(); await page.reload();
  await page.getByText('9876543210', { exact: true }).waitFor(); await openEditor();
  assert.equal(await phone.inputValue(), '9876543210'); await shot('phone-mobile-saved');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Mobile validation, save, reload, and layout work without horizontal overflow');

  await prisma.memberProfile.update({ where: { userId: user.id }, data: { phone: null } });
  await page.reload(); await openEditor(); assert.equal(await phone.inputValue(), '');
  await page.getByText('No phone number is saved.', { exact: false }).waitFor();
  const previousPatches = patches; await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal(patches, previousPatches); assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  await phone.fill('0000000000'); await save();
  assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } })).phone, '0000000000');
  checks.push('Missing legacy phone requires explicit correction and accepts ten zeros without invented country rules');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (user) {
    await prisma.emailOtp.deleteMany({ where: { email: user.email } });
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});
