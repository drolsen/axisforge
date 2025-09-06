import ChunkStore from '../../../voxels/src/ChunkStore.js';

export default class VoxelPanel {
  constructor() {
    this.store = new ChunkStore();
    this.el = document.createElement('div');

    const radius = document.createElement('input');
    radius.type = 'number';
    radius.value = 4;
    const strength = document.createElement('input');
    strength.type = 'number';
    strength.value = 1;
    const falloff = document.createElement('input');
    falloff.type = 'number';
    falloff.value = 1;

    const makeParams = () => ({
      radius: parseFloat(radius.value),
      strength: parseFloat(strength.value),
      falloff: parseFloat(falloff.value),
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.onclick = () => {
      this.store.applyEdit({ op: 'add', shape: 'sphere', params: makeParams() });
    };

    const subBtn = document.createElement('button');
    subBtn.textContent = 'Subtract';
    subBtn.onclick = () => {
      this.store.applyEdit({ op: 'subtract', shape: 'sphere', params: makeParams() });
    };

    const smoothBtn = document.createElement('button');
    smoothBtn.textContent = 'Smooth';
    smoothBtn.onclick = () => {
      this.store.applyEdit({ op: 'smooth', shape: 'sphere', params: makeParams() });
    };

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
      const json = this.store.saveDeltas();
      localStorage.setItem('voxelDeltas', json);
    };

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      const json = localStorage.getItem('voxelDeltas');
      if (json) this.store.loadDeltas(json);
    };

    this.el.append(radius, strength, falloff, addBtn, subBtn, smoothBtn, saveBtn, loadBtn);
  }
}

