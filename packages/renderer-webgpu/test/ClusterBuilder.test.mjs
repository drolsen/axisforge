import test from 'ava';
import ClusterBuilder from '../src/Lighting/ClusterBuilder.js';

test('ClusterBuilder bins lights into correct clusters', t => {
  const builder = new ClusterBuilder({ xSlices: 2, ySlices: 2, zSlices: 2 });
  const camera = {
    fov: Math.PI / 2,
    aspect: 1,
    near: 1,
    far: 5,
  };
  const lights = [
    { position: [-1, 0.5, -2], radius: 0.1 },
    { position: [2, -0.5, -4], radius: 0.1 },
  ];
  const { clusters, lightIndices } = builder.build(camera, lights);
  t.is(clusters.length, builder.clusterCount * 2);
  t.deepEqual(Array.from(clusters.slice(0, 2)), [0, 1]);
  const idx = 7 * 2;
  t.deepEqual(Array.from(clusters.slice(idx, idx + 2)), [1, 1]);
  t.deepEqual(Array.from(lightIndices), [0, 1]);
});
