// Called by gallery.browser.cjs against its dedicated database and real API.
const assert = require('node:assert/strict');
module.exports = async function verifyBulkVisibility({ adminPage: page, publicPage, memberPage, ready, status, row, screenshot, prisma, prefix, checks, first, second }) {
  const header = page.getByRole('checkbox', { name: 'Visibility of all collections', exact: true });
  const endpoint = '**/admin/gallery/categories/visibility';
  const lists = '**/admin/gallery/categories?*';
  const state = async value => {
    await ready(page);
    assert.equal(await header.getAttribute('aria-checked'), value);
    await page.getByText(value === 'true' ? 'All visible' : value === 'mixed' ? 'Some visible' : 'None visible', { exact: true }).waitFor();
  };
  const saved = async published => { await status(page, published ? 'All collections are now visible.' : 'All collections are now hidden.'); await state(String(published)); };
  const visiblePhoto = target => target.getByText('Published symposium photo', { exact: true });
  await state('true');
  await row(page, first).getByRole('button', { name: 'Toggle published', exact: true }).click();
  await status(page, 'Collection status updated.'); await state('mixed');
  await page.reload(); await ready(page); await state('mixed');
  assert.equal(await row(page, first).getByRole('button', { name: 'Toggle published', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await row(page, second).getByRole('button', { name: 'Toggle published', exact: true }).getAttribute('aria-pressed'), 'true');
  await screenshot(page, 'visibility-mixed');
  await header.press('Space'); await saved(true);
  await page.reload(); await ready(page); await state('true');
  await header.press('Enter'); await saved(false);
  await page.reload(); await ready(page); await state('false');
  await publicPage.reload(); await ready(publicPage);
  await memberPage.reload(); await ready(memberPage);
  assert.equal(await visiblePhoto(publicPage).count(), 0); assert.equal(await visiblePhoto(memberPage).count(), 0);
  await header.click(); await saved(true);
  await publicPage.reload(); await visiblePhoto(publicPage).waitFor();
  await memberPage.reload(); await visiblePhoto(memberPage).waitFor();
  checks.push('Bulk all/none/mixed, keyboard control, independent rows, reload persistence, public/member visibility');

  // Hold the request to verify both header and row controls are disabled in flight.
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  let releaseStale, staleRequested, staleFinished;
  const staleGate = new Promise(resolve => { releaseStale = resolve; });
  const staleStarted = new Promise(resolve => { staleRequested = resolve; });
  const staleDone = new Promise(resolve => { staleFinished = resolve; });
  let holdNextList = true;
  await page.route(lists, async route => {
    if (!holdNextList) return route.continue();
    holdNextList = false;
    const response = await route.fetch();
    staleRequested(); await staleGate;
    await route.fulfill({ response }).catch(() => undefined); // The superseded load is cancelled.
    staleFinished();
  });
  let writes = 0;
  await page.route(endpoint, async route => { writes++; requested(); await gate; await route.continue(); });
  await header.click(); await started;
  assert.equal(await header.isDisabled(), true);
  assert.equal(await row(page, first).getByRole('button', { name: 'Toggle published', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await staleStarted;
  release(); await saved(false); assert.equal(writes, 1); await page.unroute(endpoint);
  releaseStale(); await staleDone; await page.unroute(lists); await state('false');

  await page.route(endpoint, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Bulk visibility temporarily unavailable', errors: [] }) }));
  await header.click(); await page.getByRole('alert').filter({ hasText: 'Bulk visibility temporarily unavailable' }).waitFor();
  await state('false'); assert.equal(await header.isEnabled(), true); await page.unroute(endpoint);
  await page.reload(); await state('false');

  // Simulate a response lost after the real backend commits; reconciliation must show the saved state.
  await page.route(endpoint, async route => { const response = await route.fetch(); assert.equal(response.status(), 200); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Response lost after save', errors: [] }) }); });
  await header.click(); await page.getByRole('alert').filter({ hasText: 'Response lost after save' }).waitFor();
  await state('true'); await page.unroute(endpoint); await page.reload(); await state('true');

  // A successful save remains visible even when the subsequent list refresh fails.
  await page.route(lists, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Collection refresh unavailable', errors: [] }) }));
  await header.click(); await saved(false);
  await page.getByRole('alert').filter({ hasText: 'Collection refresh unavailable' }).waitFor();
  assert.equal(await header.isDisabled(), true);
  await page.unroute(lists); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await state('false');
  assert.equal(await header.isEnabled(), true);
  await header.click(); await saved(true);
  checks.push('Bulk pending-state locking, stale-load cancellation, failure feedback, lost-response reconciliation, and separate refresh failure');

  // Empty collection lists cannot send a bulk mutation.
  await page.route(lists, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } } }) }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await state('false'); assert.equal(await header.isDisabled(), true);
  await page.unroute(lists); await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await state('true');

  const ids = Array.from({ length: 103 }, (_, index) => `${prefix}-collection-${index}`);
  try {
    await prisma.galleryAlbum.createMany({ data: ids.map((id, index) => ({ id, key: id, label: `${prefix} Bulk collection ${index}`, description: '', coverGradient: '', visibility: 'PUBLIC', displayOrder: index + 3 })) });
    let releasePage, pageStarted;
    const pageGate = new Promise(resolve => { releasePage = resolve; });
    const pageRequested = new Promise(resolve => { pageStarted = resolve; });
    await page.route(lists, async route => {
      if (new URL(route.request().url()).searchParams.get('page') === '2') { pageStarted(); await pageGate; }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await pageRequested;
    assert.equal(await header.isDisabled(), true);
    releasePage(); await ready(page); await page.unroute(lists);
    assert.equal(await page.locator('tbody tr').count(), 105);
    await page.route(endpoint, async route => { const body = route.request().postDataJSON(); assert.equal(body.categoryIds.length, 105); await route.continue(); });
    await header.click(); await saved(false); await page.unroute(endpoint);
    assert.equal(await prisma.galleryAlbum.count({ where: { id: { in: ids }, visibility: 'PRIVATE' } }), 103);
    await page.reload(); await state('false');
    await header.click(); await saved(true);
    assert.equal(await prisma.galleryAlbum.count({ where: { id: { in: ids }, visibility: 'PUBLIC' } }), 103);
  } finally {
    await page.unroute(lists); await page.unroute(endpoint);
    await prisma.galleryAlbum.deleteMany({ where: { id: { in: ids } } });
  }
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await state('true');
  await screenshot(page, 'visibility-all');
  checks.push('Empty and incomplete grids disabled; all 105 collections saved across pagination and persisted after reload');
};
