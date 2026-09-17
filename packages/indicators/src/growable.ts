/**
 * A Float64Array that grows by doubling capacity instead of reallocating on
 * every push, so appending N points is amortized O(N) rather than O(N^2).
 */
export class GrowableFloat64 {
  private buf: Float64Array;
  private _length: number;

  constructor(initial: Float64Array) {
    this.buf = initial;
    this._length = initial.length;
  }

  get length(): number {
    return this._length;
  }

  /** A view of exactly the live portion; may share memory with future pushes, treat as read-only. */
  view(): Float64Array {
    return this.buf.subarray(0, this._length);
  }

  push(value: number): void {
    if (this._length >= this.buf.length) {
      const grown = new Float64Array(Math.max(16, this.buf.length * 2));
      grown.set(this.buf);
      this.buf = grown;
    }
    this.buf[this._length] = value;
    this._length++;
  }

  replaceLast(value: number): void {
    if (this._length === 0) {
      this.push(value);
      return;
    }
    this.buf[this._length - 1] = value;
  }
}
