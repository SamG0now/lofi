import { Visualization } from './models';

// Every beat sends a ring of light across the cover, gentle ones keep flowing out in between
export const ripples: Visualization = {
  name: 'Ripples',
  shader: `
    vec4 visualize() {
      float radius = length(p);
      float angle = atan(p.y, p.x);
      vec4 color = vec4(0.0, 0.0, 0.0, 0.15 + 0.25 * smoothstep(0.1, 0.7, radius));

      for (int i = 0; i < 4; i++) {
        float n = float(i);
        float age = u_beatAges[i];
        float strength = exp(-age * 1.6) * smoothstep(0.0, 0.04, age);
        float wobble = 0.012 * u_mid * sin(angle * 6.0 + age * 4.0 + n * 1.7);
        float d = abs(radius - age * 0.45 - wobble);
        vec3 tint = palette(n * 0.25 + age * 0.3);
        color.rgb += tint * strength * (line(d, 0.004 + 0.008 * strength) + 0.5 * glow(d, 0.03));
      }

      for (int i = 0; i < 3; i++) {
        float n = float(i);
        float age = fract(u_flow * 0.12 + n / 3.0);
        float d = abs(radius - age * 0.75);
        color.rgb += palette(0.6 + n * 0.2) * (1.0 - age) * (0.15 + 0.25 * u_level) * glow(d, 0.015);
      }

      color.rgb += palette(u_time * 0.04) * glow(radius, 0.05 + 0.07 * u_bass) * (0.2 + 0.3 * u_level + 0.5 * u_beat);
      return color;
    }
  `,
};
