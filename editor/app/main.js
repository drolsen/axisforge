import Explorer from '../panes/explorer.js';
import Properties from '../panes/properties.js';
import ConsolePane from '../panes/console.js';
import GitPane from '../panes/git.js';
import { initViewport } from '../services/viewport.js';
import { checkForUpdates } from '../services/update-checker.js';
import SettingsPane from '../panes/settings.js';
import ProfilerPane from '../panes/profiler.js';
import UndoService from '../services/undo.js';
import { Selection } from '../services/selection.js';
import TranslationGizmo from '../components/gizmos.js';

export function bootstrap() {
  const undo = new UndoService();
  const selection = new Selection();

  new Explorer(undo, selection);
  new Properties(undo, selection);
  new TranslationGizmo(selection, undo);
  initViewport();
  new ConsolePane();
  new GitPane();
  const profiler = new ProfilerPane();
  new SettingsPane({ profiler });
  checkForUpdates();
}

bootstrap();
