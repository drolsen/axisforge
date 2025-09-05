// Playwright configuration for editor tests
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/editor/test',
  webServer: {
    command: 'node scripts/dev-server.mjs',
    url: 'http://localhost:5173/editor/',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe'
  },
  use: {
    baseURL: 'http://localhost:5173'
  }
});
