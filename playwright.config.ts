import { defineConfig, devices } from '@playwright/test'

const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const localBaseUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: configuredBaseUrl ?? localBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-320',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 720 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: configuredBaseUrl ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: localBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
})
