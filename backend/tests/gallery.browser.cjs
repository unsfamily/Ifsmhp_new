// Run against a dedicated migrated database and API, never production.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { signAccessToken, sha256 } = require('../dist/utils/security');
const { assertSafePath } = require('../dist/utils/fileStorage');
const site = process.env.GALLERY_WEB_URL || 'http://127.0.0.1:5178';
const base = process.env.GALLERY_API_URL || 'http://127.0.0.1:5006/api/v1';
const output = process.env.GALLERY_SCREENSHOT_DIR || '/private/tmp/ifsmhp-gallery-browser';
const prefix = `gallery-browser-${crypto.randomUUID().slice(0, 8)}`;
const userIds = [], checks = [], errors = [];
let browser, adminPage;
async function actor(role) {
  const user = await prisma.user.create({ data: { fullName: `Gallery ${role}`, email: `${prefix}-${role}@example.test`, role, status: 'ACTIVE' } }); userIds.push(user.id);
  if (role === 'MEMBER') await prisma.memberProfile.create({ data: { userId: user.id, institution: 'Test Institute', professionalType: 'Researcher' } });
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function pageFor(actor, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  if (actor) await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), actor.token);
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => dialog.accept()); return page;
}
async function screenshot(page, name) { await page.waitForFunction(() => Array.from(document.querySelectorAll('main img')).filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0).every(img => img.complete && img.naturalWidth > 0)); await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`); }
async function api(actor, url, method = 'GET', body) {
  const response = await fetch(`${base}${url}`, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data.data;
}
async function ready(page) { await page.getByText('Loading gallery…', { exact: true }).waitFor({ state: 'hidden' }); }
async function status(page, message) { await page.getByRole('status').filter({ hasText: message }).waitFor(); await ready(page); }
const row = (page, text) => page.getByRole('row').filter({ hasText: text });
async function createCollection(page, name) {
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: 'New category', exact: true }).click();
  await page.getByPlaceholder('e.g. Spring Symposium 2026').fill(name);
  await page.getByPlaceholder('Describe the contents of this collection for the homepage heading.').fill('Research event photographs');
  await page.getByRole('button', { name: 'Create category', exact: true }).click();
  await row(page, name).waitFor(); await ready(page);
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  const admin = await actor('ADMIN'), member = await actor('MEMBER');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  adminPage = await pageFor(admin); const memberPage = await pageFor(member); const publicPage = await pageFor();
  await adminPage.goto(`${site}/admin/gallery`); await ready(adminPage);
  const first = `${prefix} Symposium`, second = `${prefix} Awards`;
  await createCollection(adminPage, first); await createCollection(adminPage, second);
  const categories = (await api(admin, '/admin/gallery/categories')).items;
  const a = categories.find(c => c.name === first), b = categories.find(c => c.name === second);
  await row(adminPage, second).getByRole('button', { name: 'Move up', exact: true }).click(); await status(adminPage, 'Collection order updated.');
  checks.push('Create collections and persist collection ordering');
  await screenshot(adminPage, 'collections-desktop');
  await adminPage.getByRole('button', { name: 'Upload Photos', exact: true }).click();
  await adminPage.locator('select').selectOption(a.id);
  const png = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#527e86' } }).png().toBuffer();
  await adminPage.locator('input[type=file]').setInputFiles([{ name: 'symposium-first.png', mimeType: 'image/png', buffer: png }, { name: 'symposium-second.png', mimeType: 'image/png', buffer: png }]);
  await adminPage.getByText('2 successful', { exact: true }).waitFor();
  let photos = (await api(admin, `/admin/gallery/photos?categoryId=${a.id}`)).items; assert.equal(photos.length, 2); assert.ok(photos.every(p => !p.published));
  checks.push('Multiple real uploads finish once each, with draft status and stored image metadata');
  await screenshot(adminPage, 'uploads-desktop');
  await adminPage.getByRole('button', { name: 'Photographs', exact: true }).click(); await ready(adminPage);
  await row(adminPage, 'symposium-second').getByRole('button', { name: 'Reorder up', exact: true }).click(); await status(adminPage, 'Photo order updated.');
  await row(adminPage, 'symposium-first').getByRole('button', { name: 'Edit', exact: true }).click();
  const title = adminPage.getByPlaceholder('Formal title for this photograph'); await title.fill('Published symposium photo');
  await adminPage.getByPlaceholder('Optional narrative caption shown under the thumbnail on the homepage.').fill('A research gathering');
  await adminPage.getByPlaceholder('Describe the image for screen readers and search engines.').fill('Teal image from symposium');
  // A failed save must leave the modal and edited text intact.
  await adminPage.route('**/admin/gallery/photos/*', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test service unavailable', errors: [] }) }) : route.continue());
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await adminPage.locator('form').getByRole('alert').filter({ hasText: 'Test service unavailable' }).waitFor(); assert.equal(await title.inputValue(), 'Published symposium photo');
  await adminPage.unroute('**/admin/gallery/photos/*');
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await status(adminPage, 'Photograph updated.');
  await row(adminPage, 'Published symposium photo').getByRole('button', { name: 'Publish', exact: true }).click(); await status(adminPage, 'Photo status updated.');
  checks.push('Photo reorder, metadata save, failed-save recovery and publish');
  await adminPage.getByPlaceholder('Search title, caption, alt…').fill('Teal');
  await adminPage.waitForResponse(r => r.url().includes('/admin/gallery/photos?') && r.url().includes('search=Teal')); await ready(adminPage);
  assert.equal(await adminPage.locator('tbody tr').count(), 1);
  await adminPage.getByPlaceholder('Search title, caption, alt…').fill('');
  await adminPage.waitForResponse(r => r.url().includes('/admin/gallery/photos?') && r.url().includes('search=&')); await ready(adminPage);
  await row(adminPage, 'Published symposium photo').getByRole('combobox').selectOption(b.id); await status(adminPage, 'Photograph moved.');
  await adminPage.getByRole('combobox').first().selectOption(b.id);
  await adminPage.waitForResponse(r => r.url().includes(`categoryId=${b.id}`)); await ready(adminPage); assert.equal(await adminPage.locator('tbody tr').count(), 1);
  checks.push('Backend search, filtering and collection move');
  await screenshot(adminPage, 'photographs-desktop');
  await adminPage.route('**/admin/gallery/photos?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Gallery list temporarily unavailable', errors: [] }) }));
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click();
  await adminPage.getByRole('alert').filter({ hasText: 'Gallery list temporarily unavailable' }).waitFor();
  await adminPage.unroute('**/admin/gallery/photos?*');
  await adminPage.getByRole('button', { name: 'Retry', exact: true }).click(); await ready(adminPage); await row(adminPage, 'Published symposium photo').waitFor();
  checks.push('List error and retry recover without mock fallback');
  await adminPage.reload(); await ready(adminPage); await adminPage.getByRole('button', { name: 'Photographs', exact: true }).click();
  await row(adminPage, 'Published symposium photo').waitFor();
  await adminPage.waitForFunction(() => Array.from(document.querySelectorAll('tbody img')).some(img => img.alt === 'Teal image from symposium' && img.complete && img.naturalWidth > 0));
  await publicPage.goto(`${site}/#gallery-section`); await publicPage.locator('#gallery-section').getByText('Published symposium photo', { exact: true }).waitFor();
  await memberPage.goto(`${site}/dashboard/gallery`); await memberPage.getByText('Published symposium photo', { exact: true }).waitFor();
  await publicPage.locator('#gallery-section img').scrollIntoViewIfNeeded();
  await publicPage.waitForFunction(() => Array.from(document.querySelectorAll('#gallery-section img')).every(img => img.complete && img.naturalWidth > 0));
  checks.push('Reload persistence, authenticated previews, matching public and member galleries');
  await screenshot(memberPage, 'member-gallery-desktop');
  await adminPage.getByRole('button', { name: 'Categories', exact: true }).click();
  await row(adminPage, second).getByRole('button', { name: 'Toggle published', exact: true }).click(); await status(adminPage, 'Collection status updated.');
  await publicPage.reload(); await ready(publicPage); assert.equal(await publicPage.getByText('Published symposium photo', { exact: true }).count(), 0);
  await row(adminPage, second).getByRole('button', { name: 'Toggle published', exact: true }).click(); await status(adminPage, 'Collection status updated.');
  checks.push('Collection publication controls public visibility');
  const mobile = await pageFor(admin, true); await mobile.goto(`${site}/admin/gallery`); await ready(mobile); await screenshot(mobile, 'collections-mobile');
  await mobile.getByRole('button', { name: 'Photographs', exact: true }).click(); await screenshot(mobile, 'photographs-mobile');
  const memberMobile = await pageFor(member, true); await memberMobile.goto(`${site}/dashboard/gallery`); await memberMobile.getByText('Published symposium photo', { exact: true }).waitFor(); await screenshot(memberMobile, 'member-gallery-mobile');
  checks.push('Desktop and mobile layouts without horizontal page overflow');
  const template = await prisma.galleryItem.findUniqueOrThrow({ where: { id: photos[0].id } });
  const { id: templateId, ...templateFields } = template; void templateId;
  const bulkIds = Array.from({ length: 104 }, () => crypto.randomUUID());
  await prisma.galleryItem.createMany({ data: bulkIds.map((id, n) => ({ ...templateFields, id, title: `Bulk photograph ${String(n).padStart(3, '0')}`, displayOrder: n + 3 })) });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  await adminPage.getByRole('button', { name: 'Photographs', exact: true }).click();
  await row(adminPage, 'Bulk photograph 103').waitFor(); assert.equal(await adminPage.locator('tbody tr').count(), 106);
  await prisma.galleryItem.deleteMany({ where: { id: { in: bulkIds } } });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  checks.push('Admin consumes all API pages beyond 100 photographs');

  // Invalid upload and server failure must not stall the next task.
  await adminPage.getByRole('button', { name: 'Upload Photos', exact: true }).click(); await adminPage.locator('select').selectOption(a.id);
  let rejected = false;
  await adminPage.route('**/admin/gallery/photos', route => { if (route.request().method() === 'POST' && !rejected) { rejected = true; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary upload failure', errors: [] }) }); } return route.continue(); });
  await adminPage.locator('input[type=file]').setInputFiles([{ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') }, { name: 'failure.png', mimeType: 'image/png', buffer: png }, { name: 'recovery.png', mimeType: 'image/png', buffer: png }]);
  await adminPage.getByText('Temporary upload failure', { exact: true }).waitFor(); await adminPage.getByText('1 successful', { exact: true }).waitFor(); await adminPage.getByText('2 rejected', { exact: true }).waitFor(); await adminPage.unroute('**/admin/gallery/photos');
  checks.push('Invalid files and failed uploads do not stall subsequent tasks');
  await adminPage.getByRole('button', { name: 'Photographs', exact: true }).click(); await ready(adminPage);
  await row(adminPage, 'Published symposium photo').getByRole('button', { name: 'Delete', exact: true }).click(); await status(adminPage, 'Photograph deleted.');
  assert.equal(await row(adminPage, 'Published symposium photo').count(), 0);
  await adminPage.getByRole('button', { name: 'Categories', exact: true }).click(); await row(adminPage, first).getByRole('button', { name: 'Delete category', exact: true }).click(); await status(adminPage, 'Collection deleted.');
  assert.equal((await api(admin, `/admin/gallery/photos?categoryId=${a.id}`)).items.length, 0);
  await adminPage.reload(); await ready(adminPage); assert.equal(await row(adminPage, first).count(), 0);
  checks.push('Immediate photo deletion and persisted collection cascade deletion');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ passed: checks.length, checks, output }, null, 2));
}
run().catch(async error => { console.error(error); if (adminPage) { console.error((await adminPage.locator('main').innerText()).slice(-6000)); await adminPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); } process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await prisma.galleryAlbum.deleteMany({ where: { label: { startsWith: prefix } } });
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: userIds } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } }); await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
});
