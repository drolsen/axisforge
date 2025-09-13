import test from 'ava';
import { GetService } from '../../engine/core/index.js';

const UIS = () => GetService('UserInputService');

// Keyboard tracking

test('tracks key down and up', t => {
  const uis = UIS();
  uis._keysDown.clear();
  let began = false;
  let ended = false;
  uis.InputBegan.Once(input => {
    if (input.KeyCode === 'W') began = true;
  });
  uis.InputEnded.Once(input => {
    if (input.KeyCode === 'W') ended = true;
  });
  uis._onKeyDown({ code: 'KeyW' });
  t.true(uis.IsKeyDown('W'));
  t.true(began);
  uis._onKeyUp({ code: 'KeyW' });
  t.false(uis.IsKeyDown('W'));
  t.true(ended);
});

// Mouse movement

test('mouse location and delta', t => {
  const uis = UIS();
  uis._canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  uis.MouseDeltaSensitivity = 2;
  let observed;
  uis.InputChanged.Once(input => {
    observed = input;
  });
  uis._onMouseMove({ clientX: 10, clientY: 20, movementX: 3, movementY: -4 });
  t.deepEqual(uis.GetMouseLocation(), { x: 10, y: 20 });
  t.deepEqual(observed.Position, { x: 10, y: 20 });
  t.deepEqual(observed.Delta, { x: 6, y: -8 });
});
