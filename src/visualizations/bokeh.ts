import { Visualization } from './models';

// Out of focus lights drifting upwards in three layers, each lighting up with its part of the spectrum
export const bokeh: Visualization = {
  name: 'Bokeh',
  shader: `
    vec4 visualize() {
      vec4 color = vec4(0.0, 0.0, 0.0, 0.25);

      for (int layer = 0; layer < 3; layer++) {
        float depth = float(layer);
        float scale = 2.5 + 1.5 * depth;
        vec2 q = p * scale + vec2(depth * 7.3, -u_flow * (0.12 + 0.06 * depth));
        vec2 cell = floor(q);

        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            vec2 id = cell + vec2(float(dx), float(dy)) + depth * 31.7;
            if (hash(id) < 0.3) continue;

            vec2 center = cell + vec2(float(dx), float(dy)) + 0.5 + 0.6 * (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5);
            center += 0.1 * vec2(sin(u_time * 0.4 + hash(id) * TAU), cos(u_time * 0.3 + hash(id + 2.0) * TAU));
            float level = spectrum(0.05 + 0.7 * hash(id + 3.3));
            float size = (0.2 + 0.2 * hash(id + 5.9)) * (0.85 + 0.3 * level + 0.15 * u_beat);
            float d = length(q - center);

            // a soft disk with a slightly brighter rim, like a light out of focus
            float softness = 0.05 + 0.04 * depth;
            float disk = smoothstep(size, size - softness, d);
            float rim = smoothstep(size * 0.6, size - softness * 0.5, d) * disk;
            vec3 tint = palette(hash(id + 9.1) + u_time * 0.01);
            float brightness = (0.12 + 0.55 * level) * (1.0 - 0.25 * depth);
            color.rgb += tint * (0.6 * disk + 0.4 * rim) * brightness;
          }
        }
      }
      return color;
    }
  `,
};
