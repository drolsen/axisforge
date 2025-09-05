import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import store from '../EditorStore.js';

export default class ViewportPanel {
  constructor(container, instances = []) {
    this.container = container;
    this.instances = instances;
    this.objectMap = new Map();
    this.#build();
  }

  #build() {
    this.container.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = 'Viewport';
    title.className = 'panel-title';
    this.container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'panel-body';
    body.style.position = 'relative';
    body.style.padding = '0';
    body.style.height = '100%';
    this.container.appendChild(body);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(body.clientWidth, body.clientHeight);
    body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.GridHelper(10, 10));

    this.camera = new THREE.PerspectiveCamera(70, body.clientWidth / body.clientHeight, 0.1, 100);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // create cube for default instance
    const cubeInst = this.instances.find(i => i.properties.Name === 'Cube');
    if (cubeInst) {
      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshNormalMaterial();
      const mesh = new THREE.Mesh(geom, mat);
      this.scene.add(mesh);
      this.objectMap.set(cubeInst, mesh);
    }

    this.controls = new TransformControls(this.camera, this.renderer.domElement);
    this.controls.setSpace(store.state.space);
    this.controls.translationSnap = store.state.snap;
    this.controls.addEventListener('objectChange', () => {
      if (this.currentInstance) {
        const p = this.controls.object.position;
        const cf = `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;
        this.currentInstance.setProperty('CFrame', cf);
      }
    });
    this.scene.add(this.controls);

    const toolbar = document.createElement('div');
    toolbar.style.position = 'absolute';
    toolbar.style.top = '4px';
    toolbar.style.left = '4px';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    body.appendChild(toolbar);

    ['translate', 'rotate', 'scale'].forEach(mode => {
      const btn = document.createElement('button');
      btn.textContent = mode[0].toUpperCase();
      btn.addEventListener('click', () => {
        this.controls.setMode(mode);
      });
      toolbar.appendChild(btn);
    });

    const spaceBtn = document.createElement('button');
    spaceBtn.textContent = store.state.space === 'world' ? 'World' : 'Local';
    spaceBtn.addEventListener('click', () => {
      const newSpace = store.state.space === 'world' ? 'local' : 'world';
      store.setSpace(newSpace);
    });
    toolbar.appendChild(spaceBtn);

    const snapChk = document.createElement('input');
    snapChk.type = 'checkbox';
    snapChk.checked = true;
    snapChk.addEventListener('change', () => {
      store.setSnap(snapChk.checked ? 1 : 0);
    });
    toolbar.appendChild(snapChk);

    store.addEventListener('space', e => {
      this.controls.setSpace(e.detail);
      spaceBtn.textContent = e.detail === 'world' ? 'World' : 'Local';
    });
    store.addEventListener('snap', e => {
      this.controls.translationSnap = e.detail || null;
    });

    const onResize = () => {
      const w = body.clientWidth;
      const h = body.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setInstance(inst) {
    this.currentInstance = inst;
    const obj = this.objectMap.get(inst);
    if (obj) {
      this.controls.attach(obj);
    } else {
      this.controls.detach();
    }
  }
}
