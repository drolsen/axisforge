import { initWebGPU } from '../../engine/render/gpu/webgpu.js';
import { GetService } from '../../engine/core/index.js';
import { startPlay, stopPlay } from './playmode.js';

function styleButton(button) {
  button.style.border = 'none';
  button.style.borderRadius = '999px';
  button.style.padding = '6px 18px';
  button.style.fontSize = '13px';
  button.style.fontFamily = 'Inter, system-ui, sans-serif';
  button.style.fontWeight = '600';
  button.style.color = '#fff';
  button.style.pointerEvents = 'auto';
  button.style.transition = 'opacity 120ms ease, transform 120ms ease';
  button.style.cursor = 'pointer';
  button.addEventListener('mousedown', () => {
    button.style.transform = 'scale(0.97)';
  });
  button.addEventListener('mouseup', () => {
    button.style.transform = 'scale(1)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });
}

function createToolbar() {
  const container = document.createElement('div');
  container.id = 'viewport-toolbar';
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.display = 'flex';
  container.style.gap = '10px';
  container.style.alignItems = 'center';
  container.style.padding = '8px 14px';
  container.style.borderRadius = '999px';
  container.style.background = 'rgba(20, 20, 20, 0.75)';
  container.style.backdropFilter = 'blur(10px)';
  container.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.35)';
  container.style.zIndex = '1000';
  container.style.pointerEvents = 'none';

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.style.background = '#2ecc71';
  styleButton(playButton);

  const stopButton = document.createElement('button');
  stopButton.textContent = 'Stop';
  stopButton.style.background = '#e74c3c';
  styleButton(stopButton);

  const syncButtonState = button => {
    button.style.opacity = button.disabled ? '0.5' : '1';
    button.style.cursor = button.disabled ? 'default' : 'pointer';
  };

  let playing = false;

  const updateButtons = () => {
    playButton.disabled = playing;
    stopButton.disabled = !playing;
    syncButtonState(playButton);
    syncButtonState(stopButton);
    container.dataset.state = playing ? 'playing' : 'stopped';
  };

  playButton.addEventListener('click', async () => {
    if (playing) return;
    playButton.disabled = true;
    syncButtonState(playButton);
    try {
      await startPlay('/game/main.client.js');
      playing = true;
    } catch (err) {
      console.error('[PLAY] Failed to start play mode', err);
      playing = false;
    } finally {
      updateButtons();
    }
  });

  stopButton.addEventListener('click', async () => {
    if (!playing) return;
    stopButton.disabled = true;
    syncButtonState(stopButton);
    try {
      await stopPlay();
    } finally {
      playing = false;
      updateButtons();
    }
  });

  updateButtons();

  container.appendChild(playButton);
  container.appendChild(stopButton);
  return container;
}

export function initViewport() {
  const canvas = document.createElement('canvas');
  canvas.id = 'viewport';
  document.body.appendChild(canvas);
  const toolbar = createToolbar();
  document.body.appendChild(toolbar);
  initWebGPU(canvas);
  const UIS = GetService('UserInputService');
  UIS.AttachCanvas(canvas);
}
