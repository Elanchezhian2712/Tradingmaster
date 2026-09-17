/** Fixed-capacity numeric ring buffer used by window-based indicators (SMA, WMA, Bollinger stddev). */
export class RingBuffer {
  private buf: Float64Array;
  private head = 0;
  private _size = 0;

  constructor(public readonly capacity: number) {
    this.buf = new Float64Array(capacity);
  }

  get size(): number {
    return this._size;
  }

  /** Pushes a new value, evicting the oldest if full. Returns the evicted value or undefined. */
  push(value: number): number | undefined {
    let evicted: number | undefined;
    if (this._size < this.capacity) {
      this.buf[(this.head + this._size) % this.capacity] = value;
      this._size++;
    } else {
      evicted = this.buf[this.head];
      this.buf[this.head] = value;
      this.head = (this.head + 1) % this.capacity;
    }
    return evicted;
  }

  /** Replaces the most recently pushed value in place (used for tick updates to a still-forming bar). */
  replaceLast(value: number): void {
    if (this._size === 0) {
      this.push(value);
      return;
    }
    const idx = (this.head + this._size - 1) % this.capacity;
    this.buf[idx] = value;
  }

  at(indexFromOldest: number): number {
    return this.buf[(this.head + indexFromOldest) % this.capacity]!;
  }

  forEach(fn: (value: number, indexFromOldest: number) => void): void {
    for (let i = 0; i < this._size; i++) fn(this.at(i), i);
  }

  sum(): number {
    let s = 0;
    this.forEach((v) => (s += v));
    return s;
  }
}
