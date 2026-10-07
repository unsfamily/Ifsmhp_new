// Deterministic browser-only layout regression; all API traffic is intercepted.
// Start the frontend, then run npm run test:gallery:layout (no database required).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const site = process.env.GALLERY_WEB_URL || 'http://localhost:5173';
const output = process.env.GALLERY_LAYOUT_OUTPUT || '/private/tmp/ifsmhp-gallery-layout';
const jwt = session => `e30.${Buffer.from(JSON.stringify({ sub: 'layout-admin', sessionId: session, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const date = '2026-10-07T00:00:00.000Z';
const categories = Array.from({ length: 105 }, (_, i) => ({ id: `c${i}`, name: i === 4 ? 'A long collection title '.repeat(8) : `Collection ${i + 1}`, description: 'Research photographs', displayOrder: i + 1, published: i % 2 === 0, createdAt: date, updatedAt: date, photoCount: i === 0 ? 12 : 0 }));
const subcategories = [{ id: 's1', categoryId: 'c0', name: 'Workshops', photoCount: 12, createdAt: date, updatedAt: date }];
const photos = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, categoryId: 'c0', subcategoryId: 's1', title: `Photograph ${i + 1}`, caption: 'Research gathering', altText: '', displayOrder: i + 1, published: true, uploadedAt: date, type: 'image', imageUrl: '/admin/gallery/photos/pixel/media', mediaUrl: '/admin/gallery/photos/pixel/media' }));
const checks = [], measurements = [], errors = [];
let browser;
const ready = async page => { await page.locator('main fieldset[aria-busy="false"]').waitFor(); };
async function sample(page) {
  return page.evaluate(() => {
    const rect = element => { const r = element?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
    return { title: rect(document.querySelector('main h1')), tabs: rect(document.querySelector('[aria-label="Gallery views"]')), table: rect(document.querySelector('main table')), sidebar: rect(document.querySelector('aside')), columns: [...document.querySelectorAll('main th')].map(rect), scrollY, rows: document.querySelectorAll('main tbody tr').length, skeletons: document.querySelectorAll('[data-gallery-skeleton]').length, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
}
async function startSamples(page) {
  await page.evaluate(() => {
    window.gallerySamples = []; window.gallerySampling = true; window.galleryShifts = [];
    window.galleryObserver?.disconnect();
    window.galleryObserver = new PerformanceObserver(list => window.galleryShifts.push(...list.getEntries().map(e => ({ value: e.value, recentInput: e.hadRecentInput }))));
    window.galleryObserver.observe({ type: 'layout-shift' });
    const tick = () => {
      if (!window.gallerySampling) return;
      const rect = selector => { const e = document.querySelector(selector); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; };
      window.gallerySamples.push({ title: rect('main h1'), tabs: rect('[aria-label="Gallery views"]'), table: rect('main table'), sidebar: rect('aside'), columns: [...document.querySelectorAll('main th')].map(e => ({ x: e.getBoundingClientRect().x, width: e.getBoundingClientRect().width })), scrollY });
      requestAnimationFrame(tick);
    }; tick();
  });
}
async function stable(page, name, before, preserveHeight = false) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const after = await sample(page);
  const observed = await page.evaluate(() => { window.gallerySampling = false; window.galleryObserver.disconnect(); return { frames: window.gallerySamples, shifts: window.galleryShifts }; });
  let maximum = 0;
  for (const frame of [...observed.frames, after]) {
    for (const anchor of ['title', 'tabs', 'table', 'sidebar']) {
      for (const property of anchor === 'sidebar' ? ['width'] : ['x', 'y', 'width']) {
        const delta = Math.abs(frame[anchor][property] - before[anchor][property]); maximum = Math.max(maximum, delta);
        assert.ok(delta <= 1, `${name}: ${anchor}.${property} moved ${delta}px`);
      }
    }
    for (const [index, column] of frame.columns.entries()) for (const property of ['x', 'width']) assert.ok(Math.abs(column[property] - before.columns[index][property]) <= 1, `${name}: column ${index} changed ${property}`);
    assert.ok(Math.abs(frame.scrollY - before.scrollY) <= 1, `${name}: scroll changed`);
  }
  if (preserveHeight) { assert.equal(after.rows, before.rows); assert.ok(Math.abs(after.table.height - before.table.height) <= 1, `${name}: height changed`); }
  assert.ok(after.pageWidth <= after.viewportWidth, `${name}: horizontal page overflow`);
  measurements.push({ name, maximumAnchorShift: maximum, frames: observed.frames.length, layoutShifts: observed.shifts });
  return after;
}
async function scenario(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(token => { if (!localStorage.getItem('ifsmhp.accessToken')) localStorage.setItem('ifsmhp.accessToken', token); }, jwt('session-a'));
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  let batch, fail = 0, empty = false;
  let completed = [];
  page.on('response', response => { if (response.ok() && response.url().includes('/admin/gallery/') && !response.url().includes('/media')) completed.push(response.url()); });
  const hold = () => { batch = Object.fromEntries(['categories', 'subcategories', 'photos', 'options'].map(kind => [kind, deferred()])); return batch; };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), kind = url.pathname.split('/').pop();
    let data = {};
    if (url.pathname.endsWith('/auth/me')) data = { user: { id: 'layout-admin', fullName: 'Layout Admin', email: 'layout@example.test', role: 'ADMIN', status: 'ACTIVE' } };
    if (url.pathname.includes('/gallery/')) {
      if (kind === 'media') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
      const gate = batch?.[kind]; if (gate) await gate.promise;
      if (fail) return route.fulfill({ status: fail, json: { success: false, message: 'Gallery temporarily unavailable' } }).catch(() => undefined);
      const items = empty ? [] : kind === 'categories' ? categories : kind === 'subcategories' ? subcategories : photos.filter(p => !url.searchParams.get('search') || p.title.includes(url.searchParams.get('search')));
      const number = Number(url.searchParams.get('page') || 1);
      data = kind === 'options' ? { maxBytes: 104857600, mimeTypes: ['image/png'], extensions: ['png'] } : { items: items.slice((number - 1) * 100, number * 100), pagination: { page: number, pages: Math.ceil(items.length / 100), total: items.length, limit: 100 } };
    }
    await route.fulfill({ json: { success: true, data } }).catch(() => undefined);
  });
  const label = `${viewport.width}-${reducedMotion}`;
  try {
    let gates = hold();
    await page.goto(`${site}/admin/gallery`);
    await page.getByRole('heading', { name: 'Media Gallery Management', exact: true }).waitFor();
    await page.locator('[data-gallery-skeleton]').first().waitFor();
    assert.equal(await page.getByText('No categories yet', { exact: true }).count(), 0);
    let before = await sample(page); assert.equal(before.skeletons, 5); await startSamples(page);
    const firstResponse = page.waitForResponse(r => r.url().includes('/gallery/categories?') && r.ok());
    gates.categories.resolve(); await firstResponse;
    assert.equal((await sample(page)).skeletons, 5);
    gates.subcategories.resolve(); gates.photos.resolve();
    await page.screenshot({ path: path.join(output, `${label}-loading.png`), animations: 'disabled' });
    gates.options.resolve(); await ready(page);
    await stable(page, `${label}: first entry`, before);
    assert.equal(await page.locator('tbody tr').count(), 107); // 105 collections, subcategory and its delete hint.
    assert.equal(completed.filter(url => url.includes('/categories?')).length, 2, 'Only one completed request per API page');
    assert.equal(completed.filter(url => url.includes('/subcategories?')).length, 1);
    await page.screenshot({ path: path.join(output, `${label}-loaded.png`), animations: 'disabled' });

    before = await sample(page); await startSamples(page); completed = []; gates = hold();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    assert.equal((await sample(page)).rows, before.rows); assert.equal((await sample(page)).skeletons, 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Visibility of all collections' }).count(), 0);
    Object.values(gates).forEach(gate => gate.resolve()); await ready(page);
    await stable(page, `${label}: toolbar refresh`, before, true);
    assert.equal(completed.filter(url => url.includes('/categories?')).length, 2);

    // Keep content and scroll position on background refresh, including near the document bottom.
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight - innerHeight - 100, behavior: 'instant' }));
    before = await sample(page); await startSamples(page); gates = hold();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('main fieldset[aria-busy="true"]').waitFor();
    assert.equal((await sample(page)).rows, before.rows);
    Object.values(gates).forEach(gate => gate.resolve()); await ready(page);
    await stable(page, `${label}: scrolled focus refresh`, before, true);

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    before = await sample(page);
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.waitForURL('**/admin');
    await page.evaluate(() => scrollTo({ top: 500, behavior: 'instant' }));
    gates = hold(); completed = [];
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open sidebar' }).click();
    await page.getByRole('link', { name: 'Media Gallery', exact: true }).click();
    await page.getByRole('heading', { name: 'Media Gallery Management', exact: true }).waitFor();
    assert.equal((await sample(page)).skeletons, 0); assert.equal((await sample(page)).rows, before.rows); assert.equal((await sample(page)).scrollY, 0);
    await startSamples(page); Object.values(gates).forEach(gate => gate.resolve()); await ready(page);
    await stable(page, `${label}: return navigation`, before, true);
    assert.equal(completed.filter(url => url.includes('/categories?')).length, 2);

    gates = hold(); await page.reload(); await page.locator('[data-gallery-skeleton]').first().waitFor();
    before = await sample(page); await startSamples(page); Object.values(gates).forEach(gate => gate.resolve()); await ready(page);
    await stable(page, `${label}: browser reload`, before);

    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await page.getByRole('table', { name: 'Gallery media', exact: true }).waitFor();
    await page.evaluate(() => scrollTo({ top: 200, behavior: 'instant' }));
    before = await sample(page); await startSamples(page); gates = hold();
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.locator('main fieldset[aria-busy="true"]').waitFor();
    assert.equal((await sample(page)).rows, 12); assert.equal((await sample(page)).skeletons, 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Status of all media in current grid' }).isDisabled(), true);
    Object.values(gates).forEach(gate => gate.resolve()); await ready(page);
    await stable(page, `${label}: media refresh`, before, true);

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    fail = 503; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByRole('alert').waitFor();
    assert.equal((await sample(page)).rows, 107); assert.equal((await sample(page)).skeletons, 0);
    fail = 0; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await ready(page);
    empty = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(page);
    await page.getByText('No categories yet', { exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Visibility of all collections' }).count(), 0);
    empty = false; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(page);

    // A new session for the same account cannot reuse the old account snapshot.
    gates = hold();
    await page.evaluate(token => { localStorage.setItem('ifsmhp.accessToken', token); window.dispatchEvent(new StorageEvent('storage', { key: 'ifsmhp.accessToken', newValue: token })); }, jwt('session-b'));
    await page.locator('[data-gallery-skeleton]').first().waitFor(); assert.equal((await sample(page)).rows, 5);
    Object.values(gates).forEach(gate => gate.resolve()); await ready(page);

    fail = 503; await page.reload(); await page.getByRole('alert').waitFor(); await ready(page);
    assert.equal(await page.getByText('No categories yet', { exact: true }).count(), 0);
    await page.getByText('Unable to load collections. Use Retry above.', { exact: true }).waitFor();
    fail = 0; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await ready(page);
    assert.equal((await sample(page)).rows, 107);
    fail = 403; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByRole('alert').waitFor(); await ready(page);
    assert.equal((await sample(page)).rows, 1, 'Denied admin access must clear cached collection rows');
    checks.push(`${label}: initial/return/reload layout, atomic pagination, request counts, refresh height/scroll, media retention, first-load/refresh failure and retry, empty state, session isolation and access revocation`);
  } finally { if (batch) Object.values(batch).forEach(gate => gate.resolve()); await context.close(); }
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) });
  await scenario({ width: 1440, height: 1000 });
  await scenario({ width: 390, height: 844 });
  await scenario({ width: 1100, height: 800 }, 'reduce');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, measurements, errors }, null, 2));
  console.log(JSON.stringify({ checks, maximumAnchorShift: Math.max(...measurements.map(m => m.maximumAnchorShift)), measurements: measurements.length, output }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
