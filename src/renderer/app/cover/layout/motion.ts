import { Direction, ItemMotion } from '../../../../models/player-design';

// Everything is hidden until the player is hovered, then eases in: the backdrop first, then each item the way its
// motion says. Leaving plays the same animation backwards: the last item in is the first one out.
// The settings preview shows the controls without hovering, through the class.
export const REVEALED = '#visible-ui:hover &, .is-revealed &';

export const FADE_S = 0.4;
export const GLIDE_S = 0.5;
// the song settles where it stays with a little bounce, the controls sink away under it
const SETTLE_S = 0.8;
// how far the song goes past its rest before springing back, a share of the way down
const SETTLE_OVERSHOOT = 0.12;
const SINK_FADE_S = 0.25;
const SPRING_POINTS = 40;
// what's left of the bounce at the end, too little to see
const SPRING_REST = 0.005;
// items that grow in start out at this size
const GROW_FROM = 0.6;

// each curve with its time-reversed counterpart for hiding
interface Easing {
  show: string;
  hide: string;
}
export const FADE: Easing = { show: 'ease-out', hide: 'ease-in' };
export const GLIDE: Easing = {
  show: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  hide: 'cubic-bezier(0.8, 0, 0.8, 0.2)',
};

export type Step = [property: string, durationInS: number, easing: Easing, delayInS?: number];

/** A damped spring as a CSS easing: it passes its target by `overshoot` of the distance, comes back and settles. */
const getSpringEasing = (overshoot: number): string => {
  const logOvershoot = Math.log(overshoot);
  const damping = -logOvershoot / Math.sqrt(Math.PI ** 2 + logOvershoot ** 2);
  const decay = -Math.log(SPRING_REST);
  const frequency = (decay / damping) * Math.sqrt(1 - damping ** 2);
  const points = Array.from({ length: SPRING_POINTS + 1 }, (_, index) => {
    const t = index / SPRING_POINTS;
    const oscillation = Math.cos(frequency * t) + (decay / frequency) * Math.sin(frequency * t);
    return (1 - Math.exp(-decay * t) * oscillation).toFixed(3);
  });
  points[SPRING_POINTS] = '1';
  return `linear(${points.join(', ')})`;
};

export const SPRING = getSpringEasing(SETTLE_OVERSHOOT);
export const SONG_IN_S = SETTLE_S;

export interface Timing {
  // durations and delays are multiplied by it, the design's speed is in percent
  scale: number;
  // until the last step of the reveal is over, in seconds
  revealTime: number;
}

const seconds = (value: number): string => `${Number(value.toFixed(3))}s`;

export const getTiming = (speed: number, motions: ItemMotion[], backdropSteps: Step[]): Timing => {
  const scale = 100 / speed;
  const ends = [
    ...motions.map(({ delay }) => delay + Math.max(FADE_S, GLIDE_S)),
    ...backdropSteps.map(([, duration, , delay = 0]) => delay + duration),
  ];
  return { scale, revealTime: Math.max(0, ...ends) * scale };
};

const toShow = ({ scale }: Timing, [property, duration, easing, delay = 0]: Step): string =>
  `${property} ${seconds(duration * scale)} ${easing.show} ${seconds(delay * scale)}`;

// hiding starts each step as long before the end as it had ended after the start of the reveal
const toHide = ({ scale, revealTime }: Timing, [property, duration, easing, delay = 0]: Step): string =>
  `${property} ${seconds(duration * scale)} ${easing.hide} ${seconds(
    Math.max(0, revealTime - (delay + duration) * scale)
  )}`;

export interface Transitions {
  show: string;
  hide: string;
}

export const getTransitions = (timing: Timing, steps: Step[]): Transitions => ({
  show: steps.map((step) => toShow(timing, step)).join(', '),
  hide: steps.map((step) => toHide(timing, step)).join(', '),
});

export const getSettle = ({ scale }: Timing): string => `transform ${seconds(SETTLE_S * scale)} ${SPRING}`;

// what stays on the player fades in where it rests, or coming from hover, moves there and settles
export const getStayTransition = (timing: Timing, fadeSteps: Step[]): string =>
  [...fadeSteps.map((step) => toShow(timing, step)), getSettle(timing)].join(', ');

// the controls under the song fade quickly as it moves down over them, and go along
export const getSinkTransition = (timing: Timing): string =>
  `opacity ${seconds(SINK_FADE_S * timing.scale)} ease-out 0s, ${getSettle(timing)}`;

export const getItemSteps = ({ delay }: ItemMotion): Step[] => [
  ['opacity', FADE_S, FADE, delay],
  ['transform', GLIDE_S, GLIDE, delay],
];

const DIRECTION_VECTORS: Record<Direction, [x: number, y: number]> = {
  [Direction.TopLeft]: [-1, -1],
  [Direction.Top]: [0, -1],
  [Direction.TopRight]: [1, -1],
  [Direction.Left]: [-1, 0],
  [Direction.None]: [0, 0],
  [Direction.Right]: [1, 0],
  [Direction.BottomLeft]: [-1, 1],
  [Direction.Bottom]: [0, 1],
  [Direction.BottomRight]: [1, 1],
};

/** Where an item is while hidden: as far away as its motion says, the same distance along diagonals too. */
export const getEntranceTransform = ({ from, distance, isGrowing }: ItemMotion): string => {
  const [x, y] = DIRECTION_VECTORS[from] ?? [0, 0];
  const length = Math.hypot(x, y);
  const transforms = [];
  if (length && distance) {
    const round = (value: number): number => Math.round((value / length) * distance * 10) / 10;
    transforms.push(`translate(${round(x)}px, ${round(y)}px)`);
  }
  if (isGrowing) {
    transforms.push(`scale(${GROW_FROM})`);
  }
  return transforms.join(' ') || 'none';
};
