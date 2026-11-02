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
      await page.waitForTimeout(250);
      const pose1 = await canvas.screenshot();
      await page.waitForTimeout(450);
      const pose2 = await canvas.screenshot();
      expect(Buffer.compare(pose1, pose2)).not.toBe(0);
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
