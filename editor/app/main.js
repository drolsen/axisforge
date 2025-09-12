import Explorer from '../panes/explorer.js';
import Properties from '../panes/properties.js';
import ConsolePane from '../panes/console.js';
import GitPane from '../panes/git.js';
import { initViewport } from '../services/viewport.js';
import { checkForUpdates } from '../services/update-checker.js';

export function bootstrap() {
  new Explorer();
  new Properties();
  initViewport();
  new ConsolePane();
  new GitPane();
  checkForUpdates();
}

bootstrap();
