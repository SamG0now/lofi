import { clamp } from 'lodash';

import { Fft } from './fft';
import { AudioFrame, AudioSource, BEAT_HISTORY, SPECTRUM_BANDS, WAVEFORM_POINTS } from './models';

const SAMPLE_RATE = 48000;
// Reading again within this long gives the same frame: several visualizations may follow the music at once, also in
// the settings window whose frames come a little before or after the player's. The capture brings samples every ~5ms.
const SAME_FRAME_IN_MS = 4;
// as many as the native capture keeps
const HISTORY_SIZE = 4096;
const FFT_SIZE = 2048;
const BIN_WIDTH = SAMPLE_RATE / FFT_SIZE;
// a full scale sine through the Hann window reads 1
const POWER_SCALE = (4 / FFT_SIZE) ** 2;

const MIN_FREQUENCY = 40;
const MAX_FREQUENCY = 16000;
const BASS_MAX_FREQUENCY = 160;
const MID_MAX_FREQUENCY = 2500;

// Most music loses ~3dB per octave towards the treble, tilting the spectrum back keeps the bands comparable
const TILT_DB_PER_OCTAVE = 3;
const TILT_CENTER_FREQUENCY = 1000;
// Levels are relative to the recent loudest band, so the visualizations react the same at any volume
const DYNAMIC_RANGE_DB = 40;
const CEILING_RELEASE_DB_PER_S = 4;
// below this it's silence (or noise) rather than quiet music
const MIN_CEILING_DB = -65;
const LEVEL_RANGE_DB = 30;
const MIN_LEVEL_CEILING_DB = -45;
const LEVEL_SAMPLES = 1024;

// how fast the bands follow the music
const ATTACK_IN_S = 0.025;
const RELEASE_IN_S = 0.16;
const LEVEL_ATTACK_IN_S = 0.05;
const LEVEL_RELEASE_IN_S = 0.3;
const PEAK_HOLD_IN_S = 0.35;
const PEAK_FALL_PER_S = 0.6;

// A beat is the bass suddenly getting louder: its latest 15ms against the 50ms before, checked every 5ms of new
// samples whatever the frame rate. Sustained bass doesn't count.
const ONSET_BLOCK_SAMPLES = 240;
const ONSET_RECENT_BLOCKS = 3;
const ONSET_BEFORE_BLOCKS = 10;
// a two pole low-pass around 150Hz keeps the kick and the bass
const BASS_FILTER = 1 - Math.exp((-2 * Math.PI * 150) / SAMPLE_RATE);
const ONSET_MIN_RISE_DB = 6;
const ONSET_FULL_RISE_DB = 18;
// the bass also has to be loud next to the rest of the music
const ONSET_MIN_LOUDNESS_DB = -18;
const BEAT_MIN_INTERVAL_IN_S = 0.22;
const BEAT_DECAY_IN_S = 0.16;
// without samples, beats are jumps of the peak volume above its average
const PEAK_AVERAGE_IN_S = 0.4;
const PEAK_MIN_RISE = 0.1;
const NO_BEAT_AGE_IN_S = 1000;

// The waveform shows ~21ms, a few cycles of the bass, starting where the bass rises through zero so it holds still
const WAVEFORM_SAMPLES = 1024;
const WAVEFORM_STRIDE = WAVEFORM_SAMPLES / WAVEFORM_POINTS;
const WAVEFORM_SMOOTHING = 16;
const TRIGGER_SMOOTHING = 32;
const TRIGGER_SEARCH = 1024;
const MIN_WAVEFORM_PEAK = 0.01;
const WAVEFORM_PEAK_FALL_PER_S = 0.4;
const WAVEFORM_BLEND = 0.7;

interface Band {
  fromBin: number;
  toBin: number;
  steps: number;
  tiltDb: number;
}

const getBands = (): Band[] =>
  Array.from({ length: SPECTRUM_BANDS }, (_, index) => {
    const range = MAX_FREQUENCY / MIN_FREQUENCY;
    const from = MIN_FREQUENCY * range ** (index / SPECTRUM_BANDS);
    const to = MIN_FREQUENCY * range ** ((index + 1) / SPECTRUM_BANDS);
    const center = Math.sqrt(from * to);
    return {
      fromBin: from / BIN_WIDTH,
      toBin: to / BIN_WIDTH,
      // low bands are narrower than a bin and get interpolated, high ones average all of theirs
      steps: Math.max(1, Math.ceil((to - from) / BIN_WIDTH)),
      tiltDb: TILT_DB_PER_OCTAVE * Math.log2(center / TILT_CENTER_FREQUENCY),
    };
  });

const getBandIndex = (frequency: number): number =>
  Math.round((SPECTRUM_BANDS * Math.log(frequency / MIN_FREQUENCY)) / Math.log(MAX_FREQUENCY / MIN_FREQUENCY));

// eases towards the target, quicker when it rises
const follow = (current: number, target: number, dt: number, attackInS: number, releaseInS: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / (target > current ? attackInS : releaseInS)));

const average = (values: Float32Array, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    sum += values[i];
  }
  return sum / Math.max(1, to - from);
};

const toDb = (power: number): number => 10 * Math.log10(power + 1e-12);

/** Turns what the speakers play into levels, a spectrum, beats and a waveform for the visualizations */
export class AudioAnalyzer implements AudioSource {
  private readonly samples = new Float32Array(HISTORY_SIZE);

  private readonly fft = new Fft(FFT_SIZE);

  private readonly window = Float32Array.from(
    { length: FFT_SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))
  );

  private readonly power = new Float32Array(FFT_SIZE / 2 + 1);

  private readonly bands = getBands();

  private readonly bandDbs = new Float32Array(SPECTRUM_BANDS);

  private readonly targets = new Float32Array(SPECTRUM_BANDS);

  private readonly peakHolds = new Float32Array(SPECTRUM_BANDS);

  private readonly bassBands = getBandIndex(BASS_MAX_FREQUENCY);

  private readonly midBands = getBandIndex(MID_MAX_FREQUENCY);

  private readonly frame: AudioFrame = {
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: 0,
    beatAges: new Float32Array(BEAT_HISTORY).fill(NO_BEAT_AGE_IN_S),
    spectrum: new Float32Array(SPECTRUM_BANDS),
    peaks: new Float32Array(SPECTRUM_BANDS),
    waveform: new Float32Array(WAVEFORM_POINTS),
  };

  private ceilingDb = MIN_CEILING_DB;

  private levelCeilingDb = MIN_LEVEL_CEILING_DB;

  private waveformPeak = MIN_WAVEFORM_PEAK;

  private lastTimeInMs: number | null = null;

  private capturedCount = 0;

  // the bass' energy in blocks of ONSET_BLOCK_SAMPLES, a ring buffer with the next one written at onsetBlock
  private readonly onsetBlocks = new Float32Array(ONSET_RECENT_BLOCKS + ONSET_BEFORE_BLOCKS);

  private onsetBlock = 0;

  private blockEnergy = 0;

  private blockSamples = 0;

  private bassLow = 0;

  private bassLower = 0;

  private peakAverage = 0;

  private readonly readSamples: (target: Float32Array) => number;

  private readonly readPeak: () => number;

  /**
   * @param readSamples fills the array with the latest samples, oldest first, and returns how many were captured so
   * far (0 if there are no samples)
   * @param readPeak the highest peak since the last call, for when there are no samples
   */
  constructor(readSamples: (target: Float32Array) => number, readPeak: () => number) {
    this.readSamples = readSamples;
    this.readPeak = readPeak;
  }

  read(timeInMs: number): AudioFrame {
    if (this.lastTimeInMs !== null && Math.abs(timeInMs - this.lastTimeInMs) < SAME_FRAME_IN_MS) {
      return this.frame;
    }
    const dt = this.lastTimeInMs === null ? 1 / 60 : clamp((timeInMs - this.lastTimeInMs) / 1000, 0, 0.1);
    this.lastTimeInMs = timeInMs;

    const capturedCount = this.readSamples(this.samples);
    let onset: number;
    if (capturedCount > 0) {
      const newSamples = clamp(capturedCount - this.capturedCount, 0, HISTORY_SIZE);
      this.capturedCount = capturedCount;
      onset = this.analyzeSamples(newSamples, dt);
    } else {
      onset = this.imitateSamples(dt, timeInMs);
    }
    this.updateBeat(onset, dt);

    return this.frame;
  }

  /** Returns how strong a beat started among the new samples, 0 if none did */
  private analyzeSamples(newSamples: number, dt: number): number {
    const { fft, samples, power, bands, bandDbs, targets, frame } = this;
    const offset = HISTORY_SIZE - FFT_SIZE;

    let sumOfSquares = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const sample = samples[offset + i];
      fft.real[i] = sample * this.window[i];
      fft.imaginary[i] = 0;
      if (i >= FFT_SIZE - LEVEL_SAMPLES) {
        sumOfSquares += sample * sample;
      }
    }
    fft.transform();

    for (let bin = 0; bin <= FFT_SIZE / 2; bin += 1) {
      power[bin] = (fft.real[bin] ** 2 + fft.imaginary[bin] ** 2) * POWER_SCALE;
    }

    let loudestDb = -Infinity;
    bands.forEach(({ fromBin, toBin, steps, tiltDb }, index) => {
      let sum = 0;
      for (let step = 0; step < steps; step += 1) {
        const position = fromBin + ((step + 0.5) * (toBin - fromBin)) / steps;
        const bin = Math.floor(position);
        sum += power[bin] + (power[bin + 1] - power[bin]) * (position - bin);
      }
      bandDbs[index] = toDb(sum / steps) + tiltDb;
      loudestDb = Math.max(loudestDb, bandDbs[index]);
    });

    this.ceilingDb = Math.max(loudestDb, this.ceilingDb - CEILING_RELEASE_DB_PER_S * dt, MIN_CEILING_DB);
    const floorDb = this.ceilingDb - DYNAMIC_RANGE_DB;
    bandDbs.forEach((db, index) => {
      // squared, so that only the loud parts stand out
      targets[index] = clamp((db - floorDb) / DYNAMIC_RANGE_DB, 0, 1) ** 2;
    });
    this.updateSpectrum(dt);

    const levelDb = toDb(sumOfSquares / LEVEL_SAMPLES);
    this.levelCeilingDb = Math.max(levelDb, this.levelCeilingDb - CEILING_RELEASE_DB_PER_S * dt, MIN_LEVEL_CEILING_DB);
    const level = clamp((levelDb - this.levelCeilingDb + LEVEL_RANGE_DB) / LEVEL_RANGE_DB, 0, 1);
    frame.level = follow(frame.level, level, dt, LEVEL_ATTACK_IN_S, LEVEL_RELEASE_IN_S);

    this.updateWaveform(dt);

    return this.detectBassOnset(newSamples);
  }

  private detectBassOnset(newSamples: number): number {
    const { samples, onsetBlocks } = this;
    let strongest = 0;

    for (let i = HISTORY_SIZE - newSamples; i < HISTORY_SIZE; i += 1) {
      this.bassLow += (samples[i] - this.bassLow) * BASS_FILTER;
      this.bassLower += (this.bassLow - this.bassLower) * BASS_FILTER;
      this.blockEnergy += this.bassLower * this.bassLower;
      this.blockSamples += 1;

      if (this.blockSamples === ONSET_BLOCK_SAMPLES) {
        onsetBlocks[this.onsetBlock] = this.blockEnergy / ONSET_BLOCK_SAMPLES;
        this.onsetBlock = (this.onsetBlock + 1) % onsetBlocks.length;
        this.blockEnergy = 0;
        this.blockSamples = 0;

        let recent = 0;
        let before = 0;
        for (let age = 1; age <= onsetBlocks.length; age += 1) {
          const energy = onsetBlocks[(this.onsetBlock - age + onsetBlocks.length) % onsetBlocks.length];
          if (age <= ONSET_RECENT_BLOCKS) {
            recent += energy;
          } else {
            before += energy;
          }
        }
        const recentDb = toDb(recent / ONSET_RECENT_BLOCKS);
        const riseDb = recentDb - toDb(before / ONSET_BEFORE_BLOCKS);
        const isLoud = recentDb > this.levelCeilingDb + ONSET_MIN_LOUDNESS_DB;
        if (isLoud && riseDb >= ONSET_MIN_RISE_DB) {
          strongest = Math.max(strongest, clamp(riseDb / ONSET_FULL_RISE_DB, 0.5, 1));
        }
      }
    }

    return strongest;
  }

  /** Without samples only the peak volume is known, the spectrum and waveform follow it. Returns the beat's strength. */
  private imitateSamples(dt: number, timeInMs: number): number {
    const { targets, frame } = this;
    const time = timeInMs / 1000;
    const peak = clamp(this.readPeak(), 0, 1);
    frame.level = follow(frame.level, peak, dt, LEVEL_ATTACK_IN_S, LEVEL_RELEASE_IN_S);

    targets.forEach((_, index) => {
      const x = index / SPECTRUM_BANDS;
      const shape = 0.6 + 0.4 * Math.sin(index * 0.7 + time * 3.1) * Math.sin(index * 0.23 - time * 1.7);
      targets[index] = peak * shape * (1 - 0.5 * x);
    });
    this.updateSpectrum(dt);

    frame.waveform.forEach((_, index) => {
      const x = index / WAVEFORM_POINTS;
      frame.waveform[index] =
        frame.level *
        (0.6 * Math.sin(2 * Math.PI * 3 * x + time * 7) + 0.3 * Math.sin(2 * Math.PI * 7 * x - time * 11));
    });

    const rise = peak - this.peakAverage;
    this.peakAverage += (peak - this.peakAverage) * (1 - Math.exp(-dt / PEAK_AVERAGE_IN_S));
    return rise > PEAK_MIN_RISE ? clamp(rise * 3, 0.5, 1) : 0;
  }

  private updateSpectrum(dt: number): void {
    const { targets, peakHolds, frame } = this;
    const { spectrum, peaks } = frame;

    targets.forEach((target, index) => {
      spectrum[index] = follow(spectrum[index], target, dt, ATTACK_IN_S, RELEASE_IN_S);
      if (spectrum[index] >= peaks[index]) {
        peaks[index] = spectrum[index];
        peakHolds[index] = PEAK_HOLD_IN_S;
      } else if (peakHolds[index] > 0) {
        peakHolds[index] -= dt;
      } else {
        peaks[index] = Math.max(spectrum[index], peaks[index] - PEAK_FALL_PER_S * dt);
      }
    });

    frame.bass = average(spectrum, 0, this.bassBands);
    frame.mid = average(spectrum, this.bassBands, this.midBands);
    frame.treble = average(spectrum, this.midBands, SPECTRUM_BANDS);
  }

  private updateWaveform(dt: number): void {
    const { samples, frame } = this;
    const smoothed = (index: number, width: number): number => {
      let sum = 0;
      for (let i = index - width / 2; i < index + width / 2; i += 1) {
        sum += samples[i];
      }
      return sum / width;
    };

    // the latest rising zero crossing that still leaves room for the whole waveform after it
    const latestStart = HISTORY_SIZE - WAVEFORM_SAMPLES - WAVEFORM_SMOOTHING;
    const earliestStart = Math.max(TRIGGER_SMOOTHING, latestStart - TRIGGER_SEARCH);
    let start = latestStart;
    let previous = smoothed(latestStart, TRIGGER_SMOOTHING);
    for (let index = latestStart - 1; index > earliestStart; index -= 1) {
      const current = smoothed(index, TRIGGER_SMOOTHING);
      if (current < 0 && previous >= 0) {
        start = index + 1;
        break;
      }
      previous = current;
    }

    let loudest = 0;
    const points = Array.from({ length: WAVEFORM_POINTS }, (_, index) => {
      const point = smoothed(start + index * WAVEFORM_STRIDE, WAVEFORM_SMOOTHING);
      loudest = Math.max(loudest, Math.abs(point));
      return point;
    });

    this.waveformPeak = Math.max(loudest, this.waveformPeak - WAVEFORM_PEAK_FALL_PER_S * dt, MIN_WAVEFORM_PEAK);
    points.forEach((point, index) => {
      const target = clamp((0.9 * point) / this.waveformPeak, -1, 1);
      frame.waveform[index] += (target - frame.waveform[index]) * WAVEFORM_BLEND;
    });
  }

  private updateBeat(onset: number, dt: number): void {
    const { frame } = this;
    const { beatAges } = frame;

    beatAges.forEach((age, index) => {
      beatAges[index] = age + dt;
    });

    if (onset > 0 && beatAges[0] > BEAT_MIN_INTERVAL_IN_S) {
      beatAges.copyWithin(1, 0);
      beatAges[0] = 0;
      frame.beat = Math.max(frame.beat, onset);
    } else {
      frame.beat *= Math.exp(-dt / BEAT_DECAY_IN_S);
    }
  }
}
