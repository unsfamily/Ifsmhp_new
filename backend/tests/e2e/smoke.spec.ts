import { expect, test } from '@playwright/test';

test('public home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/IFSMHP/);
  await expect(
    page.getByRole('heading', { name: /Advancing Global Research/ }),
  ).toBeVisible();
});

test('an unknown email is not given a sign-in code', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill('nobody-playwright@example.test');
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click();
  await expect(page.getByText('No account found with this email.')).toBeVisible();
});

test('an administrator can sign in with a password', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use password sign-in' }).click();
  await page.getByLabel('Email Address').fill('admin@ifsmhp.local');
  await page.getByRole('textbox', { name: 'Password' }).fill('ChangeMeNow!2026');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Administrator', { exact: true })).toBeVisible();
});
