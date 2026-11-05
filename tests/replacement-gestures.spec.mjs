const { test, expect } = await import(
  process.env.MYPETS_PLAYWRIGHT_MODULE ?? '/opt/codex/cua_node/lib/node_modules/playwright/test.mjs'
);

test('paused pets support native orbit, pinch and keyboard inspection', async ({ page }, info) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mypets-v1',
      JSON.stringify({
        version: 1,
        pets: [{ id: 'pip', name: 'Pip', breed: 'Budgerigar', species: 'bird', ageMonths: 12 }],
        activePetId: 'pip',
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
  const open = page.getByRole('button', { name: 'Explore bird in 3D', exact: true });
  if (info.project.use.hasTouch) await open.tap();
  else await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('data-ready', 'true');
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  const canvas = dialog.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(300);
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.5;
  if (info.project.use.hasTouch) {
    const session = await page.context().newCDPSession(page);
    const touch = (type, points) =>
      session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ x: x - 35, y, id: 1 }]);
    for (let step = 1; step <= 5; step++)
      await touch('touchMove', [{ x: x - 35 + step * 15, y: y + step * 3, id: 1 }]);
    await touch('touchEnd', []);
    expect((await canvas.screenshot()).equals(before)).toBeFalsy();
    const orbit = await canvas.screenshot();
    await touch('touchStart', [
      { x: x - 20, y, id: 1 },
      { x: x + 20, y, id: 2 },
    ]);
    for (let step = 1; step <= 5; step++)
      await touch('touchMove', [
        { x: x - 20 - step * 7, y, id: 1 },
        { x: x + 20 + step * 7, y, id: 2 },
      ]);
    await touch('touchEnd', []);
    expect((await canvas.screenshot()).equals(orbit)).toBeFalsy();
    await session.detach();
  } else {
    await page.mouse.move(x - 35, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 15, { steps: 5 });
    await page.mouse.up();
    expect((await canvas.screenshot()).equals(before)).toBeFalsy();
  }
  const stage = dialog.locator('.replacement-stage');
  await stage.focus();
  const rotated = await canvas.screenshot();
  await page.keyboard.press('ArrowRight');
  expect((await canvas.screenshot()).equals(rotated)).toBeFalsy();
  await page.keyboard.press('Home');
  await expect(dialog).toHaveAttribute('data-animation-enabled', 'false');
  const close = dialog.getByRole('button', { name: 'Close 3D pet', exact: true });
  if (info.project.use.hasTouch) await close.tap();
  else await close.click();
  await expect(page.locator('canvas')).toHaveCount(0);
});
