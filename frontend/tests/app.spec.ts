import { expect, test } from '@playwright/test';

test('navigates between the initial routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PinGo' })).toBeVisible();
  await page.getByRole('link', { name: '사용자' }).click();
  await expect(page.getByRole('heading', { name: '사용자' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '관리자' })).toBeVisible();
});
