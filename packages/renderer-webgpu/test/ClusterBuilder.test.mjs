import test from 'ava';
import ClusterBuilder from '../src/Lighting/ClusterBuilder.js';

test('computes logarithmic slice boundaries', t => {
  const builder = new ClusterBuilder({ tileSize: 64, zSlices: 4 });
  builder.update({
    width: 800,
    height: 600,
    near: 1,
    far: 100,
    fov: Math.PI / 2,
    aspect: 800 / 600
  });

  const bounds = builder.sliceZBounds;
  const expected = [];
  for (let i = 0; i <= 4; i++) {
    expected.push(1 * Math.pow(100 / 1, i / 4));
  }

  t.is(bounds.length, expected.length);
  for (let i = 0; i < bounds.length; i++) {
    t.true(Math.abs(bounds[i] - expected[i]) < 1e-6);
  }
});
