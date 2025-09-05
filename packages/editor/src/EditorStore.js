class EditorStore extends EventTarget {
  constructor() {
    super();
    this.state = {
      selection: null,
      space: 'world',
      snap: 1
    };
  }

  setSelection(inst) {
    this.state.selection = inst;
    this.dispatchEvent(new CustomEvent('selection', { detail: inst }));
  }

  setSpace(space) {
    this.state.space = space;
    this.dispatchEvent(new CustomEvent('space', { detail: space }));
  }

  setSnap(snap) {
    this.state.snap = snap;
    this.dispatchEvent(new CustomEvent('snap', { detail: snap }));
  }
}

export default new EditorStore();
