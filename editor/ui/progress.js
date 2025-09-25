const entries = new Map();
let overlay = null;
let listEl = null;

function ensureOverlay() {
  if (overlay) {
    return overlay;
  }
  overlay = document.createElement('div');
  overlay.className = 'progress-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const panel = document.createElement('div');
  panel.className = 'progress-overlay__panel';

  const title = document.createElement('div');
  title.className = 'progress-overlay__title';
  title.textContent = 'Working…';

  listEl = document.createElement('div');
  listEl.className = 'progress-overlay__list';

  panel.append(title, listEl);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  return overlay;
}

function normalizePercent(percent) {
  if (!Number.isFinite(percent)) {
    return null;
  }
  const value = percent > 1 ? percent / 100 : percent;
  return Math.max(0, Math.min(1, value));
}

function createEntry(id, options = {}) {
  ensureOverlay();
  const row = document.createElement('div');
  row.className = 'progress-overlay__item';
  row.dataset.id = id;

  const header = document.createElement('div');
  header.className = 'progress-overlay__item-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'progress-overlay__item-title';
  titleEl.textContent = options.title || 'Loading…';

  const percentEl = document.createElement('span');
  percentEl.className = 'progress-overlay__item-percent';
  percentEl.textContent = '';

  header.append(titleEl, percentEl);

  const bar = document.createElement('div');
  bar.className = 'progress-overlay__bar';

  const fill = document.createElement('div');
  fill.className = 'progress-overlay__bar-fill';
  bar.appendChild(fill);

  row.append(header, bar);
  listEl.appendChild(row);

  const entry = { id, row, titleEl, percentEl, fill };
  entries.set(id, entry);
  return entry;
}

function updateEntry(entry, options = {}) {
  if (!entry) return;
  if (options.title) {
    entry.titleEl.textContent = options.title;
  }
  const normalized = normalizePercent(options.percent);
  if (normalized === null) {
    entry.fill.style.width = '100%';
    entry.fill.classList.add('is-indeterminate');
    entry.percentEl.textContent = '';
  } else {
    entry.fill.classList.remove('is-indeterminate');
    entry.fill.style.width = `${(normalized * 100).toFixed(1)}%`;
    entry.percentEl.textContent = `${Math.round(normalized * 100)}%`;
  }
}

export function showProgress(id, options = {}) {
  if (!id) return null;
  ensureOverlay();
  const existing = entries.get(id) ?? createEntry(id, options);
  updateEntry(existing, options);
  overlay.classList.add('is-visible');
  return {
    update(nextOptions = {}) {
      updateEntry(existing, nextOptions);
    },
  };
}

export function hideProgress(id) {
  if (!id) return;
  const entry = entries.get(id);
  if (!entry) return;
  entry.row.remove();
  entries.delete(id);
  if (!entries.size && overlay) {
    overlay.classList.remove('is-visible');
  }
}

export default { showProgress, hideProgress };
