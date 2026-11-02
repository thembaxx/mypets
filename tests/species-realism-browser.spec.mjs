import { expect, test } from '@playwright/test';

for (const species of ['dog', 'rabbit']) {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(species + ' upgraded rig moves on ' + viewport.width + 'px screen', async ({ page }) => {
      test.setTimeout(90_000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.goto('http://127.0.0.1:3000/3d-lab');
      await page.getByLabel('Choose an animal to review').selectOption(species);
      await page.getByRole('button', { name: 'Open the Blender animal studio' }).click();
      const dialog = page.getByRole('dialog', {
        name: new RegExp(species + ' interactive 3d studio', 'i'),
      });
      await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
        timeout: 20000,
      });
      const canvas = dialog.locator('canvas');
      await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Walk', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const pose1 = await canvas.screenshot();
      // WebKit can return two identical compositor snapshots if its software
      // WebGL draw is delayed. Sample multiple browser frames and still fail
      // if the 3D animal is genuinely frozen for the whole observation window.
      await expect
        .poll(async () => {
          const next = await canvas.screenshot({ animations: 'allow' });
          return Buffer.compare(pose1, next) !== 0;
        }, { timeout: 5000, intervals: [180, 240, 350, 500, 700] })
        .toBe(true);
      await dialog.getByRole('button', { name: 'Eat', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Eat', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await canvas.screenshot({
        path: 'test-results/' + species + '-realism-' + viewport.width + '.png',
      });
      await dialog.getByRole('button', { name: 'Pause motion' }).click();
      await expect(dialog.getByRole('button', { name: 'Resume motion' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
      expect(errors).toEqual([]);
    });
  }
}
