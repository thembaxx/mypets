const { test, expect } = await import(
  process.env.MYPETS_PLAYWRIGHT_MODULE ?? '/opt/codex/cua_node/lib/node_modules/playwright/test.mjs'
);

async function openPet(page, id) {
  await page.getByRole('button', { name: `Explore ${id} in 3D`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('data-ready', 'true');
  await expect(dialog.locator('canvas')).toBeVisible();
  return dialog;
}

for (const id of ['cat', 'rabbit', 'bird']) {
  test(`${id} loads its real model with supported clips and separated controls`, async ({
    page,
  }, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/3d-pets/');
    const dialog = await openPet(page, id);
    await expect(dialog).toHaveAttribute('data-animation-enabled', 'true');
    await expect(dialog.getByRole('button', { name: 'Feed', exact: true })).toBeDisabled();
    if (id === 'rabbit') {
      await dialog.getByRole('button', { name: 'Move', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('Running');
    } else if (id === 'bird') {
      await dialog.getByRole('button', { name: 'Pet', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('Touch');
    }
    const header = await dialog.locator('header').boundingBox();
    const stage = await dialog.locator('.replacement-stage').boundingBox();
    const footer = await dialog.locator('footer').boundingBox();
    expect(stage.width).toBeGreaterThan(100);
    expect(stage.height).toBeGreaterThan(100);
    expect(header.y + header.height).toBeLessThanOrEqual(stage.y + 1);
    // Landscape uses a side panel, portrait/desktop uses a footer.
    expect(
      footer.x >= stage.x + stage.width - 1 || footer.y >= stage.y + stage.height - 1,
    ).toBeTruthy();
    await page.waitForTimeout(600);
    await dialog.screenshot({ path: `test-results/replacements/${info.project.name}-${id}.png` });
    await dialog.getByRole('button', { name: 'Close 3D pet' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('saved off persists across reload; no automatic frames while inspection works', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mypets-v1',
      JSON.stringify({
        version: 1,
        pets: [{ id: 'cat-1', name: 'Milo', breed: 'Shorthair', species: 'cat', ageMonths: 12 }],
        activePetId: 'cat-1',
        events: [],
        completed: [],
        trained: [],
        onboarded: true,
        sound: false,
        animalAnimations: false,
      }),
    ),
  );
  await page.goto('/3d-pets/');
  await page.reload();
  const dialog = await openPet(page, 'cat');
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  await expect(dialog.getByRole('status')).toContainText('Animations paused');
  await page.waitForTimeout(700);
  const before = await dialog.locator('canvas').screenshot();
  await page.waitForTimeout(350);
  expect((await dialog.locator('canvas').screenshot()).equals(before)).toBeTruthy();
  await dialog.getByRole('button', { name: 'Rotate left', exact: true }).click();
  expect((await dialog.locator('canvas').screenshot()).equals(before)).toBeFalsy();
  const portrait = page.viewportSize().width < page.viewportSize().height;
  await page.setViewportSize(portrait ? { width: 844, height: 390 } : { width: 390, height: 844 });
  await expect(dialog.locator('canvas')).toBeVisible();
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  await expect(page.locator('canvas')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore cat in 3D', exact: true })).toBeFocused();
});

test('reduced motion stops playback and pause/resume preserves inspection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/3d-pets/');
  let dialog = await openPet(page, 'rabbit');
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  await expect(
    dialog.getByRole('button', { name: 'Pause animations', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  dialog = await openPet(page, 'rabbit');
  await dialog.getByRole('button', { name: 'Pause animations', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  await dialog.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'true');
});

test('failed download returns the actual illustration and keeps close accessible', async ({
  page,
}) => {
  await page.route('**/models/replacements/cat.glb', (route) => route.abort());
  await page.goto('/3d-pets/');
  await page.getByRole('button', { name: 'Explore cat in 3D', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('could not be opened');
  await expect(dialog.getByRole('img', { name: 'cat illustration', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close 3D pet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('repeated mounts dispose canvases and context loss recovers to illustration', async ({
  page,
}) => {
  await page.goto('/3d-pets/');
  for (let i = 0; i < 3; i++) {
    const dialog = await openPet(page, 'cat');
    await expect(page.locator('canvas')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Close 3D pet', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  const dialog = await openPet(page, 'cat');
  await dialog.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(dialog.getByRole('alert')).toContainText('could not be opened');
  await expect(page.locator('canvas')).toHaveCount(0);
});
