// Run against an isolated *_test database/API and test upload directory, with SMTP disabled.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const sharp = require('sharp');
const { expect } = require('@playwright/test');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256 } = require('../dist/utils/security');
const { assertSafePath, uploadRoot } = require('../dist/utils/fileStorage');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test') && uploadRoot.includes('test'), 'Use an isolated test database and storage');
const site = process.env.AVATAR_WEB_URL || 'http://127.0.0.1:5187';
const base = process.env.AVATAR_API_URL || 'http://127.0.0.1:5017/api/v1';
const endpoint = base + '/members/me/profile/avatar';
const output = process.env.AVATAR_SCREENSHOT_DIR || '/private/tmp/ifsmhp-avatar-browser';
const ids = [], checks = [], errors = [];
let browser, context, page, uploads = 0;
async function actor(name) {
  const user = await prisma.user.create({ data: { email: `avatar-browser-${crypto.randomUUID()}@example.test`, fullName: name, role: 'MEMBER', status: 'ACTIVE', memberProfile: { create: { professionalType: 'Scientist', institution: 'Research Institute', phone: null } } } });
  ids.push(user.id); return user;
}
async function login(user) {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await prisma.emailOtp.create({ data: { email: user.email, purpose: 'LOGIN', codeHash: sha256(`LOGIN:${user.email}:${code}`), expiresAt: new Date(Date.now() + 300000) } });
  const response = await context.request.post(base + '/auth/otp/verify', { data: { email: user.email, purpose: 'LOGIN', code } });
  assert.equal(response.status(), 200);
  const token = (await response.json()).data.accessToken;
  await page.evaluate(token => window.dispatchEvent(new StorageEvent('storage', { key: 'ifsmhp.accessToken', newValue: token })), token);
}
async function savedImage() {
  const image = page.getByRole('img', { name: 'Your profile image', exact: true });
  await image.waitFor();
  await image.evaluate(img => img.decode());
  return image;
}
async function choose(file) {
  await expect(page.getByLabel('Profile image file', { exact: true })).toBeEnabled();
  await page.getByLabel('Profile image file', { exact: true }).setInputFiles(file);
  await page.getByRole('img', { name: 'Selected profile image preview', exact: true }).waitFor();
}
async function save() {
  const response = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save Image', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByText('Profile image saved successfully.', { exact: true }).waitFor();
  await savedImage();
}
async function shot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false, animations: 'disabled' });
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  const member = await actor('Profile Image Reviewer'), other = await actor('Other Image Reviewer');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url() === endpoint && r.method() === 'POST') uploads++; });
  await page.goto(site + '/login'); await login(member); await page.goto(site + '/dashboard/profile');
  await page.getByRole('button', { name: 'Upload Profile Image', exact: true }).waitFor();
  const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#3b716d' } }).png().toBuffer();
  const file = { name: 'profile.png', mimeType: 'image/png', buffer: png };
  await choose(file); assert.equal(uploads, 0); await shot('desktop-preview');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.getByRole('img', { name: 'Selected profile image preview' }).count(), 0);
  assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: member.id } })).avatarFileId, null);
  checks.push('Preview and Cancel leave the saved profile unchanged');
  for (const invalid of [
    { name: 'image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
    { name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
    { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') },
    { name: 'image.txt', mimeType: 'image/png', buffer: png },
  ]) {
    await page.getByLabel('Profile image file', { exact: true }).setInputFiles(invalid);
    await page.getByRole('alert').filter({ hasText: /Choose|could not be opened/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save Image', exact: true }).count(), 0);
  }
  assert.equal(uploads, 0); checks.push('Invalid files fail client validation without upload requests');
  // Hold the real request long enough to verify the disabled controls deterministically.
  let release, entered;
  const gate = new Promise(r => { release = r; }), started = new Promise(r => { entered = r; });
  await page.route(endpoint, async route => { if (route.request().method() === 'POST') { entered(); await gate; } await route.continue(); });
  await choose(file);
  await page.getByRole('button', { name: 'Save Image', exact: true }).click(); await started;
  assert.equal(await page.getByRole('button', { name: 'Uploading...', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Upload Profile Image', exact: true }).isDisabled(), true);
  await shot('desktop-uploading'); release();
  await page.getByText('Profile image saved successfully.', { exact: true }).waitFor(); await savedImage();
  assert.equal(uploads, 1); await page.unroute(endpoint);
  const first = (await prisma.memberProfile.findUniqueOrThrow({ where: { userId: member.id } })).avatarFileId;
  assert.ok(first); checks.push('Upload loading state prevents duplicate submissions; missing phone does not block upload');
  await page.reload(); await savedImage();
  await page.getByRole('button', { name: 'Change Profile Image', exact: true }).waitFor();
  await shot('desktop-saved');
  // A rejected replacement must preserve the saved photo and the draft for retry.
  await page.route(endpoint, route => route.request().method() === 'POST'
    ? route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Image rejected by server.', errors: [] }) }) : route.continue());
  await choose(file); await page.getByRole('button', { name: 'Save Image', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Image rejected by server.' }).waitFor(); await savedImage();
  assert.equal((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: member.id } })).avatarFileId, first);
  await page.unroute(endpoint); await save();
  assert.notEqual((await prisma.memberProfile.findUniqueOrThrow({ where: { userId: member.id } })).avatarFileId, first);
  checks.push('Failed replacement preserves the saved photo; retry replaces it');
  // Network failure also preserves the draft and never fabricates success.
  await page.route(endpoint, route => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await choose(file); await page.getByRole('button', { name: 'Save Image', exact: true }).click();
  await page.getByRole('alert').waitFor(); await savedImage();
  await page.unroute(endpoint); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  // A lost image can be retried without losing profile details.
  await page.route(endpoint, route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"success":false,"message":"Avatar not found."}' }));
  await page.reload(); await page.getByRole('button', { name: 'Retry image', exact: true }).waitFor();
  await page.unroute(endpoint); await page.getByRole('button', { name: 'Retry image', exact: true }).click(); await savedImage();
  checks.push('Network/upload failures and image load errors offer recovery');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForURL('**/login');
  await login(member); await page.goto(site + '/dashboard/profile'); await savedImage();
  checks.push('Saved image persists through refresh and sign-out/sign-in with a new session');
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await savedImage();
  await expect.poll(() => page.locator('aside').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  await choose(file); await page.getByText('Unsaved image preview', { exact: true }).scrollIntoViewIfNeeded(); await shot('mobile-preview');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await shot('mobile-saved');
  checks.push('Mobile preview and saved state fit without horizontal overflow');
  await choose(file); await login(other);
  await page.getByRole('heading', { name: other.fullName, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Upload Profile Image', exact: true }).waitFor();
  assert.equal(await page.getByRole('img', { name: 'Your profile image', exact: true }).count(), 0);
  assert.equal(await page.getByRole('img', { name: 'Selected profile image preview', exact: true }).count(), 0);
  checks.push('Account switching clears the previous image and unsaved preview');
  assert.deepEqual(errors, []); console.log(JSON.stringify({ checks, uploads, screenshots: output }, null, 2));
}
run().catch(async error => { console.error(error); if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); console.error(await page.locator('body').innerText().catch(() => 'Page unavailable')); } process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: ids } } });
  await prisma.memberProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.fileObject.deleteMany({ where: { uploaderId: { in: ids } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
