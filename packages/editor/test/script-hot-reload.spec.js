import { test, expect } from '@playwright/test';

test('client script hot reload', async ({ page }) => {
  await page.goto('/editor/');
  await page.click('text=ClientScript');
  const consoleBody = page.locator('#console .panel-body');
  await expect(consoleBody.locator('div').last()).toHaveText('hello client');
  await page.fill('#code textarea', "console.log('updated')");
  await expect(consoleBody.locator('div').last()).toHaveText('updated');
});
