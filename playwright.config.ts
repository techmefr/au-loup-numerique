import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3199' },
  webServer: { command: 'PORT=3199 pnpm start', port: 3199, reuseExistingServer: false },
});
