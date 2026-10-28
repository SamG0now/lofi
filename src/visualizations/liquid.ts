import { Visualization } from './models';

// The cover's colors flowing into each other like a soft gradient wallpaper, stirred by the bass
export const liquid: Visualization = {
  name: 'Liquid',
  shader: `
    vec4 visualize() {
      vec2 q = p * 1.6;
      float t = u_flow * 0.08;
      float stir = 1.6 + 1.2 * u_bass;

      vec2 warp = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3 - t)));
      vec2 fold = vec2(fbm(q + stir * warp + vec2(1.7, 9.2) + 0.7 * t), fbm(q + stir * warp + vec2(8.3, 2.8) - 0.5 * t));
      float f = fbm(q + 2.2 * fold);

      vec3 color = palette(1.4 * f + 0.35 * length(fold) + 0.02 * u_time);
      // deeper where the colors pool, softly lit where they fold over
      color *= 0.45 + 0.75 * smoothstep(0.1, 0.85, f);
      color = mix(color, vec3(1.0), 0.3 * pow(smoothstep(0.6, 0.95, f), 2.0) * (0.6 + 0.8 * u_beat));

      return vec4(color, 1.0);
    }
  `,
};
