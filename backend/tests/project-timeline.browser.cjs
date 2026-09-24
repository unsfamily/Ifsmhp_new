// Isolated API/database only. Real OTP verification and sessions; no email delivery.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { sha256 } = require('../dist/utils/security');
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'Use an isolated *_test database');
const site = process.env.TIMELINE_WEB_URL || 'http://127.0.0.1:5179';
const base = process.env.TIMELINE_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.TIMELINE_SCREENSHOT_DIR || '/private/tmp/ifsmhp-timeline-browser';
const checks = [], errors = [];
const title = `Timeline browser ${crypto.randomUUID().slice(0, 8)}`;
let user, browser, page, context, mutations = 0;
const from = () => page.getByLabel(/^From Date/);
const to = () => page.getByLabel(/^To Date/);
async function shot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': horizontal overflow');
  await page.screenshot({ path: path.join(output, name + '.png') });
}
async function save(label, method = 'POST', status = 201) {
  const pending = page.waitForResponse(r => r.url().includes('/members/me/projects') && r.request().method() === method);
  await page.getByRole('button', { name: label, exact: true }).click();
  const response = await pending; assert.equal(response.status(), status);
  if (status < 300) {
    if (method === 'POST') await page.getByRole('heading', { name: 'Project Submitted Successfully' }).waitFor();
    else await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  return (await response.json()).data;
}
async function basics(name) {
  await page.getByLabel(/^Project Title/).fill(name);
  await page.getByLabel(/^Research Category/).selectOption('Neuroscience');
  await page.getByLabel(/^Project Description/).fill('A sufficiently long research description for timeline validation.');
  await page.getByLabel('Budget (if applicable)', { exact: true }).fill('USD 120');
}
async function edit(name) {
  await page.goto(site + '/dashboard/projects');
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
  await from().waitFor();
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  user = await prisma.user.create({ data: { email: `timeline-${crypto.randomUUID()}@example.test`, fullName: 'Timeline Reviewer', role: 'MEMBER', status: 'ACTIVE', memberProfile: { create: { professionalType: 'Scientist', institution: 'Test Institute' } } } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  await prisma.emailOtp.create({ data: { email: user.email, purpose: 'LOGIN', codeHash: sha256(`LOGIN:${user.email}:${code}`), expiresAt: new Date(Date.now() + 300000) } });
  const login = await context.request.post(base + '/auth/otp/verify', { data: { email: user.email, code, purpose: 'LOGIN' } }); assert.equal(login.status(), 200);
  await context.addInitScript(token => localStorage.setItem('ifsmhp.accessToken', token), (await login.json()).data.accessToken);
  page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  page.on('request', r => { if (r.url().includes('/members/me/projects') && ['POST', 'PATCH'].includes(r.method())) mutations++; });
  await page.goto(site + '/dashboard/projects/upload'); await basics(title);
  for (const button of ['Save Draft', 'Submit Project']) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByText('From Date is required', { exact: true }).waitFor();
    await page.getByText('To Date is required', { exact: true }).waitFor();
    assert.equal(mutations, 0);
  }
  assert.equal(await from().evaluate(el => el === document.activeElement), true);
  await from().press('0'); await page.getByRole('button', { name: 'Save Draft', exact: true }).click(); assert.equal(mutations, 0);
  await from().fill('2026-12-31'); await to().fill('2026-01-01');
  await page.getByText('To Date must be on or after From Date', { exact: true }).waitFor();
  for (const button of ['Save Draft', 'Submit Project']) { await page.getByRole('button', { name: button, exact: true }).click(); assert.equal(mutations, 0); }
  assert.equal(await to().getAttribute('min'), '2026-12-31');
  assert.ok(await to().evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent.includes('To Date must')));
  await from().evaluate(el => el.closest('fieldset').scrollIntoView({ block: 'center' })); await shot('timeline-desktop-invalid');
  await from().fill('2026-01-01'); await page.waitForFunction(() => document.querySelector('[name="toDate"]').getAttribute('aria-invalid') === 'false');
  await from().fill('2026-02-01'); await page.getByText('To Date must be on or after From Date', { exact: true }).waitFor();
  await from().fill('2024-02-29'); await to().fill('2024-02-29');
  checks.push('Both create buttons reject empty, zero/incomplete, and reversed dates; changing From Date revalidates To Date');

  await page.getByText('Moral Support', { exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: /Moral Support/ }).isChecked(), true);
  const upload = page.waitForResponse(r => r.url() === base + '/files/upload' && r.request().method() === 'POST');
  await page.getByLabel('Project Documents', { exact: true }).setInputFiles({ name: 'timeline-protocol.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n') });
  assert.equal((await upload).status(), 201);
  await page.getByLabel('Resource URL', { exact: true }).fill('https://example.test/timeline');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.route('**/members/me/projects', async route => { if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test service unavailable' }) }); else await route.continue(); });
  await save('Save Draft', 'POST', 503); await page.getByText('Test service unavailable', { exact: true }).waitFor();
  assert.equal(await from().inputValue(), '2024-02-29'); assert.equal(await to().inputValue(), '2024-02-29');
  assert.equal(await page.getByLabel(/^Project Title/).inputValue(), title);
  assert.equal(await prisma.project.count({ where: { ownerId: user.id } }), 0);
  await page.unroute('**/members/me/projects'); const draft = await save('Save Draft');
  const stored = await prisma.project.findUniqueOrThrow({ where: { id: draft.id }, include: { files: true, resourceLinks: true, supportTypes: true } });
  assert.equal(stored.timeline, '2024-02-29 / 2024-02-29'); assert.equal(stored.status, 'DRAFT'); assert.equal(stored.budget, 'USD 120');
  assert.equal(stored.files.length, 1); assert.equal(stored.resourceLinks[0].url, 'https://example.test/timeline'); assert.equal(stored.supportTypes[0].kind, 'MORAL');
  checks.push('Failed creation preserves fields and attachments; retry saves a leap-day, same-day draft without timezone shifts');

  await edit(title); assert.equal(await from().inputValue(), '2024-02-29'); assert.equal(await to().inputValue(), '2024-02-29');
  await from().fill('2027-01-01'); await to().fill('2026-12-31');
  const before = mutations; await page.getByRole('button', { name: 'Submit for Review', exact: true }).click(); assert.equal(mutations, before);
  await to().fill('2027-01-01'); await save('Submit for Review', 'PATCH', 200);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: draft.id } })).status, 'SUBMITTED');
  await edit(title); assert.equal(await from().inputValue(), '2027-01-01'); assert.equal(await to().inputValue(), '2027-01-01');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Reload prefills exact saved dates; edit-dialog validation blocks invalid promotion and persists valid replacement');

  const legacyTitle = title + ' legacy';
  const legacy = await prisma.project.create({ data: { ownerId: user.id, title: legacyTitle, category: 'Research', description: 'A legacy project with a textual timeline.', timeline: '2026 Q3-Q4', status: 'DRAFT' } });
  await edit(legacyTitle); assert.equal(await from().inputValue(), ''); assert.equal(await to().inputValue(), '');
  await page.getByText('Saved timeline: 2026 Q3-Q4.', { exact: false }).waitFor();
  await page.getByLabel(/^Description/).fill('An unrelated description update preserves the saved legacy timeline.');
  await save('Save Draft', 'PATCH', 200);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: legacy.id } })).timeline, '2026 Q3-Q4');
  await edit(legacyTitle); const legacyBefore = mutations;
  await page.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await page.getByText('From Date is required', { exact: true }).waitFor(); assert.equal(mutations, legacyBefore);
  await from().fill('2026-01-01'); await to().fill('2026-12-31'); await save('Submit for Review', 'PATCH', 200);
  checks.push('Legacy timelines remain unchanged on unrelated edits and require explicit dates before submission');

  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(site + '/dashboard/projects/upload'); await basics(title + ' mobile');
  await from().fill('2026-12-31'); await to().fill('2026-01-01'); await from().scrollIntoViewIfNeeded(); await shot('timeline-mobile-invalid');
  await to().fill('2027-01-01'); const mobile = await save('Submit Project');
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: mobile.id } })).timeline, '2026-12-31 / 2027-01-01');
  await edit(title + ' mobile'); assert.equal(await from().inputValue(), '2026-12-31'); assert.equal(await to().inputValue(), '2027-01-01');
  await shot('timeline-mobile-saved');
  checks.push('Mobile create, submit, reload, and edit preserve a cross-year range without horizontal overflow');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (user) {
    const files = await prisma.fileObject.findMany({ where: { uploaderId: user.id } });
    await prisma.emailOtp.deleteMany({ where: { email: user.email } });
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } }); await prisma.user.delete({ where: { id: user.id } });
    await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
    await Promise.all(files.map(f => fs.unlink(path.join(process.env.UPLOAD_STORAGE_PATH, f.storageKey)).catch(() => {})));
  }
  await prisma.$disconnect();
});
