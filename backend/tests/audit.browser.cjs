// Dedicated MySQL/API only. These fixtures are real business actions, never audit API mocks.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { signAccessToken, sha256 } = require('../dist/utils/security');
const site = process.env.AUDIT_WEB_URL || 'http://127.0.0.1:5178';
const base = process.env.AUDIT_API_URL || 'http://127.0.0.1:5006/api/v1';
const output = process.env.AUDIT_SCREENSHOT_DIR || '/private/tmp/ifsmhp-audit-browser';
const prefix = `audit-browser-${crypto.randomUUID().slice(0, 8)}`;
const checks = [], errors = [];
let browser, user, session, token, page;
async function api(url, method = 'GET', body) {
  const response = await fetch(`${base}${url}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json(); assert.ok(response.ok, JSON.stringify(json)); return json.data;
}
async function ready(p = page) { await p.getByRole('button', { name: 'Refresh', exact: true }).waitFor(); await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Refresh'); return b && !b.disabled; }); }
async function snapshot(name, p = page) { assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`); if (name === 'audit-mobile') await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(output, `${name}.png`), fullPage: name === 'audit-mobile' }); }
async function run() {
  await fs.mkdir(output, { recursive: true });
  user = await prisma.user.create({ data: { fullName: `${prefix} Reviewer`, email: `${prefix}@example.test`, role: 'ADMIN', status: 'ACTIVE' } });
  session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  token = signAccessToken({ sub: user.id, sessionId: session.id, role: 'ADMIN' });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), token);
  page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${site}/admin/gallery`);
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: 'New category', exact: true }).click();
  await page.getByPlaceholder('e.g. Spring Symposium 2026').fill(`${prefix} Browser collection`);
  await page.getByRole('button', { name: 'Create category', exact: true }).click();
  await page.getByRole('row').filter({ hasText: `${prefix} Browser collection` }).waitFor();
  const collections = (await api('/admin/gallery/categories?limit=100')).items;
  const target = collections.find(c => c.name === `${prefix} Browser collection`); assert.ok(target);
  await api(`/admin/gallery/categories/${target.id}`, 'PATCH', { published: false });
  for (let i = 0; i < 22; i++) await api('/admin/gallery/categories', 'POST', { name: `${prefix} Page fixture ${i}`, published: false });
  await page.getByRole('link', { name: 'Audit Log', exact: true }).click(); await ready();
  await page.getByRole('textbox', { name: 'Search audit log' }).fill(prefix);
  await page.waitForTimeout(400); await ready();
  await page.getByRole('combobox', { name: 'Module', exact: true }).selectOption('GALLERY'); await ready();
  await page.getByText('Page 1 of 2', { exact: true }).waitFor();
  assert.equal(await page.locator('ol > li').count(), 20);
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 2', { exact: true }).waitFor(); assert.equal(await page.locator('ol > li').count(), 4);
  const changed = page.locator('ol > li').filter({ hasText: 'GalleryCollectionUpdated' }); assert.equal(await changed.count(), 1);
  await changed.getByRole('button', { name: 'Field changes', exact: true }).press('Enter'); await changed.getByText('State Changes (Before → After)', { exact: true }).waitFor();
  await snapshot('audit-desktop'); checks.push('Real browser collection creation appears in persisted audit; server pagination and keyboard details work');
  const waitingDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); const download = await waitingDownload;
  const downloadPath = path.join(output, 'filtered-audit.csv'); await download.saveAs(downloadPath); const csv = await fs.readFile(downloadPath, 'utf8');
  assert.equal((csv.match(/GalleryCollectionCreated/g) || []).length, 23); assert.equal((csv.match(/GalleryCollectionUpdated/g) || []).length, 1); assert.ok(csv.includes('UTC') || csv.includes('T')); checks.push('Authenticated CSV includes every matching row, including page one and page two');
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('oldest'); await ready(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
  assert.ok((await page.locator('ol > li').first().innerText()).includes(target.id));
  const today = new Date().toISOString().slice(0, 10);
  await page.getByLabel('From date (UTC)').fill(today); await ready(); await page.getByLabel('To date (UTC)').fill(today); await ready();
  await page.getByRole('combobox', { name: 'Actor', exact: true }).selectOption('ADMIN'); await ready();
  await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('GalleryCollectionUpdated'); await ready();
  assert.equal(await page.locator('ol > li').count(), 1); checks.push('Combined actor/module/action/UTC date filters and oldest sorting');
  await page.getByLabel('From date (UTC)').fill('2099-01-01'); await page.getByRole('alert').filter({ hasText: 'End date must not precede start date.' }).waitFor();
  await page.getByLabel('From date (UTC)').fill(today); await ready();
  const failureHandler = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Temporary audit outage', errors: [] }) });
  await page.route('**/admin/audit-log?*', failureHandler); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Temporary audit outage' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Search audit log' }).inputValue(), prefix);
  await page.unroute('**/admin/audit-log?*', failureHandler); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await ready(); await page.getByRole('alert').waitFor({ state: 'hidden' }); checks.push('Validation errors and retry preserve entered filters');
  let release, started; const held = new Promise(resolve => { release = resolve; }); const pending = new Promise(resolve => { started = resolve; });
  let hold = true;
  const staleHandler = async route => {
    if (hold && new URL(route.request().url()).searchParams.get('module') === 'GALLERY') { hold = false; const response = await route.fetch(); started(); await held; await route.fulfill({ response }).catch(() => undefined); }
    else await route.continue();
  };
  await page.route('**/admin/audit-log?*', staleHandler); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await pending;
  await page.getByRole('combobox', { name: 'Module', exact: true }).selectOption('EVENT'); await page.getByText('No audit events match these filters.', { exact: true }).waitFor(); release(); await page.waitForTimeout(200);
  assert.equal(await page.locator('ol > li').count(), 0); await page.unroute('**/admin/audit-log?*', staleHandler); checks.push('A response started before filter changes cannot restore stale records');
  await page.getByRole('combobox', { name: 'Module', exact: true }).selectOption('GALLERY'); await ready();
  await page.reload(); await ready(); await page.getByRole('textbox', { name: 'Search audit log' }).fill(target.id); await page.waitForTimeout(400); await ready(); assert.equal(await page.locator('ol > li').count(), 2); checks.push('Records persist after reload');
  const mobile = await context.newPage(); await mobile.setViewportSize({ width: 390, height: 844 }); mobile.setDefaultTimeout(12000);
  await mobile.goto(`${site}/admin/audit-log`); await ready(mobile); await mobile.getByRole('textbox', { name: 'Search audit log' }).fill(target.id); await mobile.waitForTimeout(400); await ready(mobile);
  await mobile.getByRole('heading', { name: 'System Audit Log', exact: true }).scrollIntoViewIfNeeded(); await snapshot('audit-mobile', mobile); checks.push('Desktop and 390px mobile controls have no horizontal overflow');
  await prisma.user.update({ where: { id: user.id }, data: { role: 'MEMBER' } });
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal(await page.locator('ol > li').count(), 0); assert.ok(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled());
  await mobile.getByRole('button', { name: 'Refresh', exact: true }).click(); await mobile.getByRole('alert').waitFor(); assert.equal(await mobile.locator('ol > li').count(), 0);
  await snapshot('audit-access-revoked'); checks.push('Revoking administrator access clears protected records and disables export');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors, output }, null, 2));
}
run().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => undefined); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (user) {
    await prisma.galleryAlbum.deleteMany({ where: { label: { startsWith: prefix } } });
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } }); await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});
