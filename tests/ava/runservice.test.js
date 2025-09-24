import test from 'ava';
import { RunService } from '../../engine/services/RunService.js';

const createRunService = () => new RunService.constructor();

function stepWithDt(rs, dtSeconds) {
  const perf = globalThis.performance || (globalThis.performance = { now: () => Date.now() });
  const originalNow = perf.now;
  const last = 1000;
  rs._last = last;
  perf.now = () => last + dtSeconds * 1000;
  try {
    rs._step();
  } finally {
    perf.now = originalNow;
  }
}

// Bind order by priority

test('bind order by priority', t => {
  const rs = createRunService();
  const order = [];
  rs.BindToRenderStep('a', 2, () => order.push('a'));
  rs.BindToRenderStep('b', 1, () => order.push('b'));
  stepWithDt(rs, 0.016);
  t.deepEqual(order, ['b', 'a']);
  rs.UnbindFromRenderStep('a');
  rs.UnbindFromRenderStep('b');
});

// dt > 0

test('dt greater than zero', t => {
  const rs = createRunService();
  let dtVal = 0;
  rs.RenderStepped.Once(dt => {
    dtVal = dt;
  });
  stepWithDt(rs, 0.033);
  t.true(dtVal > 0);
});

// unbind works

test('unbind removes step', t => {
  const rs = createRunService();
  const order = [];
  rs.BindToRenderStep('temp', 1, () => order.push('temp'));
  rs.UnbindFromRenderStep('temp');
  stepWithDt(rs, 0.02);
  t.deepEqual(order, []);
});

