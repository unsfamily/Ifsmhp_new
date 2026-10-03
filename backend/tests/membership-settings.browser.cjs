// Explicitly isolated local MySQL/API only; all outbound mail must be disabled.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
process.chdir(path.resolve(__dirname, '..'));
const { prisma } = require('../dist/config/database');
const { hashPassword, sha256 } = require('../dist/utils/security');
const { runMembershipJobs } = require('../dist/services/membership-policy.service');
const { assertSafePath } = require('../dist/utils/fileStorage');
const db = new URL(process.env.DATABASE_URL || ''); assert.ok(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname.endsWith('_test'));
const site = process.env.MEMBERSHIP_WEB_URL || 'http://127.0.0.1:5179', base = process.env.MEMBERSHIP_API_URL || 'http://127.0.0.1:5007/api/v1';
const output = process.env.MEMBERSHIP_SCREENSHOT_DIR || '/private/tmp/ifsmhp-membership-browser';
const prefix = `membership-browser-${crypto.randomUUID().slice(0, 8)}`, email = `${prefix}@example.test`, password = 'Membership-browser-2026!';
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
let browser, adminPage, page, adminContext, memberContext, admin, original, revisions, token;
const checks = [], errors = [], fileIds = [];
async function api(url, method = 'GET', data) { const r = await adminContext.request.fetch(base + url, { method, headers: { Authorization: `Bearer ${token}` }, ...(data ? { data } : {}) }); assert.ok(r.ok(), await r.text()); return (await r.json()).data; }
async function screenshot(p, name) { assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' horizontal overflow'); await p.screenshot({ path: path.join(output, name + '.png'), fullPage: false }); }
async function code(purpose) { const code = '234567'; const otp = await prisma.emailOtp.findFirstOrThrow({ where: { email, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } }); await prisma.emailOtp.update({ where: { id: otp.id }, data: { codeHash: sha256(`${purpose}:${email}:${code}`) } }); return code; }
async function enterCode(purpose) { const value = await code(purpose); for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1} of 6`).fill(value[i]); }
async function saveSettings(expected = 200) { const response = adminPage.waitForResponse(r => r.url() === base + '/admin/settings/membership' && r.request().method() === 'PATCH'); await adminPage.getByRole('button', { name: 'Save Membership', exact: true }).first().click(); assert.equal((await response).status(), expected); }
async function run() {
  await fs.mkdir(output, { recursive: true }); original = await prisma.platformSetting.findMany(); revisions = await prisma.settingRevision.findMany();
  admin = await prisma.user.create({ data: { fullName: 'Membership Browser Admin', email: `${prefix}-admin@example.test`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await hashPassword(password) } });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await adminContext.request.post(base + '/auth/login', { data: { email: admin.email, password } }); assert.equal(login.status(), 200); token = (await login.json()).data.accessToken;
  await adminContext.addInitScript(t => localStorage.setItem('ifsmhp.accessToken', t), token);
  adminPage = await adminContext.newPage(); adminPage.setDefaultTimeout(15000); adminPage.on('pageerror', e => errors.push(e.message));
  await adminPage.goto(site + '/admin/settings'); await adminPage.getByRole('button', { name: /^Membership/ }).click();
  await adminPage.getByLabel('Member ID issuance').selectOption('MANUAL'); await adminPage.getByLabel('Member ID prefix').fill('SCIENCE'); await adminPage.getByLabel('Sequence digits').fill('7');
  await adminPage.getByLabel('Require Profile document', { exact: true }).uncheck(); await adminPage.getByLabel('Require Credentials / Certifications / ID Card', { exact: true }).uncheck();
  await adminPage.getByLabel('Enable application fee', { exact: true }).check(); await adminPage.getByLabel('Application fee amount', { exact: true }).fill('100.50');
  await adminPage.getByLabel('Enable annual dues', { exact: true }).check(); await adminPage.getByLabel('Annual dues amount', { exact: true }).fill('500.00');
  await adminPage.getByLabel('Membership currency').selectOption('INR'); await adminPage.getByLabel('Payment instructions').fill('Pay the office by bank transfer. Quote your application code.');
  await adminPage.getByLabel('Allow financial hardship waiver requests').check(); await adminPage.getByLabel('Required referrals', { exact: true }).fill('1'); await adminPage.getByLabel('Required reference letters', { exact: true }).fill('1');
  await adminPage.getByLabel('Automatically archive rejected applications').check(); await adminPage.getByLabel('Days after rejection before archival').fill('1');
  await adminPage.route('**/api/v1/admin/settings/membership', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Retry this settings save' }) }));
  await saveSettings(503); assert.equal(await adminPage.getByLabel('Application fee amount', { exact: true }).inputValue(), '100.50');
  await adminPage.unroute('**/api/v1/admin/settings/membership'); await saveSettings(); await adminPage.reload(); await adminPage.getByRole('button', { name: /^Membership/ }).click();
  assert.equal(await adminPage.getByLabel('Member ID issuance').inputValue(), 'MANUAL'); assert.equal(await adminPage.getByLabel('Required reference letters', { exact: true }).inputValue(), '1');
  await adminPage.setViewportSize({ width: 390, height: 844 }); await adminPage.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().right <= 1); await adminPage.getByLabel('Application fee amount', { exact: true }).scrollIntoViewIfNeeded(); await screenshot(adminPage, 'membership-settings-mobile'); await adminPage.setViewportSize({ width: 1440, height: 1000 });
  checks.push('Every Membership setting is editable, recovers from failed saves, persists and fits mobile');

  memberContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); page = await memberContext.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  page.on('response', async r => { if (r.url() === base + '/files/registration' && r.status() === 201) fileIds.push((await r.json()).data.id); });
  await page.goto(site + '/register'); await page.getByLabel('Referrer 1 name').fill('Professor Reference'); await page.getByLabel('Referrer 1 email').fill('professor@example.test'); await page.getByLabel('Referrer 1 organization').fill('Research University');
  await page.getByLabel('Reference letters (1 required)', { exact: true }).setInputFiles({ name: prefix + '-reference.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Application fee waiver reason (optional)').fill('Requesting support during financial hardship.');
  for (const [label, value] of Object.entries({ 'First Name': 'Member', 'Last Name': 'Applicant', Email: email, 'Phone Number': '0123456789', 'Type of Professional Organization / Independent Professionals': 'Independent Researcher', 'Communication Address': '10 Research Road Chennai', 'Permanent Address': '20 Home Street Chennai', 'Professional Credentials': 'Licensed professional research credentials', Education: 'Doctoral degree in clinical psychology', 'Research Interests': 'Community mental health research' })) await page.getByLabel(label === 'Email' ? /^Email\*?$/ : label, { exact: false }).fill(value);
  await page.getByLabel('Professional Type').selectOption('Lecturer'); await page.getByRole('checkbox').check();
  const current = await api('/admin/settings'); await api('/admin/settings/membership', 'PATCH', { expectedRevision: current.sections.membership.revision, values: { applicationFee: '110.50' } });
  const conflict = page.waitForResponse(r => r.url() === base + '/auth/otp/request'); await page.getByRole('button', { name: 'Submit Application', exact: true }).click(); assert.equal((await conflict).status(), 409);
  await page.getByText('Membership requirements changed. Refresh the requirements and review your application.', { exact: false }).waitFor();
  assert.equal(await page.getByLabel('Referrer 1 name').inputValue(), 'Professor Reference'); await page.getByText(/Application fee: INR 110.50/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByLabel('Referrer 1 name').scrollIntoViewIfNeeded(); await screenshot(page, 'registration-requirements-mobile'); await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Submit Application', exact: true }).click(); await page.getByRole('heading', { name: 'Verify your email' }).waitFor(); await page.reload(); await enterCode('REGISTER');
  await page.getByRole('heading', { name: 'Your membership application', exact: true }).waitFor(); await page.getByText('Application fee · INR 110.50', { exact: true }).waitFor();
  const account = await prisma.user.findUniqueOrThrow({ where: { email }, include: { membershipApplication: true } }); const appId = account.membershipApplication.id;
  assert.equal(account.membershipApplication.policySnapshot.requireProfile, false); assert.equal(await prisma.professionalCredential.count({ where: { profile: { userId: account.id } } }), 0);
  assert.equal(await prisma.membershipReferenceLetter.count({ where: { applicationId: appId } }), 1);
  checks.push('Registration uses dynamic optional documents, referrals, letters and fee policy; stale-policy recovery retains inputs and uploads');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click(); await page.getByLabel('Email Address', { exact: true }).fill(email); await page.getByRole('button', { name: 'Email me a sign-in code', exact: true }).click(); await page.getByRole('heading', { name: 'Enter your code' }).waitFor(); await enterCode('LOGIN');
  await page.getByRole('heading', { name: 'Your membership application', exact: true }).waitFor(); await page.goto(site + '/dashboard'); await page.waitForURL('**/application');
  checks.push('Applicant logout/OTP login returns to application status and never grants member dashboard access');

  await adminPage.goto(site + '/admin/members/' + appId); await adminPage.getByText('Professor Reference · professor@example.test · Research University', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Confirm documents and references reviewed', exact: true }).click(); await adminPage.getByRole('button', { name: 'Confirm evidence review', exact: true }).click(); await adminPage.getByRole('button', { name: 'Evidence reviewed', exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Reject waiver', exact: true }).click(); await adminPage.getByLabel('Reason (at least 10 characters)').fill('Please arrange the application fee with the office.'); await adminPage.getByRole('button', { name: 'Reject waiver', exact: true }).last().click(); await adminPage.getByText('Waiver: REJECTED', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Record full payment', exact: true }).click(); await adminPage.getByLabel('Payment reference', { exact: true }).fill('BANK-TEST-001'); await adminPage.getByRole('button', { name: 'Record full payment', exact: true }).last().click(); await adminPage.getByText('Payment reference: BANK-TEST-001', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Approve & Issue ID', exact: true }).click(); await adminPage.getByLabel('Manual member ID').fill('MEMBER-BROWSER-001'); await adminPage.getByRole('button', { name: 'Confirm Approval & Issue ID', exact: true }).click();
  await adminPage.getByText(/Annual dues \d{4} · INR 500.00/).waitFor(); assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).role, 'MEMBER');
  await screenshot(adminPage, 'membership-approved-desktop');
  await page.goto(site + '/dashboard/profile'); await page.getByText(/Annual dues \d{4} · INR 500.00/).waitFor();
  await page.getByRole('button', { name: 'Request waiver', exact: true }).click(); await page.getByLabel('Reason (at least 10 characters)').fill('Please consider waiving my first annual dues.'); await page.getByRole('button', { name: 'Request full waiver', exact: true }).click(); await page.getByText('Waiver: PENDING', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().right <= 1); await page.getByText(/Annual dues \d{4} · INR 500.00/).scrollIntoViewIfNeeded(); await screenshot(page, 'member-dues-mobile');
  checks.push('Admin reviews evidence, decides waivers, records payment and approves a manual ID; members see annual dues and can request waivers');

  const archivedUser = await prisma.user.create({ data: { fullName: 'Rejected Browser Applicant', email: `${prefix}-rejected@example.test`, role: 'APPLICANT', status: 'REJECTED', memberProfile: { create: { professionalType: 'Researcher', institution: 'Test Institute' } } }, include: { memberProfile: true } });
  const rejected = await prisma.membershipApplication.create({ data: { applicationCode: prefix + '-rejected', userId: archivedUser.id, profileId: archivedUser.memberProfile.id, status: 'REJECTED', reviewedAt: new Date(Date.now() - 3 * 86400000), credentialsText: 'Credentials', educationText: 'Education', researchText: 'Research', policySnapshot: account.membershipApplication.policySnapshot, policyRevision: account.membershipApplication.policyRevision } });
  await runMembershipJobs(); await adminPage.goto(site + '/admin/members'); await adminPage.getByLabel('Application archive').selectOption('archived'); await adminPage.getByText('Rejected Browser Applicant', { exact: true }).waitFor();
  await adminPage.goto(site + '/admin/members/' + rejected.id); await adminPage.getByRole('button', { name: 'Restore from archive', exact: true }).click(); await adminPage.getByRole('button', { name: 'Restore archived application', exact: true }).click(); await adminPage.getByRole('button', { name: 'Re-enable automatic archival', exact: true }).waitFor(); await runMembershipJobs(); assert.equal((await prisma.membershipApplication.findUniqueOrThrow({ where: { id: rejected.id } })).archivedAt, null);
  checks.push('Rejected applications archive into the real directory filter and restoration prevents immediate re-archival');
  assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors, output }, null, 2));
}
run().catch(async error => { console.error(error); for (const [p, name] of [[adminPage, 'admin'], [page, 'applicant']]) if (p) { await p.screenshot({ path: path.join(output, name + '-failure.png'), fullPage: true }).catch(() => {}); await fs.writeFile(path.join(output, name + '-failure.html'), await p.content()).catch(() => {}); } process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } } }); const ids = users.map(u => u.id); const apps = await prisma.membershipApplication.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: apps.map(a => a.id) } }] } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const files = await prisma.fileObject.findMany({ where: { id: { in: fileIds } } }); await prisma.fileObject.deleteMany({ where: { id: { in: fileIds } } }); await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
  await prisma.emailOtp.deleteMany({ where: { email } });
  if (original) { await prisma.platformSetting.deleteMany(); if (original.length) await prisma.platformSetting.createMany({ data: original }); await prisma.settingRevision.deleteMany(); if (revisions.length) await prisma.settingRevision.createMany({ data: revisions }); }
  await prisma.$disconnect();
});
