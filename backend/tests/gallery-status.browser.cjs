// Runs inside the real gallery browser workflow against its dedicated database.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function verifyBulkStatus({ adminPage: page, publicPage, memberPage, admin, api, ready, status, row, screenshot, prisma, prefix, first, checks }) {
  const header = page.getByRole('checkbox', { name: 'Status of all media in current grid', exact: true });
  const endpoint = '**/admin/gallery/photos/status', lists = '**/admin/gallery/photos?*';
  const state = async value => {
    await ready(page); assert.equal(await header.getAttribute('aria-checked'), value);
    await page.getByText(value === 'true' ? 'All live' : value === 'mixed' ? 'Some live' : 'None live', { exact: true }).waitFor();
  };
  const saved = async published => { await status(page, published ? 'All media in this grid are now live.' : 'All media in this grid are now hidden.'); await state(String(published)); };
  const media = async () => { await page.getByRole('button', { name: 'Media', exact: true }).click(); await ready(page); };
  const reload = async () => { await page.reload(); await ready(page); await media(); };
  const filter = page.getByRole('combobox', { name: 'Filter category', exact: true });
  const search = page.getByPlaceholder('Search title, caption, alt…');
  const visiblePhoto = target => target.getByText('Published symposium photo', { exact: true });
  assert.equal(await page.getByRole('checkbox', { name: 'Visibility of all collections' }).count(), 0);
  const collectionsBefore = await prisma.galleryAlbum.findMany({ orderBy: { id: 'asc' } });
  await media(); await filter.selectOption('all'); await ready(page);
  const originals = (await api(admin, '/admin/gallery/photos')).items;
  assert.equal(originals.length, 2);
  const draft = originals.find(item => !item.published), live = originals.find(item => item.published);
  await state('mixed'); await screenshot(page, 'status-mixed');
  await header.press('Space'); await saved(true); await reload(); await state('true');
  await row(page, draft.title).getByRole('button', { name: 'Unpublish', exact: true }).click(); await status(page, 'Photo status updated.'); await state('mixed');
  await reload(); await state('mixed');
  assert.equal(await row(page, live.title).getByRole('button', { name: 'Unpublish', exact: true }).count(), 1);
  await header.press('Enter'); await saved(true);
  await header.click(); await saved(false); await reload(); await state('false');
  await publicPage.reload(); await ready(publicPage); await memberPage.reload(); await ready(memberPage);
  assert.equal(await visiblePhoto(publicPage).count(), 0); assert.equal(await visiblePhoto(memberPage).count(), 0);
  await header.click(); await saved(true);
  await publicPage.reload(); await visiblePhoto(publicPage).waitFor(); await memberPage.reload(); await visiblePhoto(memberPage).waitFor();
  assert.deepEqual(await prisma.galleryAlbum.findMany({ orderBy: { id: 'asc' } }), collectionsBefore);
  checks.push('Media all/none/mixed, keyboard control, independent rows, reload persistence, unchanged collections, public/member visibility');

  let release, requested, releaseStale, staleRequested, staleFinished;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { requested = resolve; });
  const staleGate = new Promise(resolve => { releaseStale = resolve; }), staleStarted = new Promise(resolve => { staleRequested = resolve; }), staleDone = new Promise(resolve => { staleFinished = resolve; });
  let holdNext = true, writes = 0;
  await page.route(lists, async route => {
    if (!holdNext) return route.continue(); holdNext = false;
    const response = await route.fetch(); staleRequested(); await staleGate;
    await route.fulfill({ response }).catch(() => undefined); staleFinished();
  });
  await page.route(endpoint, async route => { writes++; requested(); await gate; await route.continue(); });
  await header.click(); await started;
  assert.equal(await header.isDisabled(), true);
  assert.equal(await row(page, live.title).getByRole('button', { name: 'Unpublish', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await staleStarted;
  release(); await saved(false); assert.equal(writes, 1); await page.unroute(endpoint);
  releaseStale(); await staleDone; await page.unroute(lists); await state('false');
  await page.route(endpoint, route => route.fulfill({ status: 503, json: { success: false, message: 'Bulk status temporarily unavailable', errors: [] } }));
  await header.click(); await page.getByRole('alert').filter({ hasText: 'Bulk status temporarily unavailable' }).waitFor(); await state('false');
  await page.unroute(endpoint); await reload(); await state('false');
  await page.route(endpoint, async route => { const response = await route.fetch(); assert.equal(response.status(), 200); await route.fulfill({ status: 503, json: { success: false, message: 'Response lost after save', errors: [] } }); });
  await header.click(); await page.getByRole('alert').filter({ hasText: 'Response lost after save' }).waitFor(); await state('true'); await page.unroute(endpoint);
  await reload(); await state('true');
  await page.route(lists, route => route.fulfill({ status: 503, json: { success: false, message: 'Media refresh unavailable', errors: [] } }));
  await header.click(); await saved(false); await page.getByRole('alert').filter({ hasText: 'Media refresh unavailable' }).waitFor(); assert.equal(await header.isDisabled(), true);
  await page.unroute(lists); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await state('false');
  checks.push('Media pending-state locking, stale-response cancellation, save failure, lost-response reconciliation, and independent refresh errors');

  const parent = collectionsBefore.find(c => c.label === first), otherParent = collectionsBefore.find(c => c.id !== parent.id);
  const target = await api(admin, '/admin/gallery/subcategories', 'POST', { name: `${prefix} target`, categoryId: parent.id });
  const excludedSub = await api(admin, '/admin/gallery/subcategories', 'POST', { name: `${prefix} excluded`, categoryId: parent.id });
  const ids = Array.from({ length: 104 }, (_, i) => `${prefix}-status-${i}`), excludedIds = Array.from({ length: 3 }, (_, i) => `${prefix}-excluded-${i}`);
  let videoId;
  try {
    const { id: _id, ...template } = await prisma.galleryItem.findUniqueOrThrow({ where: { id: draft.id } }); void _id;
    await prisma.galleryItem.createMany({ data: [
      ...ids.map((id, i) => ({ ...template, id, albumId: parent.id, subcategoryId: target.id, title: `Bulk target ${String(i).padStart(3, '0')}`, visibility: 'PRIVATE', displayOrder: i + 3 })),
      ...excludedIds.map((id, i) => ({ ...template, id, albumId: i === 1 ? otherParent.id : parent.id, subcategoryId: i === 0 ? excludedSub.id : i === 2 ? target.id : null, title: i === 2 ? 'Outside search' : 'Bulk target excluded', visibility: 'PRIVATE', displayOrder: i + 107 })),
    ] });
    const body = new FormData(); body.append('categoryId', parent.id); body.append('subcategoryId', target.id); body.append('title', 'Bulk target video');
    body.append('file', new Blob([await fs.readFile(path.join(__dirname, 'fixtures/gallery/sample.mp4'))], { type: 'video/mp4' }), 'bulk.mp4');
    const response = await fetch(`${process.env.GALLERY_API_URL || 'http://127.0.0.1:5006/api/v1'}/admin/gallery/photos`, { method: 'POST', headers: { Authorization: `Bearer ${admin.token}` }, body });
    const uploaded = await response.json(); assert.equal(response.status, 201, JSON.stringify(uploaded)); videoId = uploaded.data.id;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await ready(page);
    await filter.selectOption(parent.id); await ready(page);
    await page.getByRole('combobox', { name: 'Filter subcategory', exact: true }).selectOption(target.id); await ready(page);
    await search.fill('Bulk'); assert.equal(await header.isDisabled(), true);
    await search.fill('Bulk target'); assert.equal(await header.isDisabled(), true);
    await page.waitForResponse(r => r.url().includes('/photos?') && new URL(r.url()).searchParams.get('search') === 'Bulk target' && new URL(r.url()).searchParams.get('page') === '2'); await ready(page);
    assert.equal(await page.locator('tbody tr').count(), 105); await state('false');
    const targeted = [...ids, videoId];
    await page.route(endpoint, async route => { const body = route.request().postDataJSON(); assert.deepEqual([...body.photoIds].sort(), [...targeted].sort()); await route.continue(); });
    await header.click(); await saved(true); await page.unroute(endpoint);
    assert.equal(await prisma.galleryItem.count({ where: { id: { in: targeted }, visibility: 'PUBLIC' } }), 105);
    assert.equal(await prisma.galleryItem.count({ where: { id: { in: excludedIds }, visibility: 'PRIVATE' } }), 3);
    assert.equal(await prisma.galleryItem.count({ where: { id: { in: originals.map(p => p.id) }, visibility: 'PRIVATE' } }), 2);
    await reload(); await state('mixed'); // Reload resets local filters; only targeted rows are live.
    await filter.selectOption(parent.id); await ready(page); await page.getByRole('combobox', { name: 'Filter subcategory', exact: true }).selectOption(target.id); await ready(page);
    await search.fill('Bulk target'); await page.waitForResponse(r => r.url().includes('/photos?') && new URL(r.url()).searchParams.get('search') === 'Bulk target' && new URL(r.url()).searchParams.get('page') === '2'); await state('true');
    await header.click(); await saved(false); await reload(); await state('false');
    await search.fill('no-matching-media'); assert.equal(await header.isDisabled(), true);
    await page.waitForResponse(r => r.url().includes('/photos?') && new URL(r.url()).searchParams.get('search') === 'no-matching-media'); await ready(page);
    await page.getByText('No media match your filter', { exact: true }).waitFor(); assert.equal(await header.isDisabled(), true);
    await screenshot(page, 'status-empty');
    checks.push('Filtered bulk status includes 105 images/videos across pages, excludes other categories/subcategories/search results, guards debounce, and persists after reload');
  } finally {
    await page.unroute(endpoint); await page.unroute(lists);
    await prisma.galleryItem.deleteMany({ where: { id: { in: [...ids, ...excludedIds, ...(videoId ? [videoId] : [])] } } });
    await prisma.gallerySubcategory.deleteMany({ where: { id: { in: [target.id, excludedSub.id] } } });
    for (const item of originals) await api(admin, `/admin/gallery/photos/${item.id}`, 'PATCH', { published: item.published });
  }
  await reload(); await state('mixed'); await screenshot(page, 'status-final');
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  assert.equal(await page.getByRole('checkbox').count(), 0);
};
