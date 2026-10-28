import { aurora } from './aurora';
import { blueWave } from './blue-wave';
import { bokeh } from './bokeh';
import { liquid } from './liquid';
import { Visualization } from './models';
import { ncs } from './ncs';
import { rainbowRoad } from './rainbow-road';
import { ripples } from './ripples';
import { seascape } from './seascape';
import { spectrum } from './spectrum';
import { stringTheory } from './string-theory';

export type { Visualization } from './models';

// Settings refer to visualizations by their position, new ones go at the end
export const visualizations: Visualization[] = [
  blueWave,
  rainbowRoad,
  stringTheory,
  seascape,
  spectrum,
  aurora,
  ripples,
  bokeh,
  liquid,
  ncs,
];
