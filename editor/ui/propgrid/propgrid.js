import { createEditor } from './propeditors.js';

const noop = () => {};

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map(section => ({
    id: section.id ?? Math.random().toString(36).slice(2),
    label: section.label ?? null,
    rows: Array.isArray(section.rows) ? section.rows : [],
    expanded: section.expanded !== false,
  }));
}

export default class PropertyGrid {
  constructor(parent = null) {
    this.element = document.createElement('div');
    this.element.className = 'property-grid';
    this._sections = [];
    this._message = '';
    this._messageElement = document.createElement('div');
    this._messageElement.className = 'property-grid__empty';
    this._activeEditors = [];

    if (parent) {
      parent.appendChild(this.element);
    }
  }

  getElement() {
    return this.element;
  }

  setEmptyMessage(message) {
    this._message = message ?? '';
    this._messageElement.textContent = this._message;
  }

  setSections(sections) {
    this._sections = normalizeSections(sections);
    this._render();
  }

  dispose() {
    this._disposeEditors();
    this.element.textContent = '';
  }

  _disposeEditors() {
    for (const editor of this._activeEditors) {
      try {
        editor?.dispose?.();
      } catch (err) {
        console.warn('PropertyGrid editor dispose failed', err);
      }
    }
    this._activeEditors = [];
  }

  _render() {
    this._disposeEditors();
    this.element.textContent = '';
    const visibleSections = this._sections
      .map(section => ({ ...section, rows: section.rows.filter(row => row && row.visible !== false) }))
      .filter(section => section.rows.length > 0);

    if (!visibleSections.length) {
      if (this._message) {
        this._messageElement.textContent = this._message;
        this.element.appendChild(this._messageElement);
      }
      this.element.classList.add('is-empty');
      return;
    }

    this.element.classList.remove('is-empty');

    for (const section of visibleSections) {
      const sectionEl = document.createElement('section');
      sectionEl.className = 'property-grid__section';

      if (section.label) {
        const header = document.createElement('header');
        header.className = 'property-grid__section-header';
        header.textContent = section.label;
        sectionEl.appendChild(header);
      }

      const rowsEl = document.createElement('div');
      rowsEl.className = 'property-grid__section-body';
      for (const row of section.rows) {
        const rowEl = this._renderRow(row);
        if (rowEl) rowsEl.appendChild(rowEl);
      }
      sectionEl.appendChild(rowsEl);
      this.element.appendChild(sectionEl);
    }
  }

  _renderRow(row) {
    const rowEl = document.createElement('div');
    rowEl.className = 'property-grid__row';
    if (row.className) rowEl.classList.add(row.className);
    if (row.readOnly) rowEl.classList.add('is-readonly');
    if (row.highlight) rowEl.classList.add('is-highlight');

    const labelEl = document.createElement('div');
    labelEl.className = 'property-grid__label';
    if (typeof row.label === 'string') {
      labelEl.textContent = row.label;
    } else if (row.label instanceof Node) {
      labelEl.appendChild(row.label);
    } else if (typeof row.renderLabel === 'function') {
      const content = row.renderLabel(row) ?? null;
      if (content instanceof Node) {
        labelEl.appendChild(content);
      } else if (content != null) {
        labelEl.textContent = String(content);
      }
    }
    if (row.description) {
      const desc = document.createElement('span');
      desc.className = 'property-grid__label-description';
      desc.textContent = row.description;
      labelEl.appendChild(desc);
    }
    if (row.tooltip) labelEl.title = row.tooltip;

    const valueEl = document.createElement('div');
    valueEl.className = 'property-grid__value';

    const editorConfig = {
      value: row.value,
      readOnly: row.readOnly,
      placeholder: row.placeholder,
      mixed: row.mixed,
      options: row.options,
      onCommit: row.onCommit ?? noop,
      onInput: row.onInput ?? null,
    };

    let editor = null;
    try {
      editor = createEditor(row.type ?? 'text', editorConfig);
    } catch (err) {
      console.warn('Failed to create editor for row', row, err);
      valueEl.textContent = row.value != null ? String(row.value) : '';
    }
    if (editor) {
      valueEl.appendChild(editor.element);
      if (row.mixed != null && editor.setMixed) {
        editor.setMixed(row.mixed);
      }
      this._activeEditors.push(editor);
    }

    if (Array.isArray(row.actions) && row.actions.length) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'property-grid__actions';
      for (const action of row.actions) {
        if (!action || action.hidden) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'property-grid__action';
        if (action.className) {
          for (const cls of String(action.className).split(/\s+/)) {
            if (cls) button.classList.add(cls);
          }
        }
        if (action.icon) {
          button.dataset.icon = action.icon;
        }
        if (action.label) {
          button.title = action.label;
        }
        button.textContent = action.text ?? '';
        button.disabled = Boolean(action.disabled);
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (typeof action.onClick === 'function') {
            action.onClick(row, event);
          }
        });
        actionsEl.appendChild(button);
      }
      valueEl.appendChild(actionsEl);
    }

    rowEl.append(labelEl, valueEl);
    if (row.help) {
      const helpEl = document.createElement('div');
      helpEl.className = 'property-grid__help';
      helpEl.textContent = row.help;
      rowEl.appendChild(helpEl);
    }

    return rowEl;
  }
}
