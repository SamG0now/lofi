import { Visualization } from './models';

// Neon lanes in every color racing towards the horizon, faster and brighter with the music
export const rainbowRoad: Visualization = {
  name: 'Rainbow Road',
  shader: `
    const float HORIZON = 0.12;
    const float CAMERA_HEIGHT = 0.8;
    const float LANE_WIDTH = 0.55;

    vec4 visualize() {
      // the sky lets the cover through, the road is darker
      vec4 color = vec4(vec3(0.03, 0.0, 0.08) * 0.45, 0.45);
      float belowHorizon = HORIZON - p.y;

      if (belowHorizon > 0.0) {
        float depth = CAMERA_HEIGHT / belowHorizon;
        // the road bends left and right with the bass
        float x = p.x * depth + sin(depth * 0.25 + u_flow * 0.6) * (0.4 + 1.2 * u_bass);
        float lane = floor(x / LANE_WIDTH + 0.5);
        float d = abs(x - lane * LANE_WIDTH);
        // a pixel covers more of the road the farther away it is
        float pixel = depth * px;
        float fog = exp(-depth * 0.09);

        vec3 tint = hsv(lane * 0.11 + u_time * 0.03, 0.75, 1.0);
        float lineWidth = 0.012 + pixel;
        float lines = smoothstep(lineWidth + pixel, lineWidth - pixel, d);
        float dashes = step(0.5, fract(depth * 0.6 - u_flow * 2.0)) * smoothstep(0.08, 0.0, d);
        float brightness = 0.55 + 0.6 * u_level + 0.5 * u_beat;
        color = vec4(vec3(0.03, 0.0, 0.07) * 0.8, 0.8);
        color.rgb += tint * (lines + 0.3 * glow(d, 0.06 + 0.1 * u_mid) + 0.25 * dashes) * fog * brightness;
      }

      // the horizon lights up with the bass
      float horizonGlow = glow(abs(p.y - HORIZON), 0.02 + 0.03 * u_bass);
      color.rgb += hsv(uv.x * 0.8 + u_time * 0.03, 0.6, 1.0) * horizonGlow * (0.35 + 0.65 * u_bass);
      return color;
    }
  `,
};
