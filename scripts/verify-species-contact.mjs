import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = process.argv[2];
assert.ok(directory, 'Pass generated Blender species output directory');

const kinds = {
  dog: 'quadruped',
  rabbit: 'quadruped',
  hamster: 'quadruped',
  'guinea-pig': 'quadruped',
  ferret: 'quadruped',
  hedgehog: 'quadruped',
  chicken: 'bird',
  bird: 'bird',
  budgie: 'bird',
  canary: 'bird',
  fish: 'fish',
  angelfish: 'fish',
  snake: 'snake',
  iguana: 'reptile',
  gecko: 'reptile',
  salamander: 'reptile',
};

for (const [species, kind] of Object.entries(kinds)) {
  const filename = join(directory, species + '-locomotion-audit.json');
  assert.ok(existsSync(filename), species + ' missing evaluated Blender contact report');
  const report = JSON.parse(readFileSync(filename, 'utf8'));
  assert.equal(report.species, species);
  assert.equal(report.kind, kind);
  assert.equal(report.version, 1);
  assert.ok(report.frames >= 20);
  assert.match(report.status, /REVIEW_ONLY/);
  const contact = kind === 'bird' ? report.toe_contact : report.paw_contact;
  if (kind === 'quadruped' || kind === 'reptile' || kind === 'bird') {
    assert.equal(Object.keys(contact ?? {}).length, kind === 'bird' ? 2 : 4);
    for (const [limb, values] of Object.entries(contact)) {
      assert.ok(values.stance_sample_pairs >= 1, species + ' has no stance pairs: ' + limb);
      for (const metric of [
        'max_sampled_xy_drift_m',
        'total_sampled_xy_travel_m',
        'minimum_contact_z_m',
        'maximum_contact_z_m',
      ]) {
        assert.ok(Number.isFinite(values[metric]), species + ': nonfinite ' + metric);
      }
      assert.ok(
        values.max_sampled_xy_drift_m >= 0 && values.max_sampled_xy_drift_m < 10,
        species + ': corrupt contact displacement data',
      );
      assert.ok(
        values.minimum_contact_z_m <= values.maximum_contact_z_m,
        species + ': impossible foot-height range',
      );
    }
  } else {
    const surface = report.moving_surface;
    assert.ok(surface?.name, species + ' needs moving fin/body geometry');
    for (const metric of ['sampled_xy_path_m', 'lateral_range_m', 'vertical_range_m']) {
      assert.ok(Number.isFinite(surface[metric]) && surface[metric] >= 0,
        species + ': invalid ' + metric);
    }
  }
  console.log('SPECIES_EVALUATED_MOTION_REPORT', species, kind);
}
console.log('ALL_16_SPECIES_EVALUATED_MOTION_REPORTS_PASS');
