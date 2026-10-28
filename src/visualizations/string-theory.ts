import { Visualization } from './models';

// Three glowing strings around the center, plucked by the spectrum: bass at the bottom, treble at the top
export const stringTheory: Visualization = {
  name: 'String Theory',
  shader: `
    vec4 visualize() {
      float radius = length(p);
      // 0 at the bottom, PI at the top, the same on both sides
      float angle = atan(p.x, -p.y);
      float x = abs(angle) / PI;
      // a few bands at once, single ones would make the strings jagged
      float band = mix(0.02, 0.85, x);
      float level = (spectrum(band - 0.03) + 2.0 * spectrum(band) + spectrum(band + 0.03)) / 4.0;
      float baseRadius = 0.25 + 0.03 * u_bass + 0.03 * u_beat;

      // a darker band behind the strings keeps them readable on light covers
      vec4 color = vec4(0.0, 0.0, 0.0, 0.4 * glow(abs(radius - baseRadius - 0.04), 0.12));

      for (int i = 0; i < 3; i++) {
        float n = float(i);
        // whole numbers of waves around the circle, so they meet at the top
        float wobble = sin(angle * (3.0 + 2.0 * n) + u_flow * (0.8 + 0.5 * n) + n * 2.1);
        float ripple = 0.012 * u_treble * sin(angle * 20.0 - u_flow * 6.0 + n);
        float stringRadius = baseRadius + (0.025 + 0.08 * level) * (0.55 + 0.45 * wobble) * (1.0 - 0.2 * n) + ripple;
        float d = abs(radius - stringRadius);
        vec3 tint = palette(n / 3.0 + x * 0.3 + u_time * 0.02);
        color.rgb += mix(tint, vec3(1.0), 0.35) * line(d, 0.003) * 0.9;
        color.rgb += tint * 0.6 * glow(d, 0.018 + 0.015 * u_mid);
      }

      // the inside pulses with the beat
      color.rgb += palette(0.5 + u_time * 0.02) * glow(radius, 0.12) * (0.08 + 0.3 * u_beat);
      return color;
    }
  `,
};
