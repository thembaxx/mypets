import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    assert.ok((await page.locator('body').innerText()).trim().length > 50);
    await page.waitForTimeout(600);
    assert.deepEqual(errors, [], `No JavaScript errors at ${viewport.width}px`);
    console.log(`PASS responsive static/pet app: ${viewport.width}x${viewport.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
