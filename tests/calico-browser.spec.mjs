import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test.describe('real WebGL cat lab', () => {
  test('branch serves the verified textured rig instead of the old flat-coat candidate', async ({ request }) => {
    const response = await request.get(
      'http://127.0.0.1:3000/models/candidates/nuzzle-calico-rig.glb',
    );
    expect(response.ok()).toBeTruthy();
    const bytes = Buffer.from(await response.body());
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
    const normal = (gltf.images ?? []).find((image) =>
      image.name?.includes('calico-short-fur-normal'),
    );
    expect(normal?.bufferView).toBeDefined();
    expect(gltf.bufferViews[normal.bufferView].byteLength).toBeGreaterThan(2500);
    expect(
      (gltf.materials ?? []).filter((material) => material.normalTexture !== undefined).length,
    ).toBeGreaterThanOrEqual(3);
  });

  test('desktop: GLB loads, facial actions and feeding actually animate', async ({ page }) => {
    // Software WebGL and four screenshots can exceed Playwright's default 30s
    // despite a responsive control and valid animation frames.
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByRole('button', { name: 'Open the Blender cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await expect(dialog).toBeVisible();
    // Dedicated /3d-lab opens the actual candidate; the procedural fallback
    // remains reachable without changing the default pet collection.
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
    await expect(dialog.getByRole('status')).toContainText('Sniff (7 clips)');
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
    await page.getByRole('button', { name: 'Open the Blender cat studio' }).click();
    const dialog = page.getByRole('dialog', { name: /calico cat interactive 3d studio/i });
    await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 15000,
    });
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
