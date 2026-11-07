import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test.describe('code-native Three.js cat lab', () => {
  test('desktop: procedural cat renders and facial actions animate', async ({ page }) => {
    // Software WebGL and four screenshots can exceed Playwright's default 30s
    // despite a responsive control and valid animation frames.
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByRole('button', { name: 'Open the code-native cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('Original 3D calico study');
    const canvas = dialog.locator('canvas');
    await expect(canvas).toBeVisible();
    await dialog.getByRole('button', { name: 'Eat', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Eat', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.waitForTimeout(400);
    const first = await canvas.screenshot();
    await page.waitForTimeout(550);
    const second = await canvas.screenshot();
    expect(Buffer.compare(first, second)).not.toBe(0);
    await page.screenshot({ path: 'test-results/calico-desktop-eating.png' });
    await dialog.getByRole('button', { name: 'Groom', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Groom', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.waitForTimeout(400);
    const groomStart = await canvas.screenshot();
    await page.waitForTimeout(500);
    const groomEnd = await canvas.screenshot();
    expect(Buffer.compare(groomStart, groomEnd)).not.toBe(0);
    await canvas.screenshot({ path: 'test-results/calico-desktop-grooming.png' });
    await dialog.getByRole('button', { name: 'Sniff', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Sniff', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Walk', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Verify the real clickable control, not only state mutation via JS.
    await dialog.getByRole('button', { name: 'Pause motion' }).click();
    await expect(dialog.getByRole('button', { name: 'Resume motion' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Resume motion' }).click();
    await expect(dialog.getByRole('button', { name: 'Pause motion' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('mobile: studio actions remain accessible with touch controls', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByRole('button', { name: 'Open the code-native cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await expect(dialog.getByRole('status')).toContainText('Original 3D calico study');
    await dialog.getByRole('button', { name: 'Eat', exact: true }).click();
    await dialog.locator('canvas').screenshot({ path: 'test-results/calico-mobile-eating.png' });
    // On a narrow screen the bottom controls must remain tappable, not clipped
    // behind the continuously rendering WebGL surface.
    await dialog.getByRole('button', { name: 'Pause motion' }).click();
    await expect(dialog.getByRole('button', { name: 'Resume motion' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Resume motion' }).click();
    await dialog.getByRole('combobox', { name: 'Cat facial expression' }).selectOption('curious');
    await expect(dialog.getByRole('combobox', { name: 'Cat facial expression' })).toHaveValue(
      'curious',
    );
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
