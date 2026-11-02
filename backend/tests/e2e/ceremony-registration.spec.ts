import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const email = `ceremony-e2e-${Date.now()}@example.test`;

async function openRegistration(page: Page) {
  await page.goto('/awards/second-international/register');
  await expect(page.getByRole('heading', { level: 1, name: 'Register for the Ceremony' })).toBeVisible();
  await expect(page).toHaveURL(/\/awards\/second-international\/register$/);
}

async function fillRegistration(page: Page, name = 'Ada Ceremony') {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Phone number, including country code').fill('+44 7700 900123');
  await page.getByLabel('Institution / organisation').fill('Example Institute');
  await page.getByLabel('Delegate').check();
  await page.getByRole('checkbox', { name: /privacy policy/ }).check();
}

test('award interest CTAs go to membership registration', async ({ page }) => {
  await page.goto('/awards/second-international');
  await page.getByRole('link', { name: 'Register your interest' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Apply for IFSMHP Membership' })).toBeVisible();

  await page.goto('/awards/second-international');
  await page.locator('#ceremony-register-cta').click();
  await expect(page).toHaveURL(/\/register$/);
});

test('keeps entered values after validation and a server error, then saves once', async ({ page }) => {
  await openRegistration(page);
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByText('Enter your full name.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /privacy policy/ })).not.toBeChecked();
  await fillRegistration(page, 'Ada Ceremony');
  await page.getByLabel('Full name').fill('');
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await expect(page.getByLabel('Phone number, including country code')).toHaveValue('+44 7700 900123');

  await page.route('**/public/awards/second-international/registrations', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, message: 'Could not save your registration. Please try again.', errors: [] }),
  }));
  await page.getByLabel('Full name').fill('Ada Ceremony');
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByText('Could not save your registration. Please try again.')).toBeVisible();
  await expect(page.getByText('Your registration of interest has been received.')).toHaveCount(0);
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Ceremony');
  await page.unroute('**/public/awards/second-international/registrations');

  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByRole('status')).toHaveText('Your registration of interest has been received.');
  await expect(page.getByText(/sent you an email|email has been sent|confirmation email/i)).toHaveCount(0);
});

test('does not send a second registration while the first request is pending', async ({ page }) => {
  await openRegistration(page);
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
  await expect(page.getByRole('status')).toHaveText('Your registration of interest has been received.');
  expect(posts).toBe(1);
});

test('opens the ceremony page from the menu and the form from its QR address', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Awards', exact: true }).click();
  await expect(page).toHaveURL(/\/awards\/second-international$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Second International IFSMHP Awards 2026' })).toBeVisible();
  const qr = page.locator('[data-registration-url]');
  await expect(qr).toContainText('https://www.ifsmhp.com/awards/second-international/nominate');
  await expect(qr).toHaveAttribute('data-registration-url', 'https://www.ifsmhp.com/awards/second-international/nominate');
  await page.getByRole('link', { name: 'Open the award nomination form' }).click();
  await expect(page).toHaveURL(/\/awards\/second-international\/nominate$/);
  await expect(page.getByRole('heading', { name: 'Official nomination form' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit nomination' }).click();
  await expect(page.getByText("Enter the nominee's full name.")).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /does not guarantee selection/ })).not.toBeChecked();
});

test('shows the awards link in the phone menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Awards', exact: true }).click();
  await expect(page).toHaveURL(/\/awards\/second-international$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Second International IFSMHP Awards 2026' })).toBeVisible();
});

test('treats a repeated ceremony email as the same registration', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRegistration(page);
  await fillRegistration(page, 'Ada Ceremony Updated');
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByRole('status')).toHaveText('Your registration of interest has been received.');

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
