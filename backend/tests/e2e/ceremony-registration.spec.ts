import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('award interest CTAs and legacy ceremony register path go to membership registration', async ({ page }) => {
  await page.goto('/awards/second-international');
  await page.getByRole('link', { name: 'Register your interest' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Apply for IFSMHP Membership' })).toBeVisible();

  await page.goto('/awards/second-international');
  await page.locator('#ceremony-register-cta').click();
  await expect(page).toHaveURL(/\/register$/);

  await page.goto('/awards/second-international/register');
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Apply for IFSMHP Membership' })).toBeVisible();
});

test('opens the ceremony page from the menu and the nomination form from its QR address', async ({ page }) => {
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
