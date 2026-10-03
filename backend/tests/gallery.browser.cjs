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
  await adminPage.getByRole('button', { name: 'Upload Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(a.id);
  const png = await sharp({ create: { width: 640, height: 400, channels: 3, background: '#527e86' } }).png().toBuffer();
  await adminPage.locator('input[type=file]').setInputFiles([{ name: 'symposium-first.png', mimeType: 'image/png', buffer: png }, { name: 'symposium-second.png', mimeType: 'image/png', buffer: png }]);
  await adminPage.getByText('2 successful', { exact: true }).waitFor();
  let photos = (await api(admin, `/admin/gallery/photos?categoryId=${a.id}`)).items; assert.equal(photos.length, 2); assert.ok(photos.every(p => !p.published));
  checks.push('Multiple real uploads finish once each, with draft status and stored image metadata');
  await screenshot(adminPage, 'uploads-desktop');
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click(); await ready(adminPage);
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
  await adminPage.reload(); await ready(adminPage); await adminPage.getByRole('button', { name: 'Media', exact: true }).click();
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
  await mobile.getByRole('button', { name: 'Media', exact: true }).click(); await screenshot(mobile, 'photographs-mobile');
  const memberMobile = await pageFor(member, true); await memberMobile.goto(`${site}/dashboard/gallery`); await memberMobile.getByText('Published symposium photo', { exact: true }).waitFor(); await screenshot(memberMobile, 'member-gallery-mobile');
  checks.push('Desktop and mobile layouts without horizontal page overflow');
  const template = await prisma.galleryItem.findUniqueOrThrow({ where: { id: photos[0].id } });
  const { id: templateId, ...templateFields } = template; void templateId;
  const bulkIds = Array.from({ length: 104 }, () => crypto.randomUUID());
  await prisma.galleryItem.createMany({ data: bulkIds.map((id, n) => ({ ...templateFields, id, title: `Bulk photograph ${String(n).padStart(3, '0')}`, displayOrder: n + 3 })) });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click();
  await row(adminPage, 'Bulk photograph 103').waitFor(); assert.equal(await adminPage.locator('tbody tr').count(), 106);
  await prisma.galleryItem.deleteMany({ where: { id: { in: bulkIds } } });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  checks.push('Admin consumes all API pages beyond 100 photographs');

  // Invalid upload and server failure must not stall the next task.
  await adminPage.getByRole('button', { name: 'Upload Media', exact: true }).click(); await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(a.id);
  let rejected = false;
  await adminPage.route('**/admin/gallery/photos', route => { if (route.request().method() === 'POST' && !rejected) { rejected = true; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary upload failure', errors: [] }) }); } return route.continue(); });
  await adminPage.locator('input[type=file]').setInputFiles([{ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') }, { name: 'failure.png', mimeType: 'image/png', buffer: png }, { name: 'recovery.png', mimeType: 'image/png', buffer: png }]);
  await adminPage.getByText('Temporary upload failure', { exact: true }).waitFor(); await adminPage.getByText('1 successful', { exact: true }).waitFor(); await adminPage.getByText('2 rejected', { exact: true }).waitFor(); await adminPage.unroute('**/admin/gallery/photos');
  checks.push('Invalid files and failed uploads do not stall subsequent tasks');
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click(); await ready(adminPage);
  await row(adminPage, 'Published symposium photo').getByRole('button', { name: 'Delete', exact: true }).click(); await status(adminPage, 'Photograph deleted.');
  assert.equal(await row(adminPage, 'Published symposium photo').count(), 0);
  await adminPage.getByRole('button', { name: 'Categories', exact: true }).click(); await row(adminPage, first).getByRole('button', { name: 'Delete category', exact: true }).click(); await status(adminPage, 'Collection deleted.');
  assert.equal((await api(admin, `/admin/gallery/photos?categoryId=${a.id}`)).items.length, 0);
  await adminPage.reload(); await ready(adminPage); assert.equal(await row(adminPage, first).count(), 0);
  checks.push('Immediate photo deletion and persisted collection cascade deletion');
  // Subcategory management and optional photo assignments.
  const categoryRow = name => adminPage.getByRole('row').filter({ hasText: name }).filter({ has: adminPage.getByRole('button', { name: 'Edit category', exact: true }) });
  const subRow = name => adminPage.getByRole('row').filter({ hasText: name }).filter({ has: adminPage.getByRole('button', { name: 'Edit subcategory', exact: true }) });
  const eventsName = `${prefix} Events`, projectsName = `${prefix} Projects`;
  await createCollection(adminPage, eventsName); await createCollection(adminPage, projectsName);
  let currentCategories = (await api(admin, '/admin/gallery/categories')).items;
  const events = currentCategories.find(c => c.name === eventsName), projects = currentCategories.find(c => c.name === projectsName);
  await categoryRow(eventsName).getByRole('button', { name: 'Add subcategory', exact: true }).click();
  assert.equal(await adminPage.getByLabel('Parent category', { exact: true }).inputValue(), events.id);
  await adminPage.getByLabel('Subcategory name', { exact: true }).fill('Conferences');
  await adminPage.getByRole('button', { name: 'Create subcategory', exact: true }).click(); await status(adminPage, 'Subcategory created.');
  assert.ok(await categoryRow(eventsName).getByRole('button', { name: 'Delete category', exact: true }).isDisabled());
  await categoryRow(eventsName).getByRole('button', { name: 'Add subcategory', exact: true }).click();
  await adminPage.getByLabel('Subcategory name', { exact: true }).fill(' conferences ');
  await adminPage.getByRole('button', { name: 'Create subcategory', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('alert').waitFor();
  assert.equal(await adminPage.getByLabel('Subcategory name', { exact: true }).inputValue(), ' conferences ');
  await adminPage.getByRole('button', { name: 'Cancel', exact: true }).click();
  await subRow('Conferences').getByRole('button', { name: 'Edit subcategory', exact: true }).click();
  await adminPage.getByLabel('Subcategory name', { exact: true }).fill('Workshops');
  await adminPage.route('**/admin/gallery/subcategories/*', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Subcategory save unavailable', errors: [] }) }) : route.continue());
  await adminPage.getByRole('button', { name: 'Save subcategory', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('alert').filter({ hasText: 'Subcategory save unavailable' }).waitFor();
  assert.equal(await adminPage.getByLabel('Subcategory name', { exact: true }).inputValue(), 'Workshops');
  await adminPage.unroute('**/admin/gallery/subcategories/*');
  await adminPage.getByRole('button', { name: 'Save subcategory', exact: true }).click(); await status(adminPage, 'Subcategory updated.');
  const sub = (await api(admin, `/admin/gallery/subcategories?categoryId=${events.id}`)).items[0];
  await screenshot(adminPage, 'subcategories-desktop');
  await adminPage.getByRole('button', { name: 'Upload Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(events.id);
  await adminPage.getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption(sub.id);
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(projects.id);
  assert.equal(await adminPage.getByRole('combobox', { name: 'Subcategory', exact: true }).inputValue(), '');
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(events.id);
  await adminPage.getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption(sub.id);
  await adminPage.locator('input[type=file]').setInputFiles([{ name: 'subcategory-photo.png', mimeType: 'image/png', buffer: png }]);
  await adminPage.getByText('1 successful', { exact: true }).waitFor();
  const assigned = (await api(admin, `/admin/gallery/photos?subcategoryId=${sub.id}`)).items[0];
  assert.equal(assigned.categoryId, events.id);
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Filter category', exact: true }).selectOption(events.id); await ready(adminPage);
  await adminPage.getByRole('combobox', { name: 'Filter subcategory', exact: true }).selectOption(sub.id); await ready(adminPage);
  await row(adminPage, 'subcategory-photo').waitFor();
  assert.ok((await row(adminPage, 'subcategory-photo').innerText()).includes(`${eventsName} / Workshops`));
  await row(adminPage, 'subcategory-photo').getByRole('button', { name: 'Edit', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption('');
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await status(adminPage, 'Photograph updated.');
  await adminPage.getByRole('combobox', { name: 'Filter subcategory', exact: true }).selectOption('none'); await ready(adminPage);
  await row(adminPage, 'subcategory-photo').getByRole('button', { name: 'Edit', exact: true }).click();
  await adminPage.getByRole('dialog').getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption(sub.id);
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await status(adminPage, 'Photograph updated.');
  await adminPage.getByRole('button', { name: 'Categories', exact: true }).click();
  assert.ok(await subRow('Workshops').getByRole('button', { name: 'Delete subcategory', exact: true }).isDisabled());
  await subRow('Workshops').getByRole('button', { name: 'Edit subcategory', exact: true }).click();
  await adminPage.getByLabel('Parent category', { exact: true }).selectOption(projects.id);
  await adminPage.getByRole('button', { name: 'Save subcategory', exact: true }).click(); await status(adminPage, 'Subcategory updated.');
  await adminPage.reload(); await ready(adminPage);
  assert.ok((await subRow('Workshops').innerText()).includes(`Subcategory of ${projectsName}`));
  assert.equal((await api(admin, `/admin/gallery/photos?subcategoryId=${sub.id}`)).items[0].categoryId, projects.id);
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 0);
  await screenshot(adminPage, 'subcategories-mobile');
  await subRow('Workshops').getByRole('button', { name: 'Edit subcategory', exact: true }).click();
  assert.equal(await adminPage.getByLabel('Parent category', { exact: true }).inputValue(), projects.id);
  await screenshot(adminPage, 'subcategory-dialog-mobile');
  await adminPage.getByRole('button', { name: 'Cancel', exact: true }).click();
  await adminPage.setViewportSize({ width: 1440, height: 1000 });
  await prisma.gallerySubcategory.createMany({ data: Array.from({ length: 104 }, (_, n) => ({ categoryId: events.id, name: `Paginated ${String(n).padStart(3, '0')}` })) });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  await subRow('Paginated 103').waitFor();
  assert.equal(await adminPage.getByRole('button', { name: 'Edit subcategory', exact: true }).count(), 105);
  await api(admin, `/admin/gallery/photos/${assigned.id}`, 'PATCH', { subcategoryId: null });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  await subRow('Workshops').getByRole('button', { name: 'Delete subcategory', exact: true }).click(); await status(adminPage, 'Subcategory deleted.');
  assert.equal((await api(admin, `/admin/gallery/photos?categoryId=${projects.id}`)).items[0].subcategoryId, null);
  checks.push('Subcategory hierarchy, validation, failed-save recovery, optional upload/edit assignment, filters, atomic reparenting, deletion guards, pagination, reload and mobile layout');
  // Public and member pages share the complete published category/subcategory tree.
  const publicSub = await api(admin, '/admin/gallery/subcategories', 'POST', { name: 'Conferences', categoryId: events.id });
  const otherSub = await api(admin, '/admin/gallery/subcategories', 'POST', { name: 'Conferences', categoryId: projects.id });
  await api(admin, '/admin/gallery/subcategories', 'POST', { name: 'Empty subcategory', categoryId: events.id });
  await api(admin, `/admin/gallery/photos/${assigned.id}`, 'PATCH', { categoryId: events.id, subcategoryId: publicSub.id, title: 'Public nested photo', published: true });
  const sourcePhoto = await prisma.galleryItem.findUniqueOrThrow({ where: { id: assigned.id } });
  const { id: sourceId, ...sourceFields } = sourcePhoto; void sourceId;
  await prisma.galleryItem.create({ data: { ...sourceFields, subcategoryId: null, title: 'Category-only photo', displayOrder: 2 } });
  await prisma.galleryItem.create({ data: { ...sourceFields, albumId: projects.id, subcategoryId: otherSub.id, title: 'Other parent photo', displayOrder: 1 } });
  const privateCategory = await api(admin, '/admin/gallery/categories', 'POST', { name: `${prefix} Private`, published: false });
  await api(admin, '/admin/gallery/subcategories', 'POST', { name: 'Private subcategory', categoryId: privateCategory.id });
  for (const [page, url, sectionId] of [[publicPage, `${site}/#gallery-section`, 'gallery-section'], [memberPage, `${site}/dashboard/gallery`, 'member-gallery-view']]) {
    await page.goto(url); await page.reload(); await ready(page);
    const gallery = page.locator(`#${sectionId}`);
    const eventGroup = gallery.getByRole('region', { name: eventsName, exact: true });
    const projectGroup = gallery.getByRole('region', { name: projectsName, exact: true });
    await eventGroup.getByRole('heading', { name: 'Conferences', exact: true }).waitFor();
    await projectGroup.getByRole('heading', { name: 'Conferences', exact: true }).waitFor();
    await eventGroup.getByRole('heading', { name: 'Empty subcategory', exact: true }).waitFor();
    await eventGroup.getByRole('heading', { name: 'Paginated 103', exact: true }).waitFor();
    assert.equal(await gallery.getByRole('button', { name: privateCategory.name, exact: true }).count(), 0);
    assert.equal(await gallery.getByText('Private subcategory', { exact: true }).count(), 0);
    assert.equal(await eventGroup.getByRole('button', { name: 'Open Other parent photo', exact: true }).count(), 0);
    await gallery.getByRole('button', { name: eventsName, exact: true }).click();
    await gallery.getByRole('navigation', { name: 'Browse subcategories' }).getByRole('button', { name: 'Conferences', exact: true }).click();
    await gallery.getByRole('button', { name: 'Open Public nested photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Public nested photo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
    assert.equal(await gallery.getByRole('button', { name: 'Open Category-only photo', exact: true }).count(), 0);
    await gallery.getByRole('button', { name: 'All subcategories', exact: true }).click();
    await gallery.getByRole('button', { name: 'Open Category-only photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Category-only photo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
    await page.getByRole('dialog', { name: 'Public nested photo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
    await gallery.getByRole('button', { name: 'Empty subcategory', exact: true }).click();
    await gallery.getByText('No published photographs in this subcategory yet.', { exact: true }).waitFor();
    await gallery.getByRole('button', { name: second, exact: true }).click();
    await gallery.getByRole('heading', { name: second, exact: true }).waitFor();
    await gallery.getByText('No published photographs in this category yet.', { exact: true }).waitFor();
    await gallery.getByRole('button', { name: projectsName, exact: true }).click();
    await gallery.getByRole('button', { name: 'Open Other parent photo', exact: true }).waitFor();
    await gallery.scrollIntoViewIfNeeded(); await screenshot(page, `${sectionId}-hierarchy-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    if (sectionId === 'member-gallery-view') await page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 0);
    await gallery.getByRole('button', { name: 'Conferences', exact: true }).click();
    await screenshot(page, `${sectionId}-hierarchy-mobile`);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await api(admin, `/admin/gallery/subcategories/${otherSub.id}`, 'PATCH', { name: 'Moved conferences', categoryId: events.id });
  await memberPage.reload(); await ready(memberPage);
  await memberPage.getByRole('region', { name: eventsName, exact: true }).getByRole('heading', { name: 'Moved conferences', exact: true }).waitFor();
  await api(admin, `/admin/gallery/categories/${events.id}`, 'PATCH', { published: false });
  await publicPage.reload(); await ready(publicPage); await memberPage.reload(); await ready(memberPage);
  for (const page of [publicPage, memberPage]) {
    assert.equal(await page.getByRole('region', { name: eventsName, exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Open Public nested photo', exact: true }).count(), 0);
  }
  checks.push('Public/member hierarchy with empty groups, same-named subcategories, pagination, filters, correct lightbox order, reparenting, publication and responsive layouts');
  await adminPage.reload(); await ready(adminPage);
  const detailsCategoryName = `${prefix} Upload metadata`;
  await createCollection(adminPage, detailsCategoryName);
  const detailsCategory = (await api(admin, '/admin/gallery/categories')).items.find(c => c.name === detailsCategoryName);
  const detailsSubcategory = await api(admin, '/admin/gallery/subcategories', 'POST', { name: 'Details', categoryId: detailsCategory.id });
  await adminPage.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(adminPage);
  await adminPage.getByRole('button', { name: 'Upload Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(detailsCategory.id);
  await adminPage.getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption(detailsSubcategory.id);
  const uploadName = adminPage.getByLabel('Name (optional)', { exact: true });
  const uploadDescription = adminPage.getByLabel('Description (optional)', { exact: true });
  const metadataCases = [
    { name: '  Batch name  ', description: '  Shared description  ', files: ['details-first.png', 'details-second.png'], expectedTitle: 'Batch name', expectedCaption: 'Shared description' },
    { name: 'Name only', description: '', files: ['details-name.png'], expectedTitle: 'Name only', expectedCaption: '' },
    { name: '', description: 'Description only', files: ['details-description.png'], expectedTitle: 'details-description', expectedCaption: 'Description only' },
    { name: '', description: '', files: ['details-empty.png'], expectedTitle: 'details-empty', expectedCaption: '' },
  ];
  let successfulUploads = 0;
  for (const test of metadataCases) {
    await uploadName.fill(test.name); await uploadDescription.fill(test.description);
    await adminPage.locator('input[type=file]').setInputFiles(test.files.map(name => ({ name, mimeType: 'image/png', buffer: png })));
    successfulUploads += test.files.length;
    await adminPage.getByText(`${successfulUploads} successful`, { exact: true }).waitFor(); await ready(adminPage);
    const records = (await api(admin, `/admin/gallery/photos?categoryId=${detailsCategory.id}`)).items.slice(-test.files.length);
    assert.equal(records.length, test.files.length);
    for (const record of records) {
      assert.equal(record.title, test.expectedTitle); assert.equal(record.caption, test.expectedCaption);
      assert.equal(record.subcategoryId, detailsSubcategory.id); assert.equal(record.published, false);
      const file = await prisma.galleryItem.findUniqueOrThrow({ where: { id: record.id }, include: { file: true } });
      assert.ok(test.files.includes(file.file.originalName));
    }
    assert.equal(await uploadName.inputValue(), test.name); assert.equal(await uploadDescription.inputValue(), test.description);
  }
  const metadataPhotos = (await api(admin, `/admin/gallery/photos?categoryId=${detailsCategory.id}`)).items;
  assert.equal(metadataPhotos[0].title, 'Batch name'); assert.equal(metadataPhotos[0].caption, 'Shared description');
  assert.equal(metadataPhotos[1].title, 'Batch name'); assert.equal(metadataPhotos[1].caption, 'Shared description');
  assert.equal(await uploadName.getAttribute('maxlength'), '191');
  assert.equal(await uploadDescription.getAttribute('maxlength'), '10000');
  await uploadName.fill('Next batch name'); await uploadDescription.fill('Next batch description');
  await screenshot(adminPage, 'upload-details-desktop');
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 0);
  await screenshot(adminPage, 'upload-details-mobile');
  await adminPage.setViewportSize({ width: 1440, height: 1000 });
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Filter category', exact: true }).selectOption(detailsCategory.id); await ready(adminPage);
  await adminPage.reload(); await ready(adminPage);
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click();
  const firstDetailsRow = row(adminPage, 'Batch name').first();
  await firstDetailsRow.getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await adminPage.getByLabel('Name (title)', { exact: true }).inputValue(), 'Batch name');
  assert.equal(await adminPage.getByLabel('Description (caption)', { exact: true }).inputValue(), 'Shared description');
  await adminPage.getByLabel('Name (title)', { exact: true }).fill('Edited upload name');
  await adminPage.getByLabel('Description (caption)', { exact: true }).fill('Edited upload description');
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await status(adminPage, 'Photograph updated.');
  await row(adminPage, 'Edited upload name').getByRole('button', { name: 'Publish', exact: true }).click(); await status(adminPage, 'Photo status updated.');
  for (const [page, url, sectionId] of [[publicPage, `${site}/#gallery-section`, 'gallery-section'], [memberPage, `${site}/dashboard/gallery`, 'member-gallery-view']]) {
    await page.goto(url); await page.reload(); await ready(page);
    const gallery = page.locator(`#${sectionId}`);
    await gallery.getByRole('button', { name: detailsCategoryName, exact: true }).click();
    await gallery.getByRole('button', { name: 'Details', exact: true }).click();
    await gallery.getByRole('button', { name: 'Open Edited upload name', exact: true }).getByText('Edited upload description', { exact: true }).waitFor();
    assert.equal(await gallery.getByRole('button', { name: 'Open Batch name', exact: true }).count(), 0);
    await gallery.getByRole('button', { name: 'Open Edited upload name', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Edited upload name', exact: true });
    await viewer.getByText('Edited upload description', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
  }
  checks.push('Optional upload metadata: four combinations, shared batch snapshots, original filenames, mappings, reload/edit persistence, public/member details and mobile form');
  await adminPage.getByRole('button', { name: 'Upload Media', exact: true }).click();
  await adminPage.getByRole('combobox', { name: 'Default collection', exact: true }).selectOption(detailsCategory.id);
  await adminPage.getByRole('combobox', { name: 'Subcategory', exact: true }).selectOption(detailsSubcategory.id);
  await uploadName.fill('Gallery video'); await uploadDescription.fill('Video description');
  const videoFiles = await Promise.all(['mp4', 'webm'].map(async extension => ({ name: `gallery-video.${extension}`, mimeType: `video/${extension}`, buffer: await fs.readFile(path.join(__dirname, 'fixtures/gallery', `sample.${extension}`)) })));
  await adminPage.locator('input[type=file]').setInputFiles(videoFiles);
  await adminPage.getByText('2 successful', { exact: true }).waitFor(); await ready(adminPage);
  const videos = (await api(admin, `/admin/gallery/photos?categoryId=${detailsCategory.id}`)).items.filter(p => p.type === 'video');
  assert.equal(videos.length, 2); assert.ok(videos.every(p => p.subcategoryId === detailsSubcategory.id && p.caption === 'Video description' && !p.published));
  await adminPage.getByRole('button', { name: 'Media', exact: true }).click(); await ready(adminPage);
  await row(adminPage, 'Gallery video').first().getByRole('button', { name: 'Edit', exact: true }).click();
  await adminPage.waitForFunction(() => { const video = document.querySelector('form video'); return video && video.readyState >= 2 && video.videoWidth === 160; });
  await adminPage.getByLabel('Name (title)', { exact: true }).fill('Edited gallery video');
  await adminPage.getByRole('button', { name: 'Save photograph', exact: true }).click(); await status(adminPage, 'Photograph updated.');
  for (const video of videos) await api(admin, `/admin/gallery/photos/${video.id}`, 'PATCH', { published: true });
  for (const [page, url, sectionId] of [[publicPage, `${site}/#gallery-section`, 'gallery-section'], [memberPage, `${site}/dashboard/gallery`, 'member-gallery-view']]) {
    await page.goto(url); await page.reload(); await ready(page);
    const gallery = page.locator(`#${sectionId}`);
    await gallery.getByRole('button', { name: detailsCategoryName, exact: true }).click();
    for (const title of ['Edited gallery video', 'Gallery video']) {
      await gallery.getByRole('button', { name: `Open ${title}`, exact: true }).click();
      const viewer = page.getByRole('dialog', { name: title, exact: true });
      await viewer.getByText('Video description', { exact: true }).waitFor();
      await page.waitForFunction(() => { const video = document.querySelector('[role=dialog] video'); return video && video.readyState >= 2 && video.videoWidth === 160; });
      await viewer.locator('video').evaluate(async video => { video.muted = true; await video.play(); });
      await page.waitForFunction(() => document.querySelector('[role=dialog] video').currentTime > 0);
      await viewer.locator('video').evaluate(video => { video.pause(); video.currentTime = 1; });
      await page.waitForFunction(() => { const video = document.querySelector('[role=dialog] video'); return !video.seeking && video.currentTime >= 1; });
      await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
    }
  }
  checks.push('Real MP4/WebM batch upload, mappings, authenticated preview/edit, persisted metadata, public/member playback and seeking');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ passed: checks.length, checks, output }, null, 2));
}
run().catch(async error => { console.error(error); if (adminPage) { console.error((await adminPage.locator('main').innerText()).slice(-6000)); await adminPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); } process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await prisma.galleryItem.deleteMany({ where: { album: { label: { startsWith: prefix } } } });
  await prisma.gallerySubcategory.deleteMany({ where: { category: { label: { startsWith: prefix } } } });
  await prisma.galleryAlbum.deleteMany({ where: { label: { startsWith: prefix } } });
  const files = await prisma.fileObject.findMany({ where: { uploaderId: { in: userIds } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } }); await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect();
});
