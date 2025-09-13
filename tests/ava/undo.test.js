import test from 'ava';
import { Instance } from '../../engine/core/index.js';
import UndoService from '../../editor/services/undo.js';

// Basic undo/redo command stack functionality
test('create/delete instance undo', t => {
  const undo = new UndoService();
  const parent = new Instance('Model');
  const child = new Instance('Part');

  undo.execute(undo.createInstance(child, parent));
  t.is(child.Parent, parent);

  undo.undo();
  t.is(child.Parent, null);

  undo.redo();
  t.is(child.Parent, parent);
});

test('property change undo', t => {
  const undo = new UndoService();
  const inst = new Instance('Part');
  inst.setProperty('Value', 1);

  undo.execute(undo.setProperty(inst, 'Value', 2));
  t.is(inst.Value, 2);

  undo.undo();
  t.is(inst.Value, 1);

  undo.redo();
  t.is(inst.Value, 2);
});
