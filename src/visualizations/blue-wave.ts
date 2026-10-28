import { Visualization } from './models';

// The music's actual waveform as a glowing line, with two fainter echoes behind it
export const blueWave: Visualization = {
  name: 'Blue Wave',
  shader: `
    // the waves calm down towards the sides and ripple gently while it's silent
    float waveAt(float x, float amplitude, float phase) {
      float idle = 0.015 * sin(x * 9.0 + u_time * 1.3 + phase) * (1.0 - u_level);
      return (waveform(x) * amplitude + idle) * pow(sin(PI * x), 0.8);
    }

    // distance to the wave, corrected by its slope so that steep parts aren't thinner (up to a point, the glow
    // would otherwise smear along the steepest ones)
    float distanceToWave(float amplitude, float phase) {
      float y = waveAt(uv.x, amplitude, phase);
      float slope = (waveAt(uv.x + 2.0 / u_resolution.x, amplitude, phase) - y) / (2.0 * px);
      slope = clamp(slope, -3.0, 3.0);
      return abs(p.y - y) / sqrt(1.0 + slope * slope);
    }

    vec4 visualize() {
      float amplitude = 0.12 + 0.2 * u_level + 0.05 * u_beat;
      float main = distanceToWave(amplitude, 0.0);
      float echo = distanceToWave(-0.6 * amplitude, 2.0);
      float farEcho = distanceToWave(0.35 * amplitude, 4.0);

      // deep blue night, a little lighter around the wave
      vec3 night = mix(vec3(0.01, 0.02, 0.08), vec3(0.03, 0.07, 0.2), glow(abs(p.y), 0.25));
      vec4 color = vec4(night * 0.7, 0.7);

      color.rgb += vec3(0.25, 0.2, 0.9) * (0.5 * line(farEcho, 0.003) + 0.25 * glow(farEcho, 0.03));
      color.rgb += vec3(0.1, 0.55, 1.0) * (0.7 * line(echo, 0.003) + 0.3 * glow(echo, 0.025));
      float brightness = 0.8 + 0.4 * u_beat;
      color.rgb += vec3(0.75, 0.92, 1.0) * line(main, 0.003 + 0.002 * u_bass) * brightness;
      color.rgb += vec3(0.1, 0.45, 1.0) * glow(main, 0.015 + 0.02 * u_bass) * brightness;
      return color;
    }
  `,
};
