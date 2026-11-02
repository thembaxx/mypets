import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

const kinds = [
  { id: 'dog', kind: 'quadruped' },
  { id: 'rabbit', kind: 'quadruped' },
  { id: 'hamster', kind: 'quadruped' },
  { id: 'guinea-pig', kind: 'quadruped' },
  { id: 'ferret', kind: 'quadruped' },
  { id: 'hedgehog', kind: 'quadruped' },
  { id: 'bird', kind: 'avian' },
  { id: 'budgie', kind: 'avian' },
  { id: 'canary', kind: 'avian' },
  { id: 'chicken', kind: 'avian' },
  { id: 'fish', kind: 'aquatic' },
  { id: 'angelfish', kind: 'aquatic' },
  { id: 'snake', kind: 'reptile' },
  { id: 'iguana', kind: 'reptile' },
  { id: 'gecko', kind: 'reptile' },
  { id: 'salamander', kind: 'reptile' },
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
  const modelDigests = new Set();
  for (const id of ids) {
    const url =
      id === 'cat'
        ? '/models/candidates/nuzzle-calico-rig.glb'
        : '/models/candidates/species/' + id + '.glb';
    const response = await request.get('http://127.0.0.1:3000' + url);
    expect(response.ok(), 'Missing ' + id + ' candidate').toBeTruthy();
    const bytes = Buffer.from(await response.body());
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.length).toBeLessThan(8 * 1024 * 1024);
    // Parse the real served asset, not the Blender source manifest.
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(
      bytes
        .subarray(20, 20 + jsonLength)
        .toString('utf8')
        .trim(),
    );
    expect(gltf.skins?.length, 'Missing skinned skeleton for ' + id).toBeGreaterThan(0);
    const clipNames = (gltf.animations ?? []).map((clip) => clip.name.toLowerCase());
    for (const action of ['idle', 'walk', 'eat', 'play', 'rest', 'groom', 'sniff']) {
      expect(
        clipNames.some((name) => name.includes(action)),
        'Missing ' + action + ' clip in served ' + id + ' rig',
      ).toBe(true);
    }
    // Prevent a fallback or stale CDN response from silently serving one
    // generic animal model for different illustrated pet species.
    const digest = createHash('sha256').update(bytes).digest('hex');
    expect(modelDigests.has(digest), 'Duplicate 3D model for ' + id).toBe(false);
    modelDigests.add(digest);
  }
  expect(modelDigests.size).toBe(ids.length);
});

for (const { id, kind } of kinds) {
  test('the ' + kind + ' ' + id + ' opens its OWN animated 3D rig', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:3000/3d-lab');
    await page.getByLabel('Choose an animal to review').selectOption(id);
    await page.getByRole('button', { name: 'Open the Blender animal studio' }).click();
    const dialog = page.getByRole('dialog', {
      name: new RegExp(id.replaceAll('-', ' ') + ' interactive 3d studio', 'i'),
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
