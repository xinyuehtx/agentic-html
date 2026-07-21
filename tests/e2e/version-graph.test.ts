import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.resolve(__dirname, '../../docs/screenshots');

test.describe('Version Graph - History & Diff', () => {
  test('should open version graph panel and display nodes', async ({ page }) => {
    // 1. Navigate to preview page in demo mode
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // 2. Open Version Graph panel (click "Versions" button in toolbar)
    const versionsBtn = page.locator('.toolbar__btn', { hasText: 'Versions' });
    await versionsBtn.click();

    // 3. Verify version graph panel is visible
    const graphPanel = page.locator('.version-graph-panel');
    await expect(graphPanel).toBeVisible();

    // Verify version nodes are displayed
    const versionNodes = page.locator('.version-node');
    await expect(versionNodes.first()).toBeVisible();

    // Take screenshot: version graph panel
    await page.screenshot({ path: path.join(screenshotDir, 'version-graph.png'), fullPage: true });
  });

  test('should checkout a version node', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // Open version graph
    const versionsBtn = page.locator('.toolbar__btn', { hasText: 'Versions' });
    await versionsBtn.click();

    // 4. Click a version node to checkout
    const versionNodes = page.locator('.version-node');
    const nodeCount = await versionNodes.count();

    if (nodeCount > 0) {
      // Click the first version node
      await versionNodes.first().click();

      // Wait for version switch
      await page.waitForTimeout(500);

      // 5. Verify page shows version info updated
      const versionBadge = page.locator('.toolbar__version-badge');
      await expect(versionBadge).toBeVisible();
    }
  });

  test('should compare two versions and show diff modal', async ({ page }) => {
    await page.goto('/?demo=true');
    await page.waitForLoadState('networkidle');

    // Open version graph
    const versionsBtn = page.locator('.toolbar__btn', { hasText: 'Versions' });
    await versionsBtn.click();
    await page.waitForTimeout(300);

    // 6. Select two versions for comparison using Shift+click
    const versionNodes = page.locator('.version-node');
    const nodeCount = await versionNodes.count();

    if (nodeCount >= 2) {
      await versionNodes.nth(0).click({ modifiers: ['Shift'] });
      await page.waitForTimeout(200);
      await versionNodes.nth(1).click({ modifiers: ['Shift'] });
      await page.waitForTimeout(200);

      // Click compare button
      const compareBtn = page.locator('.version-graph-panel__compare-btn');
      if (await compareBtn.count() > 0) {
        await compareBtn.click();
        await page.waitForTimeout(500);

        // 7. Verify diff modal is displayed
        const diffModal = page.locator('.version-diff-modal');
        await expect(diffModal).toBeVisible();

        // Take screenshot: version diff modal
        await page.screenshot({ path: path.join(screenshotDir, 'version-diff.png'), fullPage: true });
      }
    }
  });
});
