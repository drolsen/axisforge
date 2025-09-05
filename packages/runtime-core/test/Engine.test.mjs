import test from 'ava';
import Engine from '../src/Engine.js';

function useFakeRAF(step = 16) {
  let time = 0;
  const base =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  const raf = cb => setTimeout(() => {
    time += step;
    cb(base + time);
  }, 0);
  const caf = id => clearTimeout(id);
  const g = globalThis;
  const prevRAF = g.requestAnimationFrame;
  const prevCAF = g.cancelAnimationFrame;
  g.requestAnimationFrame = raf;
  g.cancelAnimationFrame = caf;
  return () => {
    g.requestAnimationFrame = prevRAF;
    g.cancelAnimationFrame = prevCAF;
  };
}

test('engine loop updates subsystems and provides dt', async t => {
  const restore = useFakeRAF();
  const engine = new Engine();

  let updates = 0;
  let lastCall = '';
  let lateAfterUpdate = true;
  const dts = [];

  const subsystem = {
    update(dt) {
      updates++;
      dts.push(dt);
      lastCall = 'update';
      if (updates === 3) engine.stop();
    },
    lateUpdate() {
      if (lastCall !== 'update') lateAfterUpdate = false;
      lastCall = 'late';
    },
  };

  engine.add(subsystem);

  await new Promise(resolve => {
    const origStop = engine.stop.bind(engine);
    engine.stop = () => {
      origStop();
      resolve();
    };
    engine.start();
  });

  restore();

  t.true(updates >= 3);
  t.true(lateAfterUpdate);
  t.true(dts.every(dt => dt > 0));
});
