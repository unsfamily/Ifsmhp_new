import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const email = `ceremony-e2e-${Date.now()}@example.test`;

async function openRegistration(page: Page, trigger: 'hero' | 'cta' = 'hero') {
  await page.goto('/awards/second-international');
  await page.locator(trigger === 'hero' ? '#ceremony-register-hero' : '#ceremony-register-cta').click();
  const dialog = page.getByRole('dialog', { name: 'Register for the Ceremony' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/awards\/second-international$/);
  return dialog;
}

async function fillRegistration(page: Page, name = 'Ada Ceremony') {
  const dialog = page.getByRole('dialog', { name: 'Register for the Ceremony' });
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByLabel('Email address').fill(email);
  await dialog.getByLabel('Phone number, including country code').fill('+44 7700 900123');
  await dialog.getByLabel('Institution / organisation').fill('Example Institute');
  await dialog.getByLabel('Delegate').check();
  await dialog.getByRole('checkbox', { name: /privacy policy/ }).check();
}

test('opens and closes the same ceremony registration dialog from both buttons', async ({ page }) => {
  const dialog = await openRegistration(page);
  await expect(page.getByRole('checkbox', { name: /privacy policy/ })).not.toBeChecked();
  await expect(dialog.getByText('Event date and venue are being finalised. Register your interest to receive ceremony updates.')).toBeVisible();
  const focusedInside = () => page.evaluate(() => {
    const node = document.querySelector('dialog');
    return Boolean(node && (node === document.activeElement || node.contains(document.activeElement)));
  });
  expect(await focusedInside()).toBe(true);
  for (let step = 0; step < 15; step += 1) await page.keyboard.press('Tab');
  expect(await focusedInside()).toBe(true);
  for (let step = 0; step < 15; step += 1) await page.keyboard.press('Shift+Tab');
  expect(await focusedInside()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#ceremony-register-hero')).toBeFocused();
  await expect(page).toHaveURL(/\/awards\/second-international$/);

  await page.locator('#ceremony-register-cta').click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ceremony-register-cta')).toBeFocused();
  await expect(page.getByRole('link', { name: 'Membership registration' })).toHaveAttribute('href', '/register');
});

test('uses a nearly full-screen dialog on a phone and keeps the page from scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/awards/second-international');
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; window.scrollTo(0, 240); });
  await page.locator('#ceremony-register-hero').click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(390 * 0.9);
  expect(box?.height ?? 0).toBeGreaterThan(844 * 0.85);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#ceremony-register-hero')).toBeFocused();
});

test('keeps entered values after validation and a server error, then saves once', async ({ page }) => {
  const dialog = await openRegistration(page);
  await dialog.getByRole('button', { name: 'Submit registration' }).click();
  await expect(dialog.getByText('Enter your full name.')).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: /privacy policy/ })).not.toBeChecked();
  await fillRegistration(page, 'Ada Ceremony');
  await dialog.getByLabel('Full name').fill('');
  await dialog.getByRole('button', { name: 'Submit registration' }).click();
  await expect(dialog.getByLabel('Email address')).toHaveValue(email);
  await expect(dialog.getByLabel('Phone number, including country code')).toHaveValue('+44 7700 900123');

  await page.route('**/public/awards/second-international/registrations', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, message: 'Could not save your registration. Please try again.', errors: [] }),
  }));
  await dialog.getByLabel('Full name').fill('Ada Ceremony');
  await dialog.getByRole('button', { name: 'Submit registration' }).click();
  await expect(dialog.getByText('Could not save your registration. Please try again.')).toBeVisible();
  await expect(dialog.getByText('Your registration of interest has been received.')).toHaveCount(0);
  await expect(dialog.getByLabel('Full name')).toHaveValue('Ada Ceremony');
  await page.unroute('**/public/awards/second-international/registrations');

  await dialog.getByRole('button', { name: 'Submit registration' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Your registration of interest has been received.');
  await expect(dialog.getByText(/sent you an email|email has been sent|confirmation email/i)).toHaveCount(0);
});

test('does not send a second registration while the first request is pending', async ({ page }) => {
  const dialog = await openRegistration(page);
  await fillRegistration(page, 'Ada Ceremony Pending');
  let posts = 0;
  await page.route('**/public/awards/second-international/registrations', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    posts += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': route.request().headers().origin ?? 'http://localhost:5175', 'access-control-allow-credentials': 'true' },
      body: JSON.stringify({ success: true, data: { received: true }, message: 'Your registration of interest has been received.' }),
    });
  });
  await page.evaluate(() => {
    const form = document.getElementById('ceremony-registration-form');
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
      form.requestSubmit();
    }
  });
  await expect(dialog.getByRole('status')).toHaveText('Your registration of interest has been received.');
  expect(posts).toBe(1);
});

test('opens the ceremony page from the menu and the form from its QR address', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Awards', exact: true }).click();
  await expect(page).toHaveURL(/\/awards\/second-international$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Second International Awards Ceremony' })).toBeVisible();
  const qr = page.locator('[data-registration-url]');
  await expect(qr).toContainText('/awards/second-international/register');
  await expect(qr).toHaveAttribute('data-registration-url', /\/awards\/second-international\/register$/);
  await page.getByRole('link', { name: 'Open the ceremony registration form' }).click();
  await expect(page).toHaveURL(/\/awards\/second-international\/register$/);
  await expect(page.getByRole('heading', { name: 'Register for the Ceremony' })).toBeVisible();
  await expect(page.getByText('Event date and venue are being finalised. Register your interest to receive ceremony updates.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByText('Enter your full name.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /privacy policy/ })).not.toBeChecked();
});

test('shows the awards link in the phone menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Awards', exact: true }).click();
  await expect(page).toHaveURL(/\/awards\/second-international$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Second International Awards Ceremony' })).toBeVisible();
});

test('treats a repeated ceremony email as the same registration', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const dialog = await openRegistration(page);
  await fillRegistration(page, 'Ada Ceremony Updated');
  await dialog.getByRole('button', { name: 'Submit registration' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Your registration of interest has been received.');

  await page.goto('/login');
  await page.getByRole('button', { name: 'Use password sign-in' }).click();
  await page.getByLabel('Email Address').fill('admin@ifsmhp.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMeNow!2026');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/ceremony-registrations');
  await expect(page.locator('#main').getByRole('heading', { name: 'Ceremony registrations' })).toBeVisible();
  const row = page.getByRole('row', { name: email });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Ada Ceremony Updated');
});
