import '../editor/app/main.js';
import AssetsPane from '../editor/panes/assets.js';

// Initialize the Assets pane in the editor UI.
new AssetsPane();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}
