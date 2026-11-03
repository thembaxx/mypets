import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

test('reference-style chibi GLBs are three distinct skinned seven-action animals', async ({ request }) => {
  const digests = new Set();
  for (const id of ['cat', 'dog', 'rabbit']) {
    const response = await request.get(
      'http://127.0.0.1:3000/models/candidates/chibi/' + id + '.glb',
    );
    expect(response.ok(), 'Missing generated chibi ' + id).toBeTruthy();
    const bytes = Buffer.from(await response.body());
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
    const length = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
    expect(gltf.skins?.length).toBeGreaterThan(0);
    expect(gltf.animations?.length).toBe(7);
    expect(gltf.nodes.some((node) => node.name === id + ' oversized plush head')).toBe(true);
    const digest = createHash('sha256').update(bytes).digest('hex');
    expect(digests.has(digest)).toBe(false);
    digests.add(digest);
  }
  expect(digests.size).toBe(3);
});

for (const id of ['cat', 'dog', 'rabbit']) {
  test('chibi ' + id + ' has interactive happy Play and safe previous-model toggle', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByLabel('Choose an animal to review').selectOption(id);
    const reference = page.getByRole('button', { name: 'Joyful video-reference prototype' });
    await expect(reference).toHaveAttribute('aria-pressed', 'true');
    const launch = page.getByRole('button', {
      name: id === 'cat' ? 'Open the Blender cat studio' : 'Open the Blender animal studio',
    });
    await launch.click();
    const dialog = page.getByRole('dialog', { name: /interactive 3d studio/i });
    await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 25_000,
    });
    await dialog.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const canvas = dialog.locator('canvas');
    await expect(canvas).toBeVisible();
    const frame = await canvas.screenshot();
    await expect.poll(async () => Buffer.compare(frame, await canvas.screenshot()) !== 0).toBe(true);
    await canvas.screenshot({ path: 'test-results/chibi-' + id + '-mobile-play.png' });
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    const previous = page.getByRole('button', { name: 'Previous anatomical study' });
    await previous.click();
    await expect(previous).toHaveAttribute('aria-pressed', 'true');
    await launch.click();
    const original = page.getByRole('dialog', { name: /interactive 3d studio/i });
    await expect(original.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 25_000,
    });
    await original.getByRole('button', { name: 'Close 3D studio' }).click();
    expect(errors).toEqual([]);
  });
}
