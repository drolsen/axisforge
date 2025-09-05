import { test, expect } from '@playwright/test';

test('panels are present', async ({ page }) => {
  await page.goto('/editor/');
  await expect(page.locator('#explorer')).toBeVisible();
  await expect(page.locator('#properties')).toBeVisible();
  await expect(page.locator('#viewport')).toBeVisible();
  await expect(page.locator('#console')).toBeVisible();
});

test('layout reloads from localStorage', async ({ page }) => {
  await page.goto('/editor/');
  await page.evaluate(() => {
    localStorage.setItem('editor-layout', JSON.stringify({
      leftWidth: 210,
      rightWidth: 190,
      bottomHeight: 120
    }));
  });
  await page.reload();
  const leftWidth = await page.evaluate(() => document.getElementById('explorer').style.width);
  const rightWidth = await page.evaluate(() => document.getElementById('properties').style.width);
  const bottomHeight = await page.evaluate(() => document.getElementById('console').style.height);
  expect(leftWidth).toBe('210px');
  expect(rightWidth).toBe('190px');
  expect(bottomHeight).toBe('120px');
});
