import { test, expect } from '@playwright/test';

test.describe('real WebGL cat lab', () => {
  test('desktop: GLB loads, facial actions and feeding actually animate', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByRole('button', { name: 'Open interactive 3D cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Preview rigged Blender cat (experimental)' }).click();
    await expect(
      dialog.getByRole('button', { name: 'Return to original procedural 3D cat' }),
    ).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 15000,
    });
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
    await expect(dialog.getByRole('status')).toContainText('Groom (7 clips)');
    await dialog.getByRole('button', { name: 'Sniff', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Sniff', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByRole('status')).toContainText('Sniff (7 clips)');
    await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Walk', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Pause motion' }).click();
    await expect(dialog.getByRole('button', { name: 'Paused' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('mobile: studio actions remain accessible with touch controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByRole('button', { name: 'Open interactive 3D cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await dialog.getByRole('button', { name: 'Preview rigged Blender cat (experimental)' }).click();
    await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 15000,
    });
    await dialog.getByRole('button', { name: 'Eat', exact: true }).click();
    await dialog.locator('canvas').screenshot({ path: 'test-results/calico-mobile-eating.png' });
    await dialog.getByRole('combobox', { name: 'Cat facial expression' }).selectOption('curious');
    await expect(dialog.getByRole('combobox', { name: 'Cat facial expression' })).toHaveValue(
      'curious',
    );
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
