import { test, expect } from '@playwright/test';

test('drag translates selected cube by 1m', async ({ page }) => {
  await page.goto('/editor/');
  await page.getByText('Cube').click();
  const canvas = page.locator('#viewport canvas');
  const box = await canvas.boundingBox();
  const startX = box.x + box.width / 2 + 60;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY);
  await page.mouse.up();
  const val = await page.locator('#properties input[name="CFrame"]').inputValue();
  expect(val).toBe('1,0,0');
});
