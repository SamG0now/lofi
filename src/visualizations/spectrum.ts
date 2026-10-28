import { Visualization } from './models';

// Rounded bars rising from the bottom with falling peak caps, mirrored around the bass in the middle
export const spectrum: Visualization = {
  name: 'Spectrum',
  shader: `
    float segment(vec2 q, vec2 from, vec2 to) {
      vec2 along = to - from;
      float t = clamp(dot(q - from, along) / max(dot(along, along), 1e-4), 0.0, 1.0);
      return length(q - from - along * t);
    }

    vec4 visualize() {
      // about one bar per 10 pixels, an even count so that they mirror
      float count = floor(clamp(u_resolution.x / 10.0, 12.0, 64.0) / 2.0) * 2.0;
      float cell = uv.x * count;
      float index = floor(cell);
      float fromCenter = (abs(index + 0.5 - count * 0.5) - 0.5) / (count * 0.5 - 1.0);
      float x = mix(0.03, 0.85, fromCenter);
      float level = spectrum(x);
      float peak = spectrumPeak(x);

      // in pixels from the bottom of the bar
      float cellWidth = u_resolution.x / count;
      float radius = cellWidth * 0.3;
      float bottom = u_resolution.y * 0.1;
      float maxHeight = u_resolution.y * 0.72;
      vec2 q = vec2((fract(cell) - 0.5) * cellWidth, gl_FragCoord.y - bottom);
      float top = max(level * maxHeight, 2.0 * radius);
      float bar = segment(q, vec2(0.0, radius), vec2(0.0, top - radius)) - radius;
      float cap = length(q - vec2(0.0, peak * maxHeight + 2.5 * radius)) - radius * 0.8;

      // darker towards the bottom and right around the bars, so they stand out on any cover
      float shade = max(0.5 * smoothstep(0.85, 0.0, uv.y), 0.45 * glow(max(bar, 0.0), radius + 2.0));
      vec4 color = vec4(0.0, 0.0, 0.0, shade);

      float height = clamp(q.y / maxHeight, 0.0, 1.0);
      vec3 tint = mix(palette(fromCenter * 0.5), palette(0.4 + fromCenter * 0.5), height);
      // lighter towards the top, like they're lit from above
      tint = mix(tint, vec3(1.0), 0.15 + 0.3 * height);
      color.rgb += tint * glow(max(bar, 0.0), radius * 2.0 + 2.0) * (0.15 + 0.35 * u_beat);
      color = mix(color, vec4(tint, 1.0), smoothstep(0.5, -0.5, bar));
      color = mix(color, vec4(1.0), smoothstep(0.5, -0.5, cap) * 0.9 * step(0.02, peak));
      return color;
    }
  `,
};
