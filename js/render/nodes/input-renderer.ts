// Copyright 2018 The Immersive Web Community Group
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { ControllerNode, LaserMesh, Vector4Array } from "../../../interfaces";
import { Material, MaterialSampler, MaterialUniform, RENDER_ORDER } from "../core/material";
import { Node } from "../core/node";
import { Primitive, PrimitiveAttribute } from "../core/primitive";
import { Renderer } from "../core/renderer";
import { DataTexture } from "../core/texture";
import { Gltf2Node } from "../nodes/gltf2";

// This library matches XRInputSource profiles to available controller models for us.
import { fetchProfile } from "@webxr-input-profiles/motion-controllers/dist/motion-controllers.module";

// The path of the CDN the sample will fetch controller models from.
const DEFAULT_PROFILES_PATH = "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles";

const GL = WebGLRenderingContext; // For enums

// Laser texture data, 48x1 RGBA (not premultiplied alpha). This represents a
// "cross section" of the laser beam with a bright core and a feathered edge.
// Borrowed from Chromium source code.
const LASER_TEXTURE_DATA = new Uint8Array([
  0xff, 0xff, 0xff, 0x01, 0xff, 0xff, 0xff, 0x02, 0xbf, 0xbf, 0xbf, 0x04, 0xcc, 0xcc, 0xcc, 0x05, 0xdb, 0xdb, 0xdb,
  0x07, 0xcc, 0xcc, 0xcc, 0x0a, 0xd8, 0xd8, 0xd8, 0x0d, 0xd2, 0xd2, 0xd2, 0x11, 0xce, 0xce, 0xce, 0x15, 0xce, 0xce,
  0xce, 0x1a, 0xce, 0xce, 0xce, 0x1f, 0xcd, 0xcd, 0xcd, 0x24, 0xc8, 0xc8, 0xc8, 0x2a, 0xc9, 0xc9, 0xc9, 0x2f, 0xc9,
  0xc9, 0xc9, 0x34, 0xc9, 0xc9, 0xc9, 0x39, 0xc9, 0xc9, 0xc9, 0x3d, 0xc8, 0xc8, 0xc8, 0x41, 0xcb, 0xcb, 0xcb, 0x44,
  0xee, 0xee, 0xee, 0x87, 0xfa, 0xfa, 0xfa, 0xc8, 0xf9, 0xf9, 0xf9, 0xc9, 0xf9, 0xf9, 0xf9, 0xc9, 0xfa, 0xfa, 0xfa,
  0xc9, 0xfa, 0xfa, 0xfa, 0xc9, 0xf9, 0xf9, 0xf9, 0xc9, 0xf9, 0xf9, 0xf9, 0xc9, 0xfa, 0xfa, 0xfa, 0xc8, 0xee, 0xee,
  0xee, 0x87, 0xcb, 0xcb, 0xcb, 0x44, 0xc8, 0xc8, 0xc8, 0x41, 0xc9, 0xc9, 0xc9, 0x3d, 0xc9, 0xc9, 0xc9, 0x39, 0xc9,
  0xc9, 0xc9, 0x34, 0xc9, 0xc9, 0xc9, 0x2f, 0xc8, 0xc8, 0xc8, 0x2a, 0xcd, 0xcd, 0xcd, 0x24, 0xce, 0xce, 0xce, 0x1f,
  0xce, 0xce, 0xce, 0x1a, 0xce, 0xce, 0xce, 0x15, 0xd2, 0xd2, 0xd2, 0x11, 0xd8, 0xd8, 0xd8, 0x0d, 0xcc, 0xcc, 0xcc,
  0x0a, 0xdb, 0xdb, 0xdb, 0x07, 0xcc, 0xcc, 0xcc, 0x05, 0xbf, 0xbf, 0xbf, 0x04, 0xff, 0xff, 0xff, 0x02, 0xff, 0xff,
  0xff, 0x01
]);

const LASER_LENGTH = 1.0;
const LASER_DIAMETER = 0.01;
const LASER_FADE_END = 0.535;
const LASER_FADE_POINT = 0.5335;
const LASER_DEFAULT_COLOR: Vector4Array = [1.0, 1.0, 1.0, 0.25];

const CURSOR_RADIUS = 0.004;
const CURSOR_SHADOW_RADIUS = 0.007;
const CURSOR_SHADOW_INNER_LUMINANCE = 0.5;
const CURSOR_SHADOW_OUTER_LUMINANCE = 0.0;
const CURSOR_SHADOW_INNER_OPACITY = 0.75;
const CURSOR_SHADOW_OUTER_OPACITY = 0.0;
const CURSOR_OPACITY = 0.9;
const CURSOR_SEGMENTS = 16;
const CURSOR_DEFAULT_COLOR: Vector4Array = [1.0, 1.0, 1.0, 1.0];
const CURSOR_DEFAULT_HIDDEN_COLOR: Vector4Array = [0.5, 0.5, 0.5, 0.25];

const DEFAULT_RESET_OPTIONS = {
  controllers: true,
  lasers: true,
  cursors: true
};

class LaserMaterial extends Material {
  renderOrder: number;
  laser: MaterialSampler;
  laserColor: MaterialUniform;

  constructor() {
    super();
    this.renderOrder = RENDER_ORDER.ADDITIVE;
    this.state.cullFace = false;
    this.state.blend = true;
    this.state.blendFuncSrc = GL.ONE;
    this.state.blendFuncDst = GL.ONE;
    this.state.depthMask = false;

    this.laser = this.defineSampler("diffuse");
    this.laser.texture = new DataTexture(LASER_TEXTURE_DATA, 48, 1);
    this.laserColor = this.defineUniform("laserColor", LASER_DEFAULT_COLOR);
  }

  get materialName() {
    return "INPUT_LASER";
  }

  get vertexSource() {
    return `
    attribute vec3 POSITION;
    attribute vec2 TEXCOORD_0;

    varying vec2 vTexCoord;

    vec4 vertex_main(mat4 proj, mat4 view, mat4 model) {
      vTexCoord = TEXCOORD_0;
      return proj * view * model * vec4(POSITION, 1.0);
    }`;
  }

  get fragmentSource() {
    return `
    precision mediump float;

    uniform vec4 laserColor;
    uniform sampler2D diffuse;
    varying vec2 vTexCoord;

    const float fadePoint = ${LASER_FADE_POINT};
    const float fadeEnd = ${LASER_FADE_END};

    vec4 fragment_main() {
      vec2 uv = vTexCoord;
      float front_fade_factor = 1.0 - clamp(1.0 - (uv.y - fadePoint) / (1.0 - fadePoint), 0.0, 1.0);
      float back_fade_factor = clamp((uv.y - fadePoint) / (fadeEnd - fadePoint), 0.0, 1.0);
      vec4 color = laserColor * texture2D(diffuse, vTexCoord);
      float opacity = color.a * front_fade_factor * back_fade_factor;
      return vec4(color.rgb * opacity, opacity);
    }`;
  }
}

const CURSOR_VERTEX_SHADER = `
attribute vec4 POSITION;

varying float vLuminance;
varying float vOpacity;

vec4 vertex_main(mat4 proj, mat4 view, mat4 model) {
  vLuminance = POSITION.z;
  vOpacity = POSITION.w;

  // Billboarded, constant size vertex transform.
  vec4 screenPos = proj * view * model * vec4(0.0, 0.0, 0.0, 1.0);
  screenPos /= screenPos.w;
  screenPos.xy += POSITION.xy;
  return screenPos;
}`;

const CURSOR_FRAGMENT_SHADER = `
precision mediump float;

uniform vec4 cursorColor;
varying float vLuminance;
varying float vOpacity;

vec4 fragment_main() {
  vec3 color = cursorColor.rgb * vLuminance;
  float opacity = cursorColor.a * vOpacity;
  return vec4(color * opacity, opacity);
}`;

// Cursors are drawn as billboards that always face the camera and are rendered
// as a fixed size no matter how far away they are.
class CursorMaterial extends Material {
  cursorColor: MaterialUniform;

  constructor() {
    super();
    this.renderOrder = RENDER_ORDER.ADDITIVE;
    this.state.cullFace = false;
    this.state.blend = true;
    this.state.blendFuncSrc = GL.ONE;
    this.state.depthMask = false;

    this.cursorColor = this.defineUniform("cursorColor", CURSOR_DEFAULT_COLOR);
  }

  get materialName() {
    return "INPUT_CURSOR";
  }

  get vertexSource() {
    return CURSOR_VERTEX_SHADER;
  }

  get fragmentSource() {
    return CURSOR_FRAGMENT_SHADER;
  }
}

// TODO Extend CursorMaterial
class CursorHiddenMaterial extends Material {
  cursorColor: MaterialUniform;

  constructor() {
    super();
    this.renderOrder = RENDER_ORDER.ADDITIVE;
    this.state.cullFace = false;
    this.state.blend = true;
    this.state.blendFuncSrc = GL.ONE;
    this.state.depthFunc = GL.GEQUAL;
    this.state.depthMask = false;

    this.cursorColor = this.defineUniform("cursorColor", CURSOR_DEFAULT_HIDDEN_COLOR);
  }

  // TODO: Rename to "program_name"
  get materialName() {
    return "INPUT_CURSOR_2";
  }

  get vertexSource() {
    return CURSOR_VERTEX_SHADER;
  }

  get fragmentSource() {
    return CURSOR_FRAGMENT_SHADER;
  }
}

export class InputRenderer extends Node {
  _maxInputElements: number;
  _controllers: ControllerNode | null;
  _lasers: LaserMesh[] | null;
  _cursors: unknown;
  _activeControllers: unknown;
  _activeLasers: number;
  _activeCursors: unknown;
  _blurred: unknown;
  _renderer: unknown;

  constructor() {
    super();

    this._maxInputElements = 32;

    this._controllers = null;
    this._lasers = null;
    this._cursors = null;

    this._activeControllers = 0;
    this._activeLasers = 0;
    this._activeCursors = 0;

    this._blurred = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRendererChanged(_renderer: Renderer) {
    this._controllers = null;
    this._lasers = null;
    this._cursors = null;

    this._activeControllers = 0;
    this._activeLasers = 0;
    this._activeCursors = 0;
  }

  useProfileControllerMeshes(session: XRSession) {
    // As input sources are connected if they are tracked-pointer devices
    // look up which meshes should be associated with their profile and
    // load as the controller model for that hand.
    session.addEventListener("inputsourceschange", event => {
      for (const inputSource of event.added) {
        if (inputSource.targetRayMode == "tracked-pointer") {
          fetchProfile(inputSource, DEFAULT_PROFILES_PATH).then(({ assetPath }) => {
            this.setControllerMesh(new Gltf2Node({ url: assetPath }), inputSource.handedness, inputSource.profiles[0]);
          });
        }
      }
    });

    session.addEventListener("visibilitychange", event => {
      // remove hand controller while blurred
      if (event.session.visibilityState === "visible-blurred") {
        this._blurred = true;
      } else if (event.session.visibilityState === "visible") {
        this._blurred = false;
      }
    });
  }

  setControllerMesh(controllerNode: ControllerNode, handedness = "right", profile = "") {
    if (!this._controllers) {
      this._controllers = {};
    }
    this._controllers[profile + "_" + handedness] = { nodes: [controllerNode], activeCount: 0 };
    controllerNode.visible = false;
    // FIXME: Temporary fix to initialize for cloning.
    this.addNode(controllerNode);
  }

  addController(gripMatrix, handedness = "right", profile = "") {
    if (!this._controllers || this._blurred) {
      return;
    }
    const controller = this._controllers[profile + "_" + handedness];

    if (!controller) {
      return;
    }

    let controllerNode;
    if (controller.activeCount < controller.nodes.length) {
      controllerNode = controller.nodes[controller.activeCount];
    } else {
      controllerNode = controller.nodes[0].clone();
      this.addNode(controllerNode);
      controller.nodes.push(controllerNode);
    }
    controller.activeCount = (controller.activeCount + 1) % this._maxInputElements;

    controllerNode.matrix = gripMatrix;
    controllerNode.visible = true;
  }

  hideController(handedness = "right", profile = "") {
    if (!this._controllers) {
      return;
    }
    const controller = this._controllers[profile + "_" + handedness];

    if (!controller) {
      return;
    }
    controller.visible = true;
  }

  addLaserPointer(rigidTransform) {
    if (this._blurred) {
      return;
    }
    // Create the laser pointer mesh if needed.
    if (!this._lasers && this._renderer) {
      this._lasers = [this._createLaserMesh()];
      this.addNode(this._lasers[0]);
    }

    let laser: LaserMesh | undefined;
    if (this._activeLasers < (this._lasers?.length ?? 0)) {
      laser = this._lasers?.at(this._activeLasers);
    } else {
      if (this._lasers) {
        laser = this._lasers.at(0)?.clone();
        this.addNode(laser);
        laser && this._lasers.push(laser);
      } else {
        console.error("There no this._lasers");
      }
    }
    this._activeLasers = (this._activeLasers + 1) % this._maxInputElements;

    if (!laser) {
      console.error("There no laser");
      return;
    }

    laser.matrix = rigidTransform.matrix;
    laser.visible = true;
  }

  addCursor(cursorPos) {
    if (this._blurred) {
      return;
    }
    // Create the cursor mesh if needed.
    if (!this._cursors && this._renderer) {
      this._cursors = [this._createCursorMesh()];
      this.addNode(this._cursors[0]);
    }

    let cursor = null;
    if (this._activeCursors < this._cursors.length) {
      cursor = this._cursors[this._activeCursors];
    } else {
      cursor = this._cursors[0].clone();
      this.addNode(cursor);
      this._cursors.push(cursor);
    }
    this._activeCursors = (this._activeCursors + 1) % this._maxInputElements;

    cursor.translation = cursorPos;
    cursor.visible = true;
  }

  reset(options) {
    if (!options) {
      options = DEFAULT_RESET_OPTIONS;
    }
    if (this._controllers && options.controllers) {
      for (const handedness in this._controllers) {
        const controller = this._controllers[handedness];
        controller.activeCount = 0;
        for (const controllerNode of controller.nodes) {
          controllerNode.visible = false;
        }
      }
    }
    if (this._lasers && options.lasers) {
      for (const laser of this._lasers) {
        laser.visible = false;
      }
      this._activeLasers = 0;
    }
    if (this._cursors && options.cursors) {
      for (const cursor of this._cursors) {
        cursor.visible = false;
      }
      this._activeCursors = 0;
    }
  }

  _createLaserMesh(): LaserMesh {
    const gl = this._renderer._gl;

    const lr = LASER_DIAMETER * 0.5;
    const ll = LASER_LENGTH;

    // Laser is rendered as cross-shaped beam
    const laserVerts = [
      // X    Y   Z    U    V
      0.0,
      lr,
      0.0,
      0.0,
      1.0,
      0.0,
      lr,
      -ll,
      0.0,
      0.0,
      0.0,
      -lr,
      0.0,
      1.0,
      1.0,
      0.0,
      -lr,
      -ll,
      1.0,
      0.0,

      lr,
      0.0,
      0.0,
      0.0,
      1.0,
      lr,
      0.0,
      -ll,
      0.0,
      0.0,
      -lr,
      0.0,
      0.0,
      1.0,
      1.0,
      -lr,
      0.0,
      -ll,
      1.0,
      0.0,

      0.0,
      -lr,
      0.0,
      0.0,
      1.0,
      0.0,
      -lr,
      -ll,
      0.0,
      0.0,
      0.0,
      lr,
      0.0,
      1.0,
      1.0,
      0.0,
      lr,
      -ll,
      1.0,
      0.0,

      -lr,
      0.0,
      0.0,
      0.0,
      1.0,
      -lr,
      0.0,
      -ll,
      0.0,
      0.0,
      lr,
      0.0,
      0.0,
      1.0,
      1.0,
      lr,
      0.0,
      -ll,
      1.0,
      0.0
    ];
    const laserIndices = [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 11, 10, 12, 13, 14, 13, 15, 14];

    const laserVertexBuffer = this._renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(laserVerts));
    const laserIndexBuffer = this._renderer.createRenderBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(laserIndices));

    const laserIndexCount = laserIndices.length;

    const laserAttribs = [
      new PrimitiveAttribute("POSITION", laserVertexBuffer, 3, gl.FLOAT, 20, 0),
      new PrimitiveAttribute("TEXCOORD_0", laserVertexBuffer, 2, gl.FLOAT, 20, 12)
    ];

    const laserPrimitive = new Primitive(laserAttribs, laserIndexCount);
    laserPrimitive.setIndexBuffer(laserIndexBuffer);

    const laserMaterial = new LaserMaterial();

    const laserRenderPrimitive = this._renderer.createRenderPrimitive(laserPrimitive, laserMaterial);
    const meshNode = new Node();
    meshNode.addRenderPrimitive(laserRenderPrimitive);
    return meshNode;
  }

  _createCursorMesh() {
    const gl = this._renderer._gl;

    // Cursor is a circular white dot with a dark "shadow" skirt around the edge
    // that fades from black to transparent as it moves out from the center.
    // Cursor verts are packed as [X, Y, Luminance, Opacity]
    const cursorVerts = [];
    const cursorIndices = [];

    const segRad = (2.0 * Math.PI) / CURSOR_SEGMENTS;

    // Cursor center
    for (let i = 0; i < CURSOR_SEGMENTS; ++i) {
      const rad = i * segRad;
      const x = Math.cos(rad);
      const y = Math.sin(rad);
      cursorVerts.push(x * CURSOR_RADIUS, y * CURSOR_RADIUS, 1.0, CURSOR_OPACITY);

      if (i > 1) {
        cursorIndices.push(0, i - 1, i);
      }
    }

    const indexOffset = CURSOR_SEGMENTS;

    // Cursor Skirt
    for (let i = 0; i < CURSOR_SEGMENTS; ++i) {
      const rad = i * segRad;
      const x = Math.cos(rad);
      const y = Math.sin(rad);
      cursorVerts.push(
        x * CURSOR_RADIUS,
        y * CURSOR_RADIUS,
        CURSOR_SHADOW_INNER_LUMINANCE,
        CURSOR_SHADOW_INNER_OPACITY
      );
      cursorVerts.push(
        x * CURSOR_SHADOW_RADIUS,
        y * CURSOR_SHADOW_RADIUS,
        CURSOR_SHADOW_OUTER_LUMINANCE,
        CURSOR_SHADOW_OUTER_OPACITY
      );

      if (i > 0) {
        const idx = indexOffset + i * 2;
        cursorIndices.push(idx - 2, idx - 1, idx);
        cursorIndices.push(idx - 1, idx + 1, idx);
      }
    }

    const idx = indexOffset + CURSOR_SEGMENTS * 2;
    cursorIndices.push(idx - 2, idx - 1, indexOffset);
    cursorIndices.push(idx - 1, indexOffset + 1, indexOffset);

    const cursorVertexBuffer = this._renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(cursorVerts));
    const cursorIndexBuffer = this._renderer.createRenderBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cursorIndices)
    );

    const cursorIndexCount = cursorIndices.length;

    const cursorAttribs = [new PrimitiveAttribute("POSITION", cursorVertexBuffer, 4, gl.FLOAT, 16, 0)];

    const cursorPrimitive = new Primitive(cursorAttribs, cursorIndexCount);
    cursorPrimitive.setIndexBuffer(cursorIndexBuffer);

    const cursorMaterial = new CursorMaterial();
    const cursorHiddenMaterial = new CursorHiddenMaterial();

    // Cursor renders two parts: The bright opaque cursor for areas where it's
    // not obscured and a more transparent, darker version for areas where it's
    // behind another object.
    const cursorRenderPrimitive = this._renderer.createRenderPrimitive(cursorPrimitive, cursorMaterial);
    const cursorHiddenRenderPrimitive = this._renderer.createRenderPrimitive(cursorPrimitive, cursorHiddenMaterial);
    const meshNode = new Node();
    meshNode.addRenderPrimitive(cursorRenderPrimitive);
    meshNode.addRenderPrimitive(cursorHiddenRenderPrimitive);
    return meshNode;
  }
}
