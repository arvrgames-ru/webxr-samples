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

import { Float32ArrayOrArray } from "../../../interfaces";
import { vec3 } from "../math/gl-matrix";

export class PrimitiveAttribute {
  name: string;
  buffer: Buffer;
  componentCount: number;
  componentType: number;
  stride: number;
  byteOffset: number;
  normalized: boolean;

  constructor(
    name: string,
    buffer: Buffer,
    componentCount: number | undefined,
    componentType: number | undefined,
    stride: number | undefined,
    byteOffset: number | undefined
  ) {
    this.name = name;
    this.buffer = buffer;
    this.componentCount = componentCount || 3;
    this.componentType = componentType || 5126; // gl.FLOAT;
    this.stride = stride || 0;
    this.byteOffset = byteOffset || 0;
    this.normalized = false;
  }
}

export class Primitive {
  attributes: PrimitiveAttribute[];
  elementCount: number;
  mode: number;
  indexBuffer: Buffer | null;
  indexByteOffset: number;
  indexType: number;
  _min: typeof vec3 | Float32ArrayOrArray | null;
  _max: typeof vec3 | Float32ArrayOrArray | null;

  constructor(attributes: PrimitiveAttribute[] | undefined, elementCount: number, mode: number) {
    this.attributes = attributes || [];
    this.elementCount = elementCount || 0;
    this.mode = mode || 4; // gl.TRIANGLES;
    this.indexBuffer = null;
    this.indexByteOffset = 0;
    this.indexType = 0;
    this._min = null;
    this._max = null;
  }

  setIndexBuffer(indexBuffer, byteOffset, indexType) {
    this.indexBuffer = indexBuffer;
    this.indexByteOffset = byteOffset || 0;
    this.indexType = indexType || 5123; // gl.UNSIGNED_SHORT;
  }

  setBounds(min, max) {
    this._min = vec3.clone(min);
    this._max = vec3.clone(max);
  }
}
