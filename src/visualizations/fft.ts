/** In-place radix-2 FFT of a fixed power of two size, transforming its own buffers */
export class Fft {
  readonly real: Float32Array;

  readonly imaginary: Float32Array;

  private readonly reversed: Uint32Array;

  private readonly cos: Float32Array;

  private readonly sin: Float32Array;

  constructor(readonly size: number) {
    const bits = Math.log2(size);
    if (!Number.isInteger(bits)) {
      throw new Error(`FFT size must be a power of two, got ${size}`);
    }

    this.real = new Float32Array(size);
    this.imaginary = new Float32Array(size);

    this.reversed = new Uint32Array(size);
    for (let i = 0; i < size; i += 1) {
      let reversed = 0;
      for (let bit = 0; bit < bits; bit += 1) {
        reversed = reversed * 2 + (Math.floor(i / 2 ** bit) % 2);
      }
      this.reversed[i] = reversed;
    }

    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i += 1) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
  }

  transform(): void {
    const { size, reversed, real, imaginary } = this;

    for (let i = 0; i < size; i += 1) {
      const j = reversed[i];
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
      }
    }

    for (let half = 1; half < size; half *= 2) {
      const step = size / (half * 2);
      for (let start = 0; start < size; start += half * 2) {
        for (let k = 0; k < half; k += 1) {
          const even = start + k;
          const odd = even + half;
          const cos = this.cos[k * step];
          const sin = this.sin[k * step];
          const oddReal = real[odd] * cos - imaginary[odd] * sin;
          const oddImaginary = real[odd] * sin + imaginary[odd] * cos;
          real[odd] = real[even] - oddReal;
          imaginary[odd] = imaginary[even] - oddImaginary;
          real[even] += oddReal;
          imaginary[even] += oddImaginary;
        }
      }
    }
  }
}
