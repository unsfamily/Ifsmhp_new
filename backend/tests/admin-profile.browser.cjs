// Run only against an isolated MySQL database and API. SMTP must be disabled or stubbed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { hashPassword } = require('../dist/utils/security');
const sharp = require('sharp');
const site = process.env.PROFILE_WEB_URL || 'http://127.0.0.1:5179';
const base = process.env.PROFILE_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.PROFILE_SCREENSHOT_DIR || '/private/tmp/ifsmhp-profile-browser';
const prefix = `profile-browser-${crypto.randomUUID().slice(0, 8)}`;
const password = 'Browser-profile-2026!';
const checks = [], errors = [];
let user, browser, page, context, token;
async function api(url, method = 'GET', body) {
  const response = await context.request.fetch(base + url, { method, headers: { Authorization: `Bearer ${token}` }, ...(body ? { data: body } : {}) });
  const json = await response.json(); assert.ok(response.ok(), JSON.stringify(json)); return json.data;
}
async function ready() { await page.getByRole('button', { name: 'Save Profile', exact: true }).waitFor(); await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Profile'); return b && !b.matches(':disabled'); }); }
async function save(label) { const wait = page.waitForResponse(r => r.url() === base + '/admin/profile' && r.request().method() === 'PATCH'); await page.getByRole('button', { name: label, exact: true }).click(); const response = await wait; await ready(); return response; }
async function shot(name, fullPage = false) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': horizontal overflow'); await page.screenshot({ path: path.join(output, name + '.png'), fullPage }); }
async function run() {
  await fs.mkdir(output, { recursive: true });
  user = await prisma.user.create({ data: { email: `${prefix}@example.test`, fullName: 'Alex Researcher', role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword(password) } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const login = await context.request.post(base + '/auth/login', { data: { email: user.email, password } }); assert.equal(login.status(), 200); token = (await login.json()).data.accessToken;
  await context.addInitScript(t => localStorage.setItem('ifsmhp.accessToken', t), token);
  page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(site + '/admin/profile'); await ready();
  assert.equal(await page.getByLabel(/^First name/).inputValue(), ''); await page.getByText('API tokens unavailable', { exact: true }).waitFor();
  await page.getByLabel(/^First name/).fill('Alex'); await page.getByLabel('Last name', { exact: true }).fill('Researcher'); await page.getByLabel('Display name', { exact: true }).fill('Dr. Alex Researcher');
  await page.getByLabel('Professional designation', { exact: true }).selectOption('CRO Lead');
  await page.getByLabel('Job Title', { exact: true }).fill('Research Office Lead'); await page.getByLabel('Work Email', { exact: true }).fill('contact@example.test');
  await page.getByLabel('Office / Institution', { exact: true }).fill('IFSMHP Research Office'); await page.getByLabel('Country', { exact: true }).fill('India'); await page.getByLabel('Working Timezone', { exact: true }).selectOption('Asia/Kolkata');
  await page.getByLabel('ORCID iD', { exact: true }).fill('0000-0002-1825-0097'); await page.getByLabel('Short Bio / Professional Statement', { exact: true }).fill('Supporting scientific collaboration and professional development.');
  await page.getByLabel('New public contact form inquiry', { exact: true }).check(); assert.equal((await save('Save All Changes')).status(), 200);
  const saved = await api('/admin/profile'); assert.equal(saved.profile.workEmail, 'contact@example.test'); assert.equal(saved.account.loginEmail, user.email); assert.equal(saved.preferences.inquiryNew, true);
  await page.reload(); await ready(); assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Dr. Alex Researcher'); assert.equal(await page.getByLabel('New public contact form inquiry', { exact: true }).isChecked(), true); checks.push('Save All persists profile and preferences; reload keeps data and login identity');
  await page.getByLabel('Display name', { exact: true }).fill('Discard this draft'); await page.getByRole('button', { name: 'Discard', exact: true }).click(); assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Dr. Alex Researcher');
  await page.getByRole('button', { name: 'Use defaults', exact: true }).click(); assert.equal(await page.getByLabel('New public contact form inquiry', { exact: true }).isChecked(), false); assert.equal((await api('/admin/profile')).preferences.inquiryNew, true); await save('Save Preferences'); checks.push('Discard restores saved profile; defaults remain unsaved until Save Preferences');
  const image = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#527670' } }).png().toBuffer();
  const avatarResponse = page.waitForResponse(r => r.url() === base + '/admin/profile/avatar' && r.request().method() === 'POST'); await page.getByLabel('Avatar image', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image }); assert.equal((await avatarResponse).status(), 200); await page.getByAltText('Your avatar', { exact: true }).waitFor(); checks.push('Real image upload persists and renders through authenticated blob preview');
  await page.getByLabel('Display name', { exact: true }).fill('Retry draft');
  await page.route('**/api/v1/admin/profile', async route => { if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated recoverable failure', errors: [] }) }); else await route.continue(); });
  assert.equal((await save('Save Profile')).status(), 500); assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Retry draft'); await page.unroute('**/api/v1/admin/profile'); assert.equal((await save('Save Profile')).status(), 200); checks.push('Failed save preserves draft and allows retry without mock success');
  const second = await context.newPage(); await second.goto(site + '/admin/profile'); await second.getByRole('button', { name: 'Save Profile', exact: true }).waitFor(); await second.getByLabel('Display name', { exact: true }).fill('Second tab update');
  const secondSave = second.waitForResponse(r => r.url() === base + '/admin/profile' && r.request().method() === 'PATCH'); await second.getByRole('button', { name: 'Save Profile', exact: true }).click(); assert.equal((await secondSave).status(), 200);
  await page.getByLabel('Display name', { exact: true }).fill('Preserved concurrent draft'); const conflict = page.waitForResponse(r => r.url() === base + '/admin/profile' && r.request().method() === 'PATCH'); await page.getByRole('button', { name: 'Save Profile', exact: true }).click(); assert.equal((await conflict).status(), 409);
  await page.getByRole('button', { name: 'Load latest for review', exact: true }).click(); await page.getByRole('button', { name: 'I have reviewed the latest values', exact: true }).waitFor(); assert.equal(await page.getByLabel('Display name', { exact: true }).inputValue(), 'Preserved concurrent draft'); assert.equal(await page.getByRole('button', { name: 'Save Profile', exact: true }).isEnabled(), false);
  await page.getByText('Latest saved profile and preferences', { exact: true }).click(); await page.getByText('Second tab update', { exact: false }).waitFor(); await page.getByRole('button', { name: 'I have reviewed the latest values', exact: true }).click(); await save('Save Profile'); await second.close(); checks.push('Concurrent tab conflicts preserve the draft and require explicit refreshed-state review');
  // Hold an overview response started before a mutation and release it afterward.
  const old = await api('/admin/profile/overview'); old.security.activeSessions = 777; let release, capturedResolve; const captured = new Promise(r => { capturedResolve = r; }); const held = new Promise(r => { release = r; }); let intercepted = false;
  await page.route('**/api/v1/admin/profile/overview', async route => { if (!intercepted) { intercepted = true; capturedResolve(); await held; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: old }) }); } else await route.continue(); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await captured;
  await page.getByLabel('Display name', { exact: true }).fill('Dr. Alex Researcher'); await save('Save Profile'); release(); await page.waitForTimeout(250); assert.ok(!(await page.locator('body').innerText()).includes('777 active sessions')); await page.unroute('**/api/v1/admin/profile/overview'); checks.push('Responses started before mutations cannot restore outdated overview state');
  // Exercise session controls and credential changes through the page.
  const another = await context.request.post(base + '/auth/login', { data: { email: user.email, password } }); assert.equal(another.status(), 200); const otherToken = (await another.json()).data.accessToken;
  await page.getByRole('button', { name: 'Review', exact: true }).click(); await page.getByRole('dialog').waitFor(); await page.getByRole('button', { name: 'Revoke other sessions', exact: true }).click(); await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click(); await page.waitForTimeout(250); await page.getByRole('button', { name: 'Close', exact: true }).click();
  const deniedOther = await context.request.get(base + '/admin/profile', { headers: { Authorization: `Bearer ${otherToken}` } }); assert.equal(deniedOther.status(), 401);
  await page.getByLabel('Current password', { exact: true }).fill(password); await page.getByLabel('New password (min 14 chars)', { exact: true }).fill('Changed-browser-password-2026!'); await page.getByLabel('Confirm new password', { exact: true }).fill('Changed-browser-password-2026!');
  const changed = page.waitForResponse(r => r.url() === base + '/admin/profile/password'); await page.getByRole('button', { name: 'Update Password', exact: true }).click(); assert.equal((await changed).status(), 200); await ready(); assert.equal(await page.getByLabel('Current password', { exact: true }).inputValue(), ''); assert.equal((await api('/admin/profile')).account.id, user.id); checks.push('Session revocation denies old tokens; password change retains the current browser');
  await page.getByRole('link', { name: 'View my audit log', exact: true }).click(); await page.locator('ol code').filter({ hasText: 'AdminProfileUpdated' }).first().waitFor(); assert.ok(page.url().includes('actorId=' + user.id)); checks.push('Own audit link displays real profile and security events');
  await page.goto(site + '/admin/profile'); await ready(); await page.evaluate(() => scrollTo(0, 0)); await shot('profile-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400); await page.evaluate(() => scrollTo(0, 0)); await shot('profile-mobile'); await shot('profile-mobile-full', true); checks.push('Desktop and mobile preserve the layout without horizontal overflow');
  await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.getByRole('button', { name: 'Save Profile', exact: true }).waitFor({ state: 'hidden' }); assert.ok(!(await page.locator('body').innerText()).includes('contact@example.test')); await shot('profile-access-revoked'); checks.push('Session revocation immediately clears protected profile information');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); if (page) { await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); } process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (user) { const files = await prisma.fileObject.findMany({ where: { uploaderId: user.id } }); await prisma.adminProfile.deleteMany({ where: { userId: user.id } }); await prisma.fileObject.deleteMany({ where: { uploaderId: user.id } }); await prisma.auditLog.deleteMany({ where: { actorId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); await Promise.all(files.map(f => fs.unlink(path.join(process.env.UPLOAD_STORAGE_PATH, f.storageKey)).catch(() => {}))); }
  await prisma.$disconnect();
});
