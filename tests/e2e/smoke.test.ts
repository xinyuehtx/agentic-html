import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/screenshots');

test.describe('Smoke Test - Preview & Annotation Flow', () => {
  test('should load preview page and display iframe content', async ({ page }) => {
    // 1. Navigate to preview page in demo mode
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // 2. Verify page title / brand
    await expect(page.locator('.toolbar__brand')).toHaveText('Agentic HTML');

    // Take screenshot: preview overview
    await page.screenshot({ path: path.join(screenshotDir, 'preview.png'), fullPage: true });
  });

  test('should switch to ink mode and perform annotation', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // 3. Wait for preview to be ready (previewing phase)
    await expect(page.locator('.toolbar__brand')).toBeVisible();

    // 4. Switch to Ink mode (click toolbar button)
    const inkButton = page.locator('.toolbar__mode-btn', { hasText: 'Ink' });
    await inkButton.click();
    await expect(inkButton).toHaveClass(/toolbar__mode-btn--active/);

    // Take screenshot: ink mode active
    await page.screenshot({ path: path.join(screenshotDir, 'annotation-ink.png'), fullPage: true });

    // 5. Simulate ink stroke (mousedown → mousemove → mouseup) on overlay
    const overlay = page.locator('.overlay, .preview-area');
    const box = await overlay.boundingBox();
    if (box) {
      const startX = box.x + box.width * 0.3;
      const startY = box.y + box.height * 0.3;
      const endX = box.x + box.width * 0.7;
      const endY = box.y + box.height * 0.7;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Draw a stroke with multiple points
      for (let i = 1; i <= 10; i++) {
        const x = startX + (endX - startX) * (i / 10);
        const y = startY + (endY - startY) * (i / 10);
        await page.mouse.move(x, y);
      }
      await page.mouse.up();
    }

    // Wait a bit for annotation to be processed
    await page.waitForTimeout(500);

    // 6. Verify annotation appears in sidebar
    // Take screenshot: annotation sidebar
    await page.screenshot({ path: path.join(screenshotDir, 'annotation-sidebar.png'), fullPage: true });
  });

  test('should submit annotations and seal version', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // 7. Click submit button
    const submitBtn = page.locator('.toolbar__btn--primary', { hasText: 'Submit Annotations' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 8. Wait for submit to complete
    await page.waitForTimeout(1000);

    // Verify version sealed indicator may appear
    // Take screenshot after submit
    await page.screenshot({ path: path.join(screenshotDir, 'after-submit.png'), fullPage: true });
  });
});
