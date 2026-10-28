import { Visualization } from './models';

// The circle from NCS's videos: the cover art in it like a record's label, mirrored spectrums stacked around it in the
// cover's colors, dust flying out towards the viewer, rings rippling out on the beats and a shake with them
const NCS_SHADER = `
    const int LAYERS = 6;

    float circleRadius;

    // how far layer k reaches out of the circle, t goes from 0 at the top to 1 at the bottom on either side
    float reach(float t, float k) {
      // each layer is turned a little, so its color peeks out beside the spikes in front of it
      float x = mix(0.04, 0.72, pow(clamp(t + 0.01 * k, 0.0, 1.0), 0.8));
      // the ones further back follow the falling peaks, so their colors linger after each hit
      float level = mix(spectrum(x), spectrumPeak(x), k / float(LAYERS - 1));
      return pow(level, 2.5) * 0.12 * (1.0 + 0.06 * k) + 0.005 + 0.004 * k;
    }

    // to layer k's edge, positive outside of it, corrected by its slope so that the spikes' sides stay smooth
    float edge(float r, float t, float k) {
      float delta = 0.004;
      float outline = circleRadius + reach(t, k);
      float slope = (circleRadius + reach(t + delta, k) - outline) / (delta * PI * r);
      return (r - outline) / sqrt(1.0 + min(slope * slope, 25.0));
    }

    // white in front, then the cover's colors going from light to deep
    vec3 layerTint(float k) {
      if (k < 0.5) return vec3(1.0);
      vec3 tint = palette(0.2 * (k - 1.0) + 0.02 * u_time);
      return mix(tint, vec3(1.0), 0.35 * (1.0 - (k - 1.0) / float(LAYERS - 2)));
    }

    // specks flying out of the middle towards the viewer, in waves that take turns
    float dust(vec2 q) {
      float light = 0.0;
      for (int i = 0; i < 4; i++) {
        float travel = float(i) / 4.0 + u_flow * 0.12;
        float depth = fract(travel);
        // far away they're small and bunched up in the middle, up close they spread out and grow
        float scale = mix(8.0, 0.8, depth);
        vec2 world = q * scale + float(i) * 3.7;
        vec2 cell = floor(world);
        vec2 id = cell + floor(travel) * vec2(13.1, 7.7) + float(i) * 31.0;
        if (hash(id) < 0.5) continue;

        vec2 center = cell + 0.15 + 0.7 * vec2(hash(id + 1.7), hash(id + 4.3));
        float d = length(world - center) / scale;
        float size = max(0.015 * (0.4 + hash(id + 2.9)) / scale, 0.6 * px);
        float fade = smoothstep(0.0, 0.25, depth) * smoothstep(1.0, 0.75, depth);
        float speck = smoothstep(size + px, size - 0.5 * px, d) + 0.25 * glow(d, size * 1.5);
        light += speck * fade * (0.4 + 0.6 * hash(id + 5.5));
      }
      return light;
    }

    // A ring rippling out of the circle after a beat, fading as it goes
    float shockwave(float r, float age) {
      float radius = circleRadius + age * 0.5;
      float fade = exp(-age * 3.5);
      float d = abs(r - radius);
      return fade * (line(d, (0.6 + 1.5 * age) * px) + 0.35 * glow(d, 0.012));
    }

    // In the circle: the cover art, turning like a record's label, faster when the music is loud. Its middle shows,
    // its corners stay outside. Without a cover, the cover's colors swirl around instead.
    vec3 label(vec2 q) {
      float angle = -u_flow * 0.3;
      vec2 local = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * q / circleRadius;
      vec3 art;
      if (hasCover()) {
        art = cover(local * 0.5 + 0.5);
      } else {
        float swirl = atan(local.y, local.x) / TAU + 0.35 * length(local) + 0.03 * u_time;
        art = palette(swirl) * (0.75 + 0.25 * fbm(local * 3.0 + u_time * 0.2));
      }
      // lit up by the beat, darker towards the rim where the spectrums start
      float rim = smoothstep(0.7, 1.0, length(local));
      return art * (0.88 + 0.22 * u_beat) * (1.0 - 0.35 * rim);
    }

    vec4 visualize() {
      // the beats knock everything around, like a camera sitting on a speaker
      float shakeTime = u_time * 24.0;
      vec2 shake = vec2(noise(vec2(shakeTime, 0.0)), noise(vec2(shakeTime, 9.0))) - 0.5;
      vec2 q = p - shake * 0.04 * u_beat * (0.5 + 0.5 * u_bass);
      float r = length(q);
      float t = abs(atan(q.x, q.y)) / PI;
      #ifdef FULL
      // on its own, the circle takes up more of the player
      circleRadius = 0.25 * (1.0 + 0.06 * u_bass + 0.04 * u_beat);
      // nothing around it but the light, the desktop shows through
      vec4 color = vec4(0.0);
      color.rgb += vec3(dust(q) * (0.6 + 0.4 * u_level + 0.5 * u_beat));
      #else
      circleRadius = 0.19 * (1.0 + 0.06 * u_bass + 0.04 * u_beat);
      // the cover darkened around the circle, a little less on the beat
      vec4 color = vec4(0.0, 0.0, 0.0, 0.6 + 0.25 * smoothstep(0.2, 0.75, r) - 0.12 * u_beat);
      color.rgb += vec3(dust(q) * (0.45 + 0.35 * u_level + 0.4 * u_beat));
      #endif

      // the last two beats' rings, behind the spectrums
      vec3 ringTint = mix(vec3(1.0), palette(0.05 * u_time), 0.4);
      color.rgb += ringTint * (shockwave(r, u_beatAges.x) + 0.6 * shockwave(r, u_beatAges.y)) * 0.7;

      float back = float(LAYERS - 1);
      float glowRadius = 0.015 + 0.025 * u_bass;
      color.rgb += layerTint(back) * glow(max(edge(r, t, back), 0.0), glowRadius) * (0.25 + 0.5 * u_beat);

      for (int i = 0; i < LAYERS; i++) {
        float k = float(LAYERS - 1 - i);
        float d = edge(r, t, k);
        color = mix(color, vec4(layerTint(k), 1.0), smoothstep(0.75 * px, -0.75 * px, d));
      }

      return mix(color, vec4(label(q), 1.0), smoothstep(circleRadius + px, circleRadius - px, r));
    }
  `;

export const ncs: Visualization = {
  name: 'NCS',
  shader: NCS_SHADER,
};

// The whole player as the circle: no cover around it, only its light over the desktop
export const ncsFull: Visualization = {
  name: 'NCS',
  shader: `#define FULL\n${NCS_SHADER}`,
};
