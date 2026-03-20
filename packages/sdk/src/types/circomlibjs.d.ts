declare module "circomlibjs" {
  export interface BabyJub {
    F: {
      toObject(el: unknown): bigint;
      e(v: bigint | string | number): unknown;
      toString(el: unknown, radix?: number): string;
    };
    Base8: [unknown, unknown];
    mulPointEscalar(base: [unknown, unknown], scalar: bigint): [unknown, unknown];
    addPoint(a: [unknown, unknown], b: [unknown, unknown]): [unknown, unknown];
    inSubgroup(p: [unknown, unknown]): boolean;
    inCurve(p: [unknown, unknown]): boolean;
    unpackPoint(packed: Uint8Array): [unknown, unknown];
    packPoint(point: [unknown, unknown]): Uint8Array;
  }

  export interface Poseidon {
    (inputs: (bigint | unknown)[]): unknown;
    F: {
      toObject(el: unknown): bigint;
      e(v: bigint | string | number): unknown;
      toString(el: unknown, radix?: number): string;
    };
  }

  export function buildBabyjub(): Promise<BabyJub>;
  export function buildPoseidon(): Promise<Poseidon>;
  export function buildEddsa(): Promise<unknown>;
}
