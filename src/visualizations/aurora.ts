import { Visualization } from './models';

// Ribbons of northern lights in the cover's colors, swaying with the music under a few twinkling stars
export const aurora: Visualization = {
  name: 'Aurora',
  shader: `
    vec4 visualize() {
      vec4 color = vec4(vec3(0.0, 0.02, 0.06) * 0.55, 0.55);
      float t = u_flow * 0.1;

      for (int i = 0; i < 4; i++) {
        float n = float(i);
        float x = p.x * (0.8 + 0.25 * n) + n * 3.7;
        // each ribbon's bright lower edge winds across the sky at its own height
        float edge = -0.18 + 0.13 * n + 0.22 * (fbm(vec2(x * 1.1 + t, n * 1.7 + t * 0.5)) - 0.45);
        float above = p.y - edge;
        float level = spectrum(0.06 + 0.22 * n + 0.1 * uv.x);
        // rays rising from the edge, swaying sideways
        float rays = pow(noise(vec2(x * 22.0 + 2.0 * sin(p.y * 6.0 + t * 4.0), n * 5.0 + t * 2.0)), 1.5);
        float height = 0.05 + 0.1 * level;
        float ribbon = smoothstep(-0.008, 0.006, above) * exp(-max(above, 0.0) / height);
        ribbon *= 0.35 + 0.65 * rays;
        // the edge itself shines brightest
        ribbon += 0.6 * glow(abs(above), 0.006) * (0.5 + 0.5 * rays);
        vec3 tint = mix(palette(n * 0.3 + t * 0.2), palette(n * 0.3 + 0.33 + t * 0.2), smoothstep(0.0, 0.12, above));
        color.rgb += tint * ribbon * (0.25 + 1.2 * level) * (0.85 + 0.4 * u_beat) * (1.0 - 0.15 * n);
      }

      // a star in some of the cells, a pixel or two wide
      vec2 cell = floor(gl_FragCoord.xy / 9.0);
      vec2 center = (cell + 0.2 + 0.6 * vec2(hash(cell + 3.1), hash(cell + 5.7))) * 9.0;
      float star = step(0.93, hash(cell)) * smoothstep(1.4, 0.4, length(gl_FragCoord.xy - center));
      float twinkle = 0.4 + 0.6 * sin(u_time * 2.0 + hash(cell + 7.0) * TAU);
      color.rgb += vec3(0.9, 0.95, 1.0) * star * twinkle * (0.3 + 0.7 * u_treble) * smoothstep(-0.1, 0.4, p.y);
      return color;
    }
  `,
};
