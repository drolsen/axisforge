const DEFAULT_TIMEOUTS = {
  info: 3800,
  success: 3200,
  warn: 5200,
  error: 6000,
};

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);
  return container;
}

function createToastElement(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const content = document.createElement('div');
  content.className = 'toast__content';
  content.textContent = message;
  toast.appendChild(content);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast__close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');
  closeButton.textContent = '×';
  toast.appendChild(closeButton);

  return { toast, closeButton };
}

export function showToast(message, type = 'info', timeout = 0) {
  if (!message) return null;
  const kind = ['info', 'success', 'warn', 'error'].includes(type) ? type : 'info';
  const target = ensureContainer();
  const { toast, closeButton } = createToastElement(message, kind);

  let hideTimer = null;
  const remove = () => {
    if (!toast.parentElement) return;
    toast.classList.add('is-leaving');
    const handleEnd = () => {
      toast.removeEventListener('animationend', handleEnd);
      toast.removeEventListener('transitionend', handleEnd);
      toast.remove();
      if (!container?.children.length) {
        container?.classList.remove('is-visible');
      }
    };
    toast.addEventListener('animationend', handleEnd);
    toast.addEventListener('transitionend', handleEnd);
    window.setTimeout(handleEnd, 400);
  };

  closeButton.addEventListener('click', () => {
    clearTimeout(hideTimer);
    remove();
  });

  target.appendChild(toast);
  // Trigger entrance animation
  requestAnimationFrame(() => {
    container?.classList.add('is-visible');
    toast.classList.add('is-visible');
  });

  const duration = timeout > 0 ? timeout : DEFAULT_TIMEOUTS[kind];
  if (duration > 0) {
    hideTimer = window.setTimeout(remove, duration);
  }

  return {
    dismiss: () => {
      clearTimeout(hideTimer);
      remove();
    },
  };
}

export default showToast;
