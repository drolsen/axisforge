import { meshFromSDF } from '../MesherDualContour.js';

self.onmessage = (e) => {
  const { size, sdf } = e.data;
  const mesh = meshFromSDF({ size, values: sdf });
  self.postMessage(mesh);
};
