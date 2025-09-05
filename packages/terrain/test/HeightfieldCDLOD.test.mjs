import test from 'ava';
import HeightfieldCDLOD from '../src/HeightfieldCDLOD.js';

test('select LOD based on distance', t => {
  const lodDistances = [20, 60, 180, 540];
  const terrain = new HeightfieldCDLOD({ tileCount: 1, tileSize: 1, lodDistances, morphRange: 10 });
  t.is(terrain.getLod(10), 0);
  t.is(terrain.getLod(40), 1);
  t.is(terrain.getLod(160), 2);
  t.is(terrain.getLod(400), 3);
});

test('morph factor within range', t => {
  const lodDistances = [20, 60];
  const terrain = new HeightfieldCDLOD({ tileCount: 1, tileSize: 1, lodDistances, morphRange: 10 });
  const d = 15; // between 10 and 20 (morph range before first threshold)
  const f = terrain.morphFactor(d, 0);
  t.true(f > 0 && f < 1);
  t.is(terrain.morphFactor(10, 0), 0);
  t.is(terrain.morphFactor(20, 0), 1);
});
