// Local browser verification; no mail or global worker execution. Fixtures are removed in finally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
process.env.SMTP_HOST = '';
const { prisma } = require('../dist/config/database');
const { sha256, signAccessToken } = require('../dist/utils/security');
const { assertSafePath } = require('../dist/utils/fileStorage');
const site = process.env.EVENTS_WEB_URL || 'http://127.0.0.1:5176';
const base = process.env.EVENTS_API_URL || 'http://127.0.0.1:5004/api/v1';
const output = process.env.EVENTS_SCREENSHOT_DIR || '/private/tmp/public-events-browser';
const prefix = `public-browser-${crypto.randomUUID().slice(0, 8)}`;
const errors = [];
let browser, admin, page;
async function screenshot(page, name) {
  const dialog = page.getByRole('dialog');
  const hasDialog = await dialog.count();
  if (!hasDialog) await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: !hasDialog });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
  if (hasDialog) assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), `${name}: dialog overflow`);
}
(async () => {
  try {
    await fs.mkdir(output, { recursive: true });
    admin = await prisma.user.create({ data: { fullName: 'Public Events Test Administrator', email: `${prefix}@example.test`, role: 'ADMIN', status: 'ACTIVE' } });
    const session = await prisma.session.create({ data: { userId: admin.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
    const token = signAccessToken({ sub: admin.id, sessionId: session.id, role: 'ADMIN' });
    const api = async (suffix, method = 'GET', body) => {
      const response = await fetch(`${base}${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result.data;
    };
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const full = { title: `${prefix} Research Workshop`, shortDescription: 'Research methods, evidence and practical discussion for the IFSMHP community.', longDescription: 'Explore research methods with invited speakers.\n\nAgenda: evidence review, group discussion and questions. <script>never execute</script>', date, timeStart: '14:00', timeEnd: '16:00', timezone: 'Asia/Kolkata', location: 'Chennai Research Institute', organizer: 'Research Committee', organizerEmail: 'events@example.test', audience: 'Public', status: 'DRAFT', sendReminder: false, tags: ['Workshop', 'Research'], speakers: ['Dr. Research Lead'], capacity: 25, externalUrl: 'https://example.test/register' };
    const row = await api('/admin/events', 'POST', full);
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    // Scope list results to this run, while exercising the real public filtering APIs.
    await page.route('**/api/v1/public/events?**', route => { const url = new URL(route.request().url()); url.searchParams.set('q', prefix); return route.continue({ url: url.toString() }); });
    await page.goto(`${site}/events`);
    await page.getByText('No upcoming events for this selection.', { exact: true }).waitFor();
    await screenshot(page, 'empty-desktop');

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await adminContext.addInitScript(value => localStorage.setItem('ifsmhp.accessToken', value), token);
    const editor = await adminContext.newPage(); editor.setDefaultTimeout(15000); editor.on('pageerror', e => errors.push(e.message));
    await editor.goto(`${site}/admin/events/${row.id}/edit`);
    await editor.getByRole('heading', { name: 'Edit Event', exact: true }).waitFor();
    await editor.getByLabel('Event Cover Image', { exact: false }).setInputFiles(path.resolve('../frontend/src/assets/images/slide_01.png'));
    await editor.getByLabel('Publish on save', { exact: true }).check();
    await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await editor.getByText('Event saved.', { exact: true }).waitFor();
    await page.getByRole('button', { name: full.title, exact: true }).waitFor({ timeout: 40000 });
    assert.equal(await page.getByRole('link', { name: 'Register', exact: true }).getAttribute('href'), full.externalUrl);
    await screenshot(page, 'upcoming-desktop');
    await page.getByRole('button', { name: full.title, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('img', { name: 'slide_01.png' }).waitFor();
    assert.ok(await dialog.getByRole('img', { name: 'slide_01.png', exact: true }).evaluate(img => img.complete && img.naturalWidth > 0));
    await dialog.getByText('14:00 - 16:00 Asia/Kolkata', { exact: true }).waitFor();
    assert.ok((await dialog.innerText()).includes('<script>never execute</script>'));
    await screenshot(page, 'detail-desktop');
    await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, 'detail-mobile');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: full.title, exact: true }).evaluate(node => node === document.activeElement), true);
    await screenshot(page, 'upcoming-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });

    const revised = `${prefix} Revised Workshop`;
    await editor.reload();
    await editor.getByRole('heading', { name: 'Edit Event', exact: true }).waitFor();
    await editor.getByLabel('Title', { exact: false }).fill(revised);
    await editor.getByLabel('Location / Virtual Room', { exact: false }).fill('Updated Research Room');
    await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('button', { name: revised, exact: true }).waitFor({ timeout: 40000 });
    await page.reload(); await page.getByRole('button', { name: revised, exact: true }).waitFor();
    const current = new Date();
    const delta = (Number(date.slice(0, 4)) - current.getFullYear()) * 12 + Number(date.slice(5, 7)) - 1 - current.getMonth();
    for (let i = 0; i < delta; i++) await page.getByRole('button', { name: 'Next month', exact: true }).click();
    const dayLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    await page.getByRole('button', { name: new RegExp(`^${dayLabel}, [1-9]`) }).click();
    await page.getByRole('button', { name: revised, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: new RegExp(`^${dayLabel},`) }).getAttribute('aria-pressed'), 'true');
    await screenshot(page, 'calendar-filter-desktop');
    await page.getByRole('button', { name: 'Next month', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /Clear date filter/ }).count(), 0);
    await page.getByRole('button', { name: 'Previous month', exact: true }).click();

    const past = await api('/admin/events', 'POST', { ...full, title: `${prefix} Archived Symposium`, date: '2025-06-01', status: 'PAST', tags: ['Symposium'], capacity: null });
    await prisma.eventResource.createMany({ data: [{ eventId: past.id, title: 'Session recording', kind: 'recording', url: 'https://example.test/recording' }, { eventId: past.id, title: 'Published proceedings', kind: 'proceedings', url: 'https://example.test/proceedings' }, { eventId: past.id, title: 'Private attachment', kind: 'pdf', fileId: 'private-test' }] });
    for (let i = 0; i < 5; i++) await api('/admin/events', 'POST', { ...full, title: `${prefix} Additional event ${i}`, status: 'PUBLISHED', capacity: i === 0 ? 0 : null, registrationRequired: false });
    await page.reload();
    await page.getByRole('button', { name: 'Next upcoming events', exact: true }).click();
    await page.getByRole('navigation', { name: 'upcoming events pagination' }).getByText('2 / 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Previous upcoming events', exact: true }).click();
    await page.getByRole('button', { name: 'Recordings', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Session recording', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'Published proceedings', exact: true }).getAttribute('href'), 'https://example.test/proceedings');
    await screenshot(page, 'resources-desktop');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Feedback', exact: true }).isDisabled(), true);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    assert.ok(await page.locator('main aside').evaluate(node => node.children[0].getBoundingClientRect().bottom <= node.children[1].getBoundingClientRect().top), 'Sticky calendar must not overlap the proposal card');
    await screenshot(page, 'lists-desktop'); await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, 'lists-mobile');

    await page.route('**/api/v1/public/events?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Events temporarily unavailable.', errors: [] }) }));
    await page.reload(); await page.getByRole('button', { name: 'Retry upcoming events', exact: true }).waitFor();
    await screenshot(page, 'error-mobile');
    await page.unroute('**/api/v1/public/events?**');
    await page.route('**/api/v1/public/events?**', route => { const url = new URL(route.request().url()); url.searchParams.set('q', prefix); return route.continue({ url: url.toString() }); });
    await page.getByRole('button', { name: 'Retry upcoming events', exact: true }).click();
    await page.getByRole('button', { name: revised, exact: true }).waitFor();
    await page.route('**/public/events/*/cover?**', route => route.fulfill({ status: 404 }));
    await page.getByRole('button', { name: revised, exact: true }).click();
    await page.getByRole('dialog').getByText('Event image unavailable.', { exact: true }).waitFor();
    await screenshot(page, 'image-failure-mobile'); await page.keyboard.press('Escape'); await page.unroute('**/public/events/*/cover?**');

    await page.getByRole('button', { name: revised, exact: true }).click();
    await page.getByRole('dialog').getByText('Updated Research Room · Virtual', { exact: true }).waitFor();
    await editor.getByRole('button', { name: 'Cancel Event', exact: true }).click();
    await editor.getByLabel('Email cancellation notice', { exact: false }).uncheck();
    await editor.getByRole('button', { name: 'Confirm Cancel Event', exact: true }).click();
    await page.getByRole('dialog').getByText('Event not found', { exact: false }).waitFor({ timeout: 40000 });
    assert.equal(await page.getByRole('dialog').getByText('Updated Research Room · Virtual', { exact: true }).count(), 0);
    await screenshot(page, 'removed-event-mobile'); await page.keyboard.press('Escape');
    await api(`/admin/events/${past.id}`, 'DELETE'); await page.reload();
    await page.getByText('No past events for this selection.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ success: true, screenshots: output, flows: ['draft visibility', 'admin publish and cover upload', 'polling after admin edits', 'refresh persistence', 'timezone display', 'calendar filtering/navigation', 'external registration', 'resources', 'pagination', 'empty/error/retry', 'missing image', 'cancellation while dialog open', 'deletion', 'dialog focus/escape', 'desktop/mobile'] }));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); console.error((await page.locator('main').innerText().catch(() => '')).slice(0, 4000)); }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (admin) {
      await prisma.event.deleteMany({ where: { creatorId: admin.id } });
      const files = await prisma.fileObject.findMany({ where: { uploaderId: admin.id } });
      for (const file of files) await fs.unlink(assertSafePath(file.storageKey)).catch(() => {});
      await prisma.fileObject.deleteMany({ where: { uploaderId: admin.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
      await prisma.user.delete({ where: { id: admin.id } });
    }
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
