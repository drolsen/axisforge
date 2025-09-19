import test from 'ava';
import { Instance } from '../../engine/core/index.js';
import UndoService from '../../editor/services/undo.js';
import { Selection } from '../../editor/services/selection.js';
import Explorer from '../../editor/panes/explorer.js';
import Properties from '../../editor/panes/properties.js';
import TranslationGizmo from '../../editor/components/gizmos.js';

function createMeshInstance(name = 'Mesh') {
  const inst = new Instance('MeshPart');
  inst.setProperty('Name', name);
  inst.setProperty('Position', { x: 0, y: 0, z: 0 });
  inst.setProperty('Rotation', { x: 0, y: 0, z: 0 });
  inst.setProperty('Scale', { x: 1, y: 1, z: 1 });
  return inst;
}

test('selecting a node populates properties', t => {
  const undo = new UndoService();
  const selection = new Selection();
  const explorer = new Explorer(undo, selection);
  const properties = new Properties(undo, selection);

  const mesh = createMeshInstance('Crate');
  explorer.register(mesh);
  explorer.click(mesh);

  t.true(explorer.isSelected(mesh));

  const current = properties.getCurrent();
  t.is(current.Name.value, 'Crate');
  t.deepEqual(current.Position.value, { x: 0, y: 0, z: 0 });

  properties.editVectorComponent('Position', 'x', 5);
  t.is(mesh.Position.x, 5);
  t.is(properties.getCurrent().Position.value.x, 5);
});

test('gizmo drag updates position and pushes undo', t => {
  const undo = new UndoService();
  const selection = new Selection();
  const explorer = new Explorer(undo, selection);
  const properties = new Properties(undo, selection);
  const gizmo = new TranslationGizmo(selection, undo);

  const mesh = createMeshInstance();
  explorer.register(mesh);
  explorer.click(mesh);

  let changedCount = 0;
  mesh.Changed.Connect(prop => {
    if (prop === 'Position') changedCount += 1;
  });

  gizmo.beginDrag('x');
  gizmo.drag(3);
  gizmo.endDrag();

  t.is(mesh.Position.x, 3);
  t.true(changedCount > 0);
  t.is(properties.getCurrent().Position.value.x, 3);

  undo.undo();
  t.is(mesh.Position.x, 0);

  undo.redo();
  t.is(mesh.Position.x, 3);

  gizmo.dispose();
});
