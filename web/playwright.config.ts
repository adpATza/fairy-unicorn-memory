import { defineConfig, devices } from '@playwright/test';

const port = 4173;
/** Set BASE_URL to test an already running server (for example Caddy with deploy/Caddyfile). */
const external = process.env.BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: external ?? `http://localhost:${port}/`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${port} --strictPort`,
        url: `http://localhost:${port}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
