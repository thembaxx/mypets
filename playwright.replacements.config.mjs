// npm run start, then:
// node /opt/codex/cua_node/lib/node_modules/playwright/cli.js test --config=playwright.replacements.config.mjs
// Else set MYPETS_PLAYWRIGHT_MODULE to an installed Playwright test.mjs.
const { defineConfig } = await import(
  process.env.MYPETS_PLAYWRIGHT_MODULE ?? '/opt/codex/cua_node/lib/node_modules/playwright/test.mjs'
);

export default defineConfig({
  testDir: './tests',
  testMatch: 'replacements-browser.spec.mjs',
  outputDir: './test-results/replacements',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: process.env.MYPETS_BASE_URL ?? 'http://127.0.0.1:3000',
    browserName: 'chromium',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.MYPETS_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile-portrait',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'mobile-landscape',
      use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
    },
  ],
});
