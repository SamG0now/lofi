/* eslint-disable no-console */
import { noop } from 'lodash';

import { isDrawingFrame, requestDrawingFrame, toMainWindowTime } from './frame-pacing';
import {
  AudioFrame,
  AudioSource,
  BEAT_HISTORY,
  Palette,
  SPECTRUM_BANDS,
  Visualization,
  WAVEFORM_POINTS,
} from './models';
import { loadImage } from './palette';

// the music moves the visualizations along faster than time when it's loud
const SILENT_FLOW_SPEED = 0.35;
const LOUD_FLOW_SPEED = 1.75;
const PALETTE_TRANSITION_IN_S = 1.2;
// In silence they only drift along slowly, they're drawn less often then: a little over 30 times a second
const SILENT_LEVEL = 0.01;
const SILENT_FRAME_INTERVAL_IN_MS = 25;

/**
 * Every visualization is a fragment shader defining `vec4 visualize()`, which returns the pixel's color with
 * premultiplied alpha: transparent parts show the cover art, light added on top of it covers it as much as it's bright.
 */
const SHADER_HEADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
// seconds since the visualization started
uniform float u_time;
// like time, but faster when the music is loud
uniform float u_flow;
// the music, from 0 to 1, see AudioFrame
uniform float u_level;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_beat;
uniform vec4 u_beatAges;
// colors of the cover art
uniform vec3 u_color0;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform sampler2D u_spectrum;
uniform sampler2D u_waveform;
// the cover art, once it has loaded
uniform sampler2D u_cover;
uniform float u_hasCover;
// how big it's drawn, 1 as it was made
uniform float u_zoom;

#define PI 3.14159265
#define TAU 6.28318531

// Set before visualize() runs: uv goes from 0 to 1 across the canvas, p is centered with the shorter side going
// from -0.5 to 0.5 (less of it when zoomed in), px is the size of a pixel in p
vec2 uv;
vec2 p;
float px;

// x from 0 (bass) to 1 (treble)
float spectrum(float x) { return texture2D(u_spectrum, vec2(x, 0.25)).r; }
float spectrumPeak(float x) { return texture2D(u_spectrum, vec2(x, 0.75)).r; }

// x from 0 to 1 along the waveform, returns -1 to 1
float waveform(float x) { return texture2D(u_waveform, vec2(x, 0.5)).r * 2.0 - 1.0; }

// The cover art, at coverUv from (0, 0) in its bottom left corner to (1, 1) in its top right. Until it has loaded, or
// if it can't be, there's none.
bool hasCover() { return u_hasCover > 0.5; }
vec3 cover(vec2 coverUv) { return texture2D(u_cover, coverUv).rgb; }

float hash(vec2 q) {
  vec3 q3 = fract(vec3(q.xyx) * 0.1031);
  q3 += dot(q3, q3.yzx + 33.33);
  return fract((q3.x + q3.y) * q3.z);
}

float noise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
}

float fbm(vec2 q) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(q);
    q = q * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

// the cover's colors in a loop, t wraps around
vec3 palette(float t) {
  float x = fract(t) * 3.0;
  float blend = smoothstep(0.0, 1.0, fract(x));
  if (x < 1.0) return mix(u_color0, u_color1, blend);
  if (x < 2.0) return mix(u_color1, u_color2, blend);
  return mix(u_color2, u_color0, blend);
}

vec3 hsv(float hue, float saturation, float value) {
  vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return value * mix(vec3(1.0), rgb, saturation);
}

// anti-aliased line of the given half width, d away from it
float line(float d, float width) { return 1.0 - smoothstep(width - px, width + px, d); }

// soft light falling off with the distance
float glow(float d, float radius) { return exp(-d / radius); }
`;

const SHADER_FOOTER = `
void main() {
  float side = min(u_resolution.x, u_resolution.y);
  uv = gl_FragCoord.xy / u_resolution;
  p = (gl_FragCoord.xy - 0.5 * u_resolution) / (side * u_zoom);
  px = 1.0 / (side * u_zoom);

  vec4 color = clamp(visualize(), 0.0, 1.0);
  color.a = max(color.a, max(color.r, max(color.g, color.b)));
  gl_FragColor = color;
}
`;

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// one triangle covering the whole canvas
const TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

interface DrawData {
  width: number;
  height: number;
  time: number;
  flow: number;
  zoom: number;
  frame: AudioFrame;
  palette: Palette;
}

interface Renderer {
  draw: (data: DrawData) => void;
  setCover: (image: HTMLImageElement | null) => void;
  dispose: () => void;
}

const compileShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Could not compile the shader: ${log}`);
  }
  return shader;
};

const createRenderer = (gl: WebGLRenderingContext, shader: string): Renderer => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, SHADER_HEADER + shader + SHADER_FOOTER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Could not link the shaders: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string): WebGLUniformLocation => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: uniform('u_resolution'),
    time: uniform('u_time'),
    flow: uniform('u_flow'),
    level: uniform('u_level'),
    bass: uniform('u_bass'),
    mid: uniform('u_mid'),
    treble: uniform('u_treble'),
    beat: uniform('u_beat'),
    beatAges: uniform('u_beatAges'),
    colors: [uniform('u_color0'), uniform('u_color1'), uniform('u_color2')],
    hasCover: uniform('u_hasCover'),
    zoom: uniform('u_zoom'),
  };

  // the spectrum's bands and their peaks in two rows, the waveform in one, from 0 to 255
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const createTexture = (unit: number, name: string): WebGLTexture => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniform(name), unit);
    return texture;
  };
  // their sizes never change, each frame only replaces their pixels
  const spectrumTexture = createTexture(0, 'u_spectrum');
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SPECTRUM_BANDS, 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
  const waveformTexture = createTexture(1, 'u_waveform');
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, WAVEFORM_POINTS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
  const coverTexture = createTexture(2, 'u_cover');
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.uniform1f(uniforms.hasCover, 0);
  const spectrumPixels = new Uint8ClampedArray(SPECTRUM_BANDS * 2);
  const waveformPixels = new Uint8ClampedArray(WAVEFORM_POINTS);

  return {
    draw: ({ width, height, time, flow, zoom, frame, palette }) => {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.flow, flow);
      gl.uniform1f(uniforms.zoom, zoom);
      gl.uniform1f(uniforms.level, frame.level);
      gl.uniform1f(uniforms.bass, frame.bass);
      gl.uniform1f(uniforms.mid, frame.mid);
      gl.uniform1f(uniforms.treble, frame.treble);
      gl.uniform1f(uniforms.beat, frame.beat);
      gl.uniform4fv(uniforms.beatAges, frame.beatAges.subarray(0, BEAT_HISTORY));
      uniforms.colors.forEach((location, index) => gl.uniform3fv(location, palette[index]));

      frame.spectrum.forEach((value, index) => {
        spectrumPixels[index] = value * 255;
        spectrumPixels[SPECTRUM_BANDS + index] = frame.peaks[index] * 255;
      });
      frame.waveform.forEach((value, index) => {
        waveformPixels[index] = (value * 0.5 + 0.5) * 255;
      });

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SPECTRUM_BANDS, 2, gl.LUMINANCE, gl.UNSIGNED_BYTE, spectrumPixels);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WAVEFORM_POINTS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, waveformPixels);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    setCover: (image) => {
      if (image) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, coverTexture);
        // images start at their top row, textures at their bottom one
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
      gl.uniform1f(uniforms.hasCover, image ? 1 : 0);
    },
    dispose: () => {
      gl.deleteTexture(spectrumTexture);
      gl.deleteTexture(waveformTexture);
      gl.deleteTexture(coverTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
};

export interface VisualizationHandle {
  /** Fades over to the new colors */
  setPalette: (palette: Palette) => void;
  /** For the visualizations that show the cover art, it's there once it has loaded */
  setCover: (url?: string) => void;
  /** Draws it bigger or smaller, 1 as it was made */
  setZoom: (zoom: number) => void;
  stop: () => void;
}

/**
 * Draws the visualization on the canvas until it's stopped, sized to the canvas' size on screen, along with the frames
 * of the window it's in. Returns null if it can't, e.g. without WebGL. A stopped canvas can't be drawn on again.
 */
export const startVisualization = (
  canvas: HTMLCanvasElement,
  { name, shader }: Visualization,
  audio: AudioSource,
  initialPalette: Palette
): VisualizationHandle | null => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) {
    console.error('Visualizations need WebGL, which is unavailable. Is hardware acceleration turned off?');
    return null;
  }

  const view = canvas.ownerDocument.defaultView ?? window;
  let renderer: Renderer | null = null;
  let cancelFrame: () => void = noop;
  let startTime: number | null = null;
  let lastTime = 0;
  let isSilent = false;
  let flow = 0;
  let zoom = 1;
  let targetPalette = initialPalette;
  let palette = initialPalette;
  let coverImage: HTMLImageElement | null = null;
  let coverUrl: string | undefined;

  const render = (time: number): void => {
    const pace = isSilent ? { interval: SILENT_FRAME_INTERVAL_IN_MS, since: lastTime } : undefined;
    const isDrawing = isDrawingFrame(view, time, pace);
    cancelFrame = requestDrawingFrame(view, render, pace);
    if (!isDrawing) {
      return;
    }
    startTime = startTime ?? time;
    const dt = Math.min(Math.max(time - lastTime, 0) / 1000, 0.1);
    lastTime = time;

    const scale = view.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      Object.assign(canvas, { width, height });
    }

    const frame = audio.read(toMainWindowTime(view, time));
    isSilent = frame.level < SILENT_LEVEL;
    flow += dt * (SILENT_FLOW_SPEED + (LOUD_FLOW_SPEED - SILENT_FLOW_SPEED) * frame.level);
    const blend = 1 - Math.exp(-dt / PALETTE_TRANSITION_IN_S);
    palette = palette.map((color, i) =>
      color.map((channel, j) => channel + (targetPalette[i][j] - channel) * blend)
    ) as Palette;

    renderer.draw({ width, height, time: (time - startTime) / 1000, flow, zoom, frame, palette });
  };

  const start = (): boolean => {
    try {
      renderer = createRenderer(gl, shader);
      renderer.setCover(coverImage);
    } catch (error) {
      console.error(`The '${name}' visualization failed to start.`, error);
      return false;
    }
    lastTime = view.performance.now();
    cancelFrame = requestDrawingFrame(view, render);
    return true;
  };

  // e.g. after the GPU was reset, everything has to be created again
  const handleContextLost = (event: Event): void => {
    event.preventDefault();
    cancelFrame();
    renderer = null;
  };
  const handleContextRestored = (): void => {
    start();
  };

  const stop = (): void => {
    cancelFrame();
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    renderer?.dispose();
    renderer = null;
    // frees the GPU's memory right away rather than whenever the canvas gets garbage collected
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);
  if (!start()) {
    stop();
    return null;
  }

  return {
    setPalette: (newPalette) => {
      targetPalette = newPalette;
    },
    setCover: (url) => {
      coverUrl = url;
      if (!url) {
        coverImage = null;
        renderer?.setCover(null);
        return;
      }
      loadImage(url)
        .then((image) => {
          // a later cover may have been set while this one loaded
          if (coverUrl === url) {
            coverImage = image;
            renderer?.setCover(image);
          }
        })
        .catch((error) => {
          console.error(error);
          if (coverUrl === url) {
            coverImage = null;
            renderer?.setCover(null);
          }
        });
    },
    setZoom: (newZoom) => {
      zoom = newZoom;
    },
    stop,
  };
};
