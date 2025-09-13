import test from 'ava';
import { GetService } from '../../engine/core/index.js';

const RS = () => GetService('RunService');

// Bind order by priority

test('bind order by priority', t => {
  const rs = RS();
  const order = [];
  rs.BindToRenderStep('a', 2, () => order.push('a'));
  rs.BindToRenderStep('b', 1, () => order.push('b'));
  rs._step(0.016);
  t.deepEqual(order, ['b', 'a']);
  rs.UnbindFromRenderStep('a');
  rs.UnbindFromRenderStep('b');
});

// dt > 0

test('dt greater than zero', t => {
  const rs = RS();
  let dtVal = 0;
  rs.RenderStepped.Once(dt => {
    dtVal = dt;
  });
  rs._step(0.033);
  t.true(dtVal > 0);
});

// unbind works

test('unbind removes step', t => {
  const rs = RS();
  const order = [];
  rs.BindToRenderStep('temp', 1, () => order.push('temp'));
  rs.UnbindFromRenderStep('temp');
  rs._step(0.02);
  t.deepEqual(order, []);
});

