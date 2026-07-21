/**
 * update-docs.ts
 *
 * Automated screenshot generation script for documentation.
 * Launches the UI dev server in demo mode and uses Playwright to capture screenshots
 * of key application states.
 *
 * Usage: npx tsx scripts/update-docs.ts
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'docs', 'screenshots');

const SCREENSHOTS = [
  { name: 'preview.png', description: 'Preview page overview' },
  { name: 'annotation-ink.png', description: 'Ink annotation in progress' },
  { name: 'annotation-sidebar.png', description: 'Annotation sidebar display' },
  { name: 'version-graph.png', description: 'Version graph panel' },
  { name: 'version-diff.png', description: 'Version diff comparison view' },
  { name: 'html-error-feedback.png', description: 'HTML error feedback banner' },
];

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function startDevServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'dev:ui'], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        started = true;
        // Assume it started if no error after 8s
        resolve(child);
      }
    }, 8000);

    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('localhost') || output.includes('Local:')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve(child);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      // Vite may output on stderr too
      const output = data.toString();
      if (output.includes('localhost') || output.includes('Local:')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve(child);
        }
      }
    });

    child.on('error', (err) => {
      if (!started) {
        started = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

async function captureScreenshots() {
  // Dynamic import to handle case where playwright is not fully installed
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const baseURL = 'http://localhost:5173';

  try {
    // Screenshot 1: Preview page overview (demo mode with content)
    console.log('  📸 Capturing preview.png...');
    await page.goto(`${baseURL}/?demo=true`);
    await page.waitForLoadState('networkidle');
    // Wait for React to render the preview content
    await page.waitForSelector('.toolbar__brand', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'preview.png'),
      fullPage: true,
    });

    // Screenshot 2: Ink annotation mode
    console.log('  📸 Capturing annotation-ink.png...');
    const inkBtn = page.locator('.toolbar__mode-btn', { hasText: 'Ink' });
    if (await inkBtn.count() > 0) {
      await inkBtn.click();
      await page.waitForTimeout(300);
    }
    // Simulate a stroke on the preview area
    const previewArea = page.locator('.preview-area');
    const box = await previewArea.boundingBox();
    if (box) {
      const startX = box.x + box.width * 0.2;
      const startY = box.y + box.height * 0.3;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await page.mouse.move(
          startX + i * 40,
          startY + Math.sin(i * 0.8) * 30
        );
      }
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'annotation-ink.png'),
      fullPage: true,
    });

    // Screenshot 3: Annotation sidebar
    console.log('  📸 Capturing annotation-sidebar.png...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'annotation-sidebar.png'),
      fullPage: true,
    });

    // Screenshot 4: Version graph panel
    console.log('  📸 Capturing version-graph.png...');
    // Switch back to browse mode first
    const browseBtn = page.locator('.toolbar__mode-btn', { hasText: 'Browse' });
    if (await browseBtn.count() > 0) {
      await browseBtn.click();
      await page.waitForTimeout(200);
    }
    // Open version graph
    const versionsBtn = page.locator('.toolbar__btn', { hasText: 'Versions' });
    if (await versionsBtn.count() > 0) {
      await versionsBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'version-graph.png'),
      fullPage: true,
    });

    // Screenshot 5: Version diff view
    console.log('  📸 Capturing version-diff.png...');
    // Select two version nodes for comparison using shift+click
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
      }
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'version-diff.png'),
      fullPage: true,
    });

    // Screenshot 6: HTML error feedback
    console.log('  📸 Capturing html-error-feedback.png...');
    // Navigate to demo mode with errors enabled
    await page.goto(`${baseURL}/?demo=true&errors=true`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.toolbar__brand', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'html-error-feedback.png'),
      fullPage: true,
    });

    console.log('✅ All screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

async function verifyDocReferences() {
  const files = ['README.md', 'README.zh-CN.md', 'blog/html-editor-plugin.md'];
  console.log('\n📋 Verifying screenshot references in docs...');
  for (const file of files) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const refs = SCREENSHOTS.filter((s) => content.includes(`docs/screenshots/${s.name}`));
      if (refs.length > 0) {
        console.log(`  ✓ ${file}: ${refs.length} screenshot reference(s) found`);
      } else {
        console.log(`  ○ ${file}: no screenshot references found`);
      }
    }
  }
}

async function verifyScreenshots() {
  console.log('\n🔍 Verifying screenshot file sizes...');
  let allValid = true;
  for (const shot of SCREENSHOTS) {
    const filePath = path.join(SCREENSHOT_DIR, shot.name);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      const valid = stats.size > 10240; // > 10KB indicates real content
      const icon = valid ? '✓' : '⚠️';
      console.log(`  ${icon} ${shot.name}: ${sizeKB} KB`);
      if (!valid) allValid = false;
    } else {
      console.log(`  ✗ ${shot.name}: MISSING`);
      allValid = false;
    }
  }
  return allValid;
}

async function main() {
  console.log('🚀 update-docs: Generating documentation screenshots\n');

  await ensureScreenshotDir();

  let devServer: ChildProcess | null = null;

  try {
    // Start Vite dev server
    console.log('🌐 Starting dev server...');
    devServer = await startDevServer();
    console.log('✅ Dev server started\n');

    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📸 Capturing screenshots...');
    await captureScreenshots();
  } catch (err: any) {
    const message = err?.message || String(err);
    if (
      message.includes('browserType.launch') ||
      message.includes('Executable doesn\'t exist') ||
      message.includes('Cannot find module') ||
      message.includes('browser') ||
      message.includes('chromium')
    ) {
      console.error(`\n❌ Browser not available: ${message.split('\n')[0]}`);
      console.error('   Run: npx playwright install chromium');
      process.exit(1);
    } else {
      console.error(`\n❌ Error during screenshot capture: ${message}`);
      process.exit(1);
    }
  } finally {
    // Kill dev server
    if (devServer) {
      devServer.kill('SIGTERM');
      console.log('\n🛑 Dev server stopped');
    }
  }

  // Verify screenshots
  const valid = await verifyScreenshots();
  await verifyDocReferences();

  if (valid) {
    console.log('\n✨ Done! All screenshots have real content.');
  } else {
    console.log('\n⚠️  Some screenshots may not have sufficient content. Check above for details.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
