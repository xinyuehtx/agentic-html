import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5273',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev:ui',
    port: 5273,
    reuseExistingServer: true,
  },
});
