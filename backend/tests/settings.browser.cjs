// Only run against an isolated database/API, with SMTP disabled.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { hashPassword } = require('../dist/utils/security');
const site = process.env.SETTINGS_WEB_URL || 'http://127.0.0.1:5179', base = process.env.SETTINGS_API_URL || 'http://127.0.0.1:5007/api/v1';
const out = process.env.SETTINGS_SCREENSHOT_DIR || '/private/tmp/ifsmhp-settings-browser';
const checks = [], errors = [];
let user, otherAdmin, otherToken, browser, context, page, token, original, revisions;
async function api(url, method = 'GET', body, accessToken = token) { const r = await context.request.fetch(base + url, { method, headers: { Authorization: `Bearer ${accessToken}` }, ...(body ? { data: body } : {}) }); const j = await r.json(); assert.ok(r.ok(), JSON.stringify(j)); return j.data; }
const ready = () => page.getByRole('heading', { name: 'Organization Identity', exact: true }).waitFor();
async function tab(name) { await page.getByRole('button', { name: new RegExp('^' + name) }).click(); }
async function save(name, expected = 200) { const wait = page.waitForResponse(r => r.url().includes('/admin/settings/') && r.request().method() === 'PATCH'); await page.getByRole('button', { name: 'Save ' + name, exact: true }).first().click(); const r = await wait; assert.equal(r.status(), expected); if (expected === 200) await page.getByRole('status').filter({ hasText: 'Settings saved.' }).waitFor(); return r; }
async function shot(name) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' horizontal overflow'); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: false }); }
async function externalSave(section, values) {
  const snapshot = await api('/admin/settings', 'GET', undefined, otherToken);
  return api('/admin/settings/' + section, 'PATCH', { expectedRevision: snapshot.sections[section].revision, values }, otherToken);
}
async function refresh() {
  const response = page.waitForResponse(r => r.url().endsWith('/admin/settings') && r.request().method() === 'GET');
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await response;
  // A UI round trip lets React commit the refresh before the next interaction.
  await tab('Membership'); await tab('General');
}
async function reviewConflict() {
  await page.getByRole('button', { name: 'Load latest values', exact: true }).click();
  await page.getByRole('button', { name: 'I have reviewed the latest values', exact: true }).click();
}
async function run() {
  const database = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && database.pathname.endsWith('_test'), 'Use an explicitly configured isolated local test database');
  await fs.mkdir(out, { recursive: true }); original = await prisma.platformSetting.findMany(); revisions = await prisma.settingRevision.findMany();
  user = await prisma.user.create({ data: { email: `settings-browser-${crypto.randomUUID()}@example.test`, fullName: 'Settings Browser Reviewer', role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword('Browser-settings-2026!') } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) }); context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  otherAdmin = await prisma.user.create({ data: { email: `settings-other-${crypto.randomUUID()}@example.test`, fullName: 'Other Settings Reviewer', role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword('Browser-settings-2026!') } });
  const otherLogin = await context.request.post(base + '/auth/login', { data: { email: otherAdmin.email, password: 'Browser-settings-2026!' } }); assert.equal(otherLogin.status(), 200); otherToken = (await otherLogin.json()).data.accessToken;
  const login = await context.request.post(base + '/auth/login', { data: { email: user.email, password: 'Browser-settings-2026!' } }); assert.equal(login.status(), 200); token = (await login.json()).data.accessToken;
  page = await context.newPage(); await page.goto(site + '/login'); await page.evaluate(t => localStorage.setItem('ifsmhp.accessToken', t), token); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/admin/settings', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Settings temporarily unavailable' }) }));
  await page.goto(site + '/admin/settings');
  await page.getByRole('alert').filter({ hasText: 'Settings temporarily unavailable' }).waitFor();
  assert.equal(await page.getByLabel('Short name / acronym').count(), 0);
  await page.unroute('**/api/v1/admin/settings'); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await ready();
  checks.push('Initial API failure shows an error without mock values and Retry loads real settings');
  await page.getByLabel('Short name / acronym', { exact: true }).fill('Research Forum');
  await page.getByLabel('Contact email', { exact: true }).fill('office@example.test'); await page.getByLabel('Contact phone', { exact: true }).fill('+44 1234 567890'); await page.getByLabel('Office address', { exact: true }).fill('Research Office\nLondon');
  await page.getByLabel('Default timezone', { exact: true }).fill('Asia/Kolkata'); await page.getByLabel('Formatting locale').selectOption('en-GB'); await page.getByLabel('Date format', { exact: true }).selectOption('YYYY-MM-DD');
  await page.getByLabel('Display a maintenance notice on public pages').check(); await page.getByLabel('Notice message', { exact: true }).fill('Scheduled maintenance notice — all services remain available.');
  await tab('Review & SLA'); await page.getByLabel('Publications: review threshold (days)', { exact: true }).fill('15'); await tab('General'); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'Research Forum'); await save('General');
  await tab('Review & SLA'); assert.equal(await page.getByLabel('Publications: review threshold (days)').inputValue(), '15'); await save('Review & SLA');
  await page.reload(); await ready(); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'Research Forum'); checks.push('Section saves persist, survive reload and preserve drafts in other tabs');
  await shot('settings-desktop');
  await page.getByRole('button', { name: 'Reset to defaults', exact: true }).first().click(); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'IFSMHP'); assert.equal((await api('/admin/settings')).values.general.shortName, 'Research Forum'); await page.reload(); await ready(); checks.push('Reset only changes the draft until saved');
  await page.route('**/api/v1/admin/settings/general', async route => { if (route.request().method() === 'PATCH') { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test service unavailable' }) }); } else await route.continue(); });
  await page.getByLabel('Short name / acronym').fill('Preserved after failure'); await save('General', 503); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'Preserved after failure'); await page.unroute('**/api/v1/admin/settings/general'); await save('General'); checks.push('Recoverable failures preserve inputs and retry succeeds');
  await page.getByLabel('Default timezone').fill('Invalid/Zone'); await save('General', 422); await page.getByText('Choose a valid IANA timezone.', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Default timezone').inputValue(), 'Invalid/Zone'); await page.getByLabel('Default timezone').fill('Asia/Kolkata');
  await page.getByLabel('Short name / acronym').fill('Concurrent draft'); const current = await api('/admin/settings'); await api('/admin/settings/general', 'PATCH', { expectedRevision: current.sections.general.revision, values: { shortName: 'Other reviewer' } }); await save('General', 409); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'Concurrent draft'); await page.getByRole('button', { name: 'Load latest values', exact: true }).click(); await page.getByRole('button', { name: 'I have reviewed the latest values', exact: true }).click(); await save('General'); assert.equal((await api('/admin/settings')).values.general.shortName, 'Concurrent draft'); checks.push('Validation and concurrent-tab conflicts preserve drafts and require explicit review');
  // Saving another section must refresh clean drafts, not turn stale values into new edits.
  await externalSave('review', { publicationDays: 23 });
  await page.getByLabel('Short name / acronym').fill('Clean sections refreshed'); await save('General');
  await tab('Review & SLA'); assert.equal(await page.getByLabel('Publications: review threshold (days)').inputValue(), '23');
  await save('Review & SLA'); assert.equal((await api('/admin/settings')).values.review.publicationDays, 23);
  checks.push('A save adopts another administrator’s changes in untouched sections');

  // Repeated focus refreshes must not silently adopt a revision just because values coincide.
  await tab('General'); await page.getByLabel('Short name / acronym').fill('Coincident draft');
  await externalSave('general', { shortName: 'Coincident draft' });
  await refresh(); await refresh();
  await page.getByLabel('Short name / acronym').fill('My later edit'); await save('General', 409);
  assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'My later edit');
  await reviewConflict(); await save('General');
  checks.push('Repeated refreshes preserve the original draft baseline and require conflict review');

  // Reviewing one conflict must not authorize overwriting an unrelated dirty section.
  await page.getByLabel('Short name / acronym').fill('Reviewed general draft');
  await tab('Review & SLA'); await page.getByLabel('Publications: review threshold (days)').fill('24');
  await externalSave('general', { shortName: 'Competing general value' });
  await externalSave('review', { publicationDays: 25 });
  await tab('General'); await save('General', 409); await reviewConflict(); await save('General');
  await tab('Review & SLA'); assert.equal(await page.getByLabel('Publications: review threshold (days)').inputValue(), '24');
  await save('Review & SLA', 409); assert.equal((await api('/admin/settings')).values.review.publicationDays, 25);
  await reviewConflict(); await save('Review & SLA');
  checks.push('Conflict review is limited to its section and preserves other unsaved drafts and revisions');
  await tab('General');
  // A read begun before a successful mutation must not overwrite it.
  let release, started; const held = new Promise(r => { release = r; }), pending = new Promise(r => { started = r; }); const old = await api('/admin/settings');
  await page.route('**/api/v1/admin/settings', async route => { if (route.request().method() === 'GET') { started(); await held; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: old }) }).catch(() => {}); } else await route.continue(); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await pending; await page.getByLabel('Short name / acronym').fill('Current saved value'); await save('General'); release(); await page.unroute('**/api/v1/admin/settings'); assert.equal(await page.getByLabel('Short name / acronym').inputValue(), 'Current saved value'); checks.push('Stale reads cannot restore pre-mutation values');
  await tab('Events & Calendar'); await page.getByLabel('Default capacity (0 = unlimited)', { exact: true }).fill('42'); await page.getByLabel('Default reminder (days before event)', { exact: true }).selectOption('7'); await page.getByLabel('Enable registration by default on new events').uncheck(); await save('Events & Calendar');
  await tab('Communications'); await page.getByLabel('Enable SAB preview and sign-off by default for new drafts').check(); await save('Communications');
  await tab('Security & Privacy'); await page.getByLabel('DPO / privacy contact email').fill('privacy@example.test'); await save('Security & Privacy');
  await tab('Membership'); await page.getByLabel('Pending → start review (calendar days)').fill('6'); await save('Membership');
  const persisted = (await api('/admin/settings')).values;
  const stored = await prisma.platformSetting.findMany();
  for (const [section, values] of Object.entries(persisted)) for (const [key, value] of Object.entries(values)) {
    const row = stored.find(r => r.section === section && r.key === key); if (row) assert.deepEqual(row.value, value);
  }
  await page.reload(); await ready();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.getByRole('button', { name: 'Use password sign-in', exact: true }).click();
  await page.getByLabel('Email Address', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Browser-settings-2026!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/admin(?:\/settings)?$/); token = await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken'));
  await page.goto(site + '/admin/settings'); await ready();
  assert.deepEqual((await api('/admin/settings')).values, persisted);
  assert.equal(await page.getByLabel('Short name / acronym').inputValue(), persisted.general.shortName);
  for (const [sectionTab, label, value] of [
    ['Membership', 'Pending → start review (calendar days)', persisted.membership.pendingDays],
    ['Events & Calendar', 'Default capacity (0 = unlimited)', persisted.events.capacity],
    ['Review & SLA', 'Publications: review threshold (days)', persisted.review.publicationDays],
    ['Security & Privacy', 'DPO / privacy contact email', persisted.security.privacyEmail],
  ]) { await tab(sectionTab); assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), String(value)); }
  await tab('Communications'); assert.equal(await page.getByLabel('Enable SAB preview and sign-off by default for new drafts').isChecked(), true);
  checks.push('All editable sections persist in MySQL and survive reload and real logout/login');
  await page.goto(site + '/admin/events/new'); await page.getByLabel('Timezone', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Timezone', { exact: true }).inputValue(), 'Asia/Kolkata'); assert.equal(await page.getByLabel(/Capacity/).inputValue(), '42'); checks.push('New event editor inherits persisted defaults');
  await page.goto(site + '/admin/announcements'); await page.getByRole('button', { name: 'New Announcement', exact: true }).click(); const sab = page.getByLabel('Send SAB preview first — wait for sign-off before scheduling full broadcast.', { exact: true }); await sab.waitFor(); await page.waitForFunction(() => document.querySelector('#sab-approval')?.checked === true); checks.push('New announcement inherits the sign-off default');
  const publicPage = await context.newPage(); await publicPage.goto(site + '/contact'); await publicPage.getByText('Scheduled maintenance notice — all services remain available.', { exact: true }).waitFor(); await publicPage.getByRole('link', { name: 'privacy@example.test', exact: true }).waitFor(); await publicPage.close(); checks.push('Public branding, contact and banner use saved values');
  await page.goto(site + '/admin/settings'); await ready(); await tab('Billing & Finance'); assert.equal(await page.getByRole('button', { name: 'Save Billing & Finance', exact: true }).first().isDisabled(), true); await tab('Backup & Audit'); const downloadWait = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export audit (all time, CSV)', exact: true }).click(); const download = await downloadWait; const file = await download.path(); assert.ok((await fs.readFile(file, 'utf8')).includes('PlatformSettingsUpdated')); checks.push('Unavailable sections cannot save; real all-time CSV download works');
  await page.getByRole('link', { name: 'View configuration audit trail', exact: true }).click(); await page.waitForFunction(() => document.querySelector('select[aria-label="Module"]')?.value === 'SETTINGS'); assert.equal(await page.getByRole('combobox', { name: 'Module', exact: true }).inputValue(), 'SETTINGS'); checks.push('Configuration audit link initializes module filter');
  await page.goto(site + '/admin/settings'); await ready(); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().right <= 1); await shot('settings-mobile'); await tab('Events & Calendar'); await page.getByRole('heading', { name: 'Event Defaults & RSVP', exact: true }).scrollIntoViewIfNeeded(); await shot('settings-mobile-events'); checks.push('Desktop and mobile layouts have no horizontal overflow');
  await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.getByRole('heading', { name: 'Sign in to your account', exact: true }).waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('ifsmhp.accessToken')), null); assert.equal(await page.getByLabel('Default capacity (0 = unlimited)', { exact: true }).count(), 0); await shot('settings-access-revoked'); checks.push('Session revocation clears protected settings and redirects to sign-in');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); if (page) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); await fs.writeFile(path.join(out, 'failure.html'), await page.content()).catch(() => {}); } process.exitCode = 1; }).finally(async () => {
  if (context) await context.close(); if (browser) await browser.close();
  if (original) { await prisma.platformSetting.deleteMany(); if (original.length) await prisma.platformSetting.createMany({ data: original }); await prisma.settingRevision.deleteMany(); if (revisions.length) await prisma.settingRevision.createMany({ data: revisions }); }
  for (const account of [user, otherAdmin].filter(Boolean)) { await prisma.auditLog.deleteMany({ where: { actorId: account.id } }); await prisma.user.delete({ where: { id: account.id } }); } await prisma.$disconnect();
});
