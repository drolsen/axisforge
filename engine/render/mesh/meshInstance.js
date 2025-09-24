import { Instance } from '../../core/index.js';
import drawList from './drawList.js';
import {
  computeNormalMatrix,
  mat4FromRotationTranslationScale,
  mat4Identity,
  mat4Multiply,
  quaternionFromEuler,
  quaternionNormalize,
  quaternionToEuler,
} from './math.js';

function cloneVector3(value = {}) {
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    z: Number.isFinite(value.z) ? value.z : 0,
  };
}

function cloneScale(value = {}) {
  const result = cloneVector3(value);
  if (result.x === 0) result.x = 1;
  if (result.y === 0) result.y = 1;
  if (result.z === 0) result.z = 1;
  return result;
}

function toArray(vec) {
  return [vec.x, vec.y, vec.z];
}

class TransformNode extends Instance {
  constructor(className = 'TransformNode') {
    super(className);
    this._position = cloneVector3({});
    this._scale = cloneScale({ x: 1, y: 1, z: 1 });
    this._rotationQuat = quaternionFromEuler();

    super.setProperty('Position', cloneVector3(this._position));
    super.setProperty('Scale', cloneVector3(this._scale));
    super.setProperty('Rotation', cloneVector3(quaternionToEuler(this._rotationQuat)));

    this._localMatrix = mat4Identity();
    this._worldMatrix = mat4Identity();
    this._normalMatrix = mat4Identity();
    this._localDirty = true;
    this._worldDirty = true;

    this.AncestryChanged.Connect(() => {
      this.markWorldDirty();
    });
  }

  setProperty(name, value) {
    if (name === 'Position') {
      this._position = cloneVector3(value);
      super.setProperty(name, cloneVector3(this._position));
      this._localDirty = true;
      this.markWorldDirty();
      return;
    }

    if (name === 'Scale') {
      this._scale = cloneScale(value);
      super.setProperty(name, cloneVector3(this._scale));
      this._localDirty = true;
      this.markWorldDirty();
      return;
    }

    if (name === 'Rotation') {
      const vec = cloneVector3(value);
      this._rotationQuat = quaternionFromEuler(vec);
      super.setProperty(name, vec);
      this._localDirty = true;
      this.markWorldDirty();
      return;
    }

    super.setProperty(name, value);
  }

  setRotationQuaternion(quat, updateProperty = true) {
    this._rotationQuat = quaternionNormalize(quat);
    if (updateProperty) {
      super.setProperty('Rotation', cloneVector3(quaternionToEuler(this._rotationQuat)));
    }
    this._localDirty = true;
    this.markWorldDirty();
  }

  getRotationQuaternion() {
    return this._rotationQuat;
  }

  markWorldDirty() {
    if (this._worldDirty && !this._localDirty) {
      // Already marked; avoid redundant propagation.
    }
    this._worldDirty = true;
    for (const child of this.Children) {
      if (typeof child.markWorldDirty === 'function') {
        child.markWorldDirty();
      }
    }
  }

  _updateLocalMatrix() {
    if (!this._localDirty) {
      return;
    }
    this._localMatrix = mat4FromRotationTranslationScale(
      this._rotationQuat,
      toArray(this._position),
      toArray(this._scale),
    );
    this._localDirty = false;
    this._worldDirty = true;
  }

  getLocalMatrix() {
    this._updateLocalMatrix();
    return this._localMatrix;
  }

  getWorldMatrix() {
    this._updateLocalMatrix();
    if (this._worldDirty) {
      const parent = this.Parent;
      if (parent && typeof parent.getWorldMatrix === 'function') {
        this._worldMatrix = mat4Multiply(parent.getWorldMatrix(), this._localMatrix);
      } else {
        this._worldMatrix = new Float32Array(this._localMatrix);
      }
      this._normalMatrix = computeNormalMatrix(this._worldMatrix);
      this._worldDirty = false;
    }
    return this._worldMatrix;
  }

  getNormalMatrix() {
    this.getWorldMatrix();
    return this._normalMatrix;
  }

  isRenderable() {
    return this.Parent !== null;
  }
}

class MeshInstance extends TransformNode {
  constructor(mesh = null, { materials = null, className = 'MeshInstance' } = {}) {
    super(className);
    this.mesh = mesh;
    this.materials = [];
    this._uniformBuffer = null;
    this._uniformArray = null;
    this._bindGroup = null;
    this._bindGroupLayout = null;
    this._uniformDirty = true;

    this.setMesh(mesh, materials);
    drawList.register(this);
  }

  setMesh(mesh, materials = null) {
    this.mesh = mesh;
    this.materials = [];
    if (mesh && Array.isArray(mesh.primitives)) {
      this.materials = mesh.primitives.map((primitive, index) => {
        if (Array.isArray(materials) && materials[index] != null) {
          return materials[index];
        }
        return primitive.materialId ?? null;
      });
    }
    this._uniformDirty = true;
  }

  setMaterial(index, materialId) {
    if (!this.mesh) {
      return;
    }
    while (this.materials.length < this.mesh.primitives.length) {
      this.materials.push(null);
    }
    this.materials[index] = materialId;
  }

  getMaterialForPrimitive(index) {
    if (!this.mesh || !this.mesh.primitives[index]) {
      return null;
    }
    if (Array.isArray(this.materials) && this.materials[index] != null) {
      return this.materials[index];
    }
    return this.mesh.primitives[index].materialId ?? null;
  }

  markWorldDirty() {
    this._uniformDirty = true;
    drawList.markDirty();
    super.markWorldDirty();
  }

  isRenderable() {
    return this.mesh !== null && super.isRenderable();
  }

  _ensureUniformBuffer(device) {
    if (this._uniformBuffer) {
      return;
    }
    const floatCount = 32; // 16 for model matrix, 16 for normal matrix
    const byteLength = floatCount * 4;
    this._uniformArray = new Float32Array(floatCount);
    this._uniformBuffer = device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._uniformDirty = true;
  }

  _updateUniforms(device) {
    if (!this._uniformDirty) {
      return;
    }
    this._ensureUniformBuffer(device);
    const world = this.getWorldMatrix();
    const normal = this.getNormalMatrix();
    this._uniformArray.set(world, 0);
    this._uniformArray.set(normal, 16);
    device.queue.writeBuffer(
      this._uniformBuffer,
      0,
      this._uniformArray.buffer,
      this._uniformArray.byteOffset,
      this._uniformArray.byteLength,
    );
    this._uniformDirty = false;
  }

  getBindGroup(device, layout) {
    if (!layout) {
      return null;
    }
    this._ensureUniformBuffer(device);
    if (!this._bindGroup || this._bindGroupLayout !== layout) {
      this._bindGroupLayout = layout;
      this._bindGroup = device.createBindGroup({
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this._uniformBuffer },
          },
        ],
      });
    }
    this._updateUniforms(device);
    return this._bindGroup;
  }
}

export { TransformNode, MeshInstance };
export default MeshInstance;
