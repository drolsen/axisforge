import test from 'ava';
import { Engine } from '../src/Engine.js';

test('engine calls subsystems in order with positive dt', async t => {
  let current = typeof performance !== 'undefined' ? performance.now() : 0;
  globalThis.requestAnimationFrame = cb => setTimeout(() => { current += 16; cb(current); }, 0);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);

  const engine = new Engine();
  const order = [];
  const dts = [];

  await new Promise(resolve => {
    let frames = 0;

    engine.add({
      update(dt) {
        order.push('a');
        dts.push(dt);
        frames += 1;
        if (frames >= 3) {
          engine.stop();
          resolve();
        }
      }
    });

    engine.add({
      update(dt) {
        order.push('b');
        dts.push(dt);
      }
    });

    engine.start();
  });

  t.true(order.length >= 6);
  for (let i = 0; i < order.length; i += 2) {
    t.is(order[i], 'a');
    t.is(order[i + 1], 'b');
  }
  dts.forEach(dt => t.true(dt > 0));
});
