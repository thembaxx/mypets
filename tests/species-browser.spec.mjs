import { expect, test } from '@playwright/test';

const kinds = [
  { id: 'dog', kind: 'quadruped' },
  { id: 'bird', kind: 'avian' },
  { id: 'fish', kind: 'aquatic' },
  { id: 'gecko', kind: 'reptile' },
];

test('all illustrated animal candidates are real individual GLB files', async ({ request }) => {
  test.setTimeout(120_000);
  const ids = [
    'cat',
    'dog',
    'rabbit',
    'chicken',
    'fish',
    'hamster',
    'bird',
    'guinea-pig',
    'snake',
    'hedgehog',
    'ferret',
    'salamander',
    'iguana',
    'gecko',
    'angelfish',
    'budgie',
    'canary',
  ];
  for (const id of ids) {
    const url =
      id === 'cat'
        ? '/models/candidates/nuzzle-calico-rig.glb'
        : '/models/candidates/species/' + id + '.glb';
    const response = await request.get('http://127.0.0.1:3000' + url);
    expect(response.ok(), 'Missing ' + id + ' candidate').toBeTruthy();
    const bytes = Buffer.from(await response.body());
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(8 * 1024 * 1024);
  }
});

for (const { id, kind } of kinds) {
  test('the ' + kind + ' ' + id + ' opens its OWN animated 3D rig', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByLabel('Choose an animal to review').selectOption(id);
    await page.getByRole('button', { name: 'Open the Blender animal studio' }).click();
    const dialog = page.getByRole('dialog', {
      name: new RegExp(id + ' interactive 3d studio', 'i'),
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('authored 3D animation', {
      timeout: 20000,
    });
    await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Walk', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('button', { name: 'Eat', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Eat', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Close 3D studio' }).click();
    await expect(dialog).not.toBeVisible();
  });
}
