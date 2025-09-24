import { recordDrawCall } from '../framegraph/stats.js';
import { GetService } from '../../core/index.js';
import { getActiveCamera } from '../camera/manager.js';
import { lookAt, perspective, mat4Multiply, mat4Invert } from '../mesh/math.js';

const UNIFORM_FLOATS = 32;
const UNIFORM_SIZE = UNIFORM_FLOATS * 4;

export default class SkyPass {
  constructor(device, format, getView) {
    this.device = device;
    this.format = format;
    this.getView = getView;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.uniformArray = new Float32Array(UNIFORM_FLOATS);
    this.bindGroup = null;
    this.lighting = GetService('Lighting');
  }

  async init() {
    const shaderUrl = new URL('./skyProcedural.wgsl', import.meta.url);
    const shaderCode = await fetch(shaderUrl).then(resp => resp.text());
    const module = this.device.createShaderModule({ code: shaderCode });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs'
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list' }
    });

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  execute(encoder) {
    const view = this.getView ? this.getView() : null;
    if (!view || !this.pipeline || !this.uniformBuffer || !this.bindGroup) {
      return;
    }

    this._updateUniforms();
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformArray.buffer, 0, UNIFORM_SIZE);

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6, 1, 0, 0);
    recordDrawCall(this.constructor.name);
    pass.end();
  }

  _updateUniforms() {
    const activeCamera = getActiveCamera();
    let viewMatrix;
    let projectionMatrix;
    let viewProjection;
    let cameraPosition;

    if (activeCamera) {
      viewMatrix = activeCamera.getViewMatrix();
      projectionMatrix = activeCamera.getProjectionMatrix();
      viewProjection = activeCamera.getViewProjectionMatrix();
      cameraPosition = activeCamera.getPosition();
    } else {
      const fallback = {
        position: [0, 5, 15],
        direction: [0, -0.3, -1],
        up: [0, 1, 0],
        near: 0.1,
        far: 100,
        fov: Math.PI / 3,
        aspect: 16 / 9,
      };
      const target = [
        fallback.position[0] + fallback.direction[0],
        fallback.position[1] + fallback.direction[1],
        fallback.position[2] + fallback.direction[2],
      ];
      viewMatrix = lookAt(fallback.position, target, fallback.up);
      projectionMatrix = perspective(fallback.fov, fallback.aspect, fallback.near, fallback.far);
      viewProjection = mat4Multiply(projectionMatrix, viewMatrix);
      cameraPosition = [...fallback.position];
    }

    const invViewProj = mat4Invert(viewProjection);
    this.uniformArray.set(invViewProj, 0);
    this.uniformArray[16] = cameraPosition[0];
    this.uniformArray[17] = cameraPosition[1];
    this.uniformArray[18] = cameraPosition[2];
    this.uniformArray[19] = 1.0;

    let sunDirection = [0, 1, 0];
    let sunColor = [1, 1, 1];
    let sunIntensity = 0;
    if (this.lighting?.getSun) {
      const sun = this.lighting.getSun();
      if (Array.isArray(sun?.direction) && sun.direction.length >= 3) {
        sunDirection = sun.direction;
      }
      if (Array.isArray(sun?.color) && sun.color.length >= 3) {
        sunColor = sun.color;
      }
      if (typeof sun?.intensity === 'number') {
        sunIntensity = sun.intensity;
      }
    }

    const skyState = this.lighting?.getSkyState ? this.lighting.getSkyState() : null;
    const turbidity = typeof skyState?.turbidity === 'number'
      ? skyState.turbidity
      : (this.lighting?.getTurbidity?.() ?? 2.5);
    const groundAlbedo = Array.isArray(skyState?.groundAlbedo) && skyState.groundAlbedo.length >= 3
      ? skyState.groundAlbedo
      : (this.lighting?.getGroundAlbedo?.() ?? [0.2, 0.2, 0.2]);

    this.uniformArray[20] = sunDirection[0];
    this.uniformArray[21] = sunDirection[1];
    this.uniformArray[22] = sunDirection[2];
    this.uniformArray[23] = sunIntensity;

    this.uniformArray[24] = sunColor[0];
    this.uniformArray[25] = sunColor[1];
    this.uniformArray[26] = sunColor[2];
    this.uniformArray[27] = 1.0;

    this.uniformArray[28] = groundAlbedo[0];
    this.uniformArray[29] = groundAlbedo[1];
    this.uniformArray[30] = groundAlbedo[2];
    this.uniformArray[31] = turbidity;
  }
}
