import { Node } from "../js/render/core/node";

export enum Types {
  i8 = "i8",
  ui8 = "ui8",
  ui8c = "ui8c",
  i16 = "i16",
  ui16 = "ui16",
  i32 = "i32",
  ui32 = "ui32",
  f32 = "f32",
  f64 = "f64",
  eid = "eid"
}

export type TypedArray =
  | Uint8Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type ArrayByType = {
  [Types.i8]: Int8Array;
  [Types.ui8]: Uint8Array;
  [Types.ui8c]: Uint8ClampedArray;
  [Types.i16]: Int16Array;
  [Types.ui16]: Uint16Array;
  [Types.i32]: Int32Array;
  [Types.ui32]: Uint32Array;
  [Types.f32]: Float32Array;
  [Types.f64]: Float64Array;
  [Types.eid]: Uint32Array;
};

export type Eye = "left" | "right";

export type Vector3Array = [number, number, number];
export type Vector4Array = [number, number, number, number];

export type ControllerNode = (Node | object) & {
  visible?: boolean;
};

export type LaserMesh = Node

export type Float32ArrayOrArray = Float32Array | Array<number>
