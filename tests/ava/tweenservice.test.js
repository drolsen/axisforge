import test from 'ava';
import { Instance, GetService } from '../../engine/core/index.js';

const TS = () => GetService('TweenService');

// Linear tween from 0 to 10

test('linear tween 0->10', async t => {
  const inst = new Instance('Thing');
  inst.setProperty('Value', 0);
  const tween = TS().Create(inst, { Time: 0.1, EasingStyle: 'Linear', EasingDirection: 'In' }, { Value: 10 });
  tween.Play();
  await tween.Completed.Wait();
  t.is(inst.Value, 10);
});

// Delay + repeat + reverse

test('delay repeat reverse', async t => {
  const inst = new Instance('Thing');
  inst.setProperty('Value', 0);
  let firstChange = null;
  let max = 0;
  inst.Changed.Connect(prop => {
    if (prop === 'Value') {
      if (firstChange === null) firstChange = Date.now();
      if (inst.Value > max) max = inst.Value;
    }
  });
  const start = Date.now();
  const tween = TS().Create(
    inst,
    { Time: 0.05, EasingStyle: 'Linear', EasingDirection: 'In', DelayTime: 0.05, RepeatCount: 1, Reverses: true },
    { Value: 10 }
  );
  tween.Play();
  await tween.Completed.Wait();
  t.true(firstChange - start >= 50);
  t.is(inst.Value, 0);
  t.is(Math.round(max), 10);
});

// Completed fires once

test('completed fires once', async t => {
  const inst = new Instance('Thing');
  inst.setProperty('Value', 0);
  const tween = TS().Create(inst, { Time: 0.05, EasingStyle: 'Linear', EasingDirection: 'In', RepeatCount: 2 }, { Value: 5 });
  let count = 0;
  tween.Completed.Connect(() => { count++; });
  tween.Play();
  await tween.Completed.Wait();
  t.is(count, 1);
});

