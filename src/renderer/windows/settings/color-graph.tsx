import { createStyles, TextInput } from '@mantine/core';
import { clamp } from 'lodash';
import React, { FunctionComponent, KeyboardEvent, PointerEvent, useEffect, useState } from 'react';

import { Rgb } from '../../../visualizations/models';
import { hexToRgb, hsvToRgb, isHexColor, rgbToHex, rgbToHsv } from '../../colors';
import { useSectionColor } from './fields';
import { getPalette } from './palette';

// bright inks print on dark paper, the last one on light paper
const SWATCHES = ['#ff6fb1', '#ff8a3d', '#ffd23f', '#4fe0c3', '#38bdf8', '#6f8dff', '#c084fc', '#ffffff', '#1e3a5f'];
const KEY_STEP = 0.02;
const HANDLE_SIZE = 14;

const useStyles = createStyles((theme) => ({
  area: {
    position: 'relative',
    height: 110,
    marginTop: theme.spacing.xs,
    borderRadius: 8,
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
    cursor: 'crosshair',
    touchAction: 'none',
    outline: 'none',
  },
  hue: {
    position: 'relative',
    height: 12,
    marginTop: 12,
    borderRadius: 6,
    background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
    cursor: 'pointer',
    touchAction: 'none',
    outline: 'none',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    margin: -HANDLE_SIZE / 2,
    borderRadius: '50%',
    border: '2px solid white',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.3)',
    pointerEvents: 'none',

    // keyboard focus on the area or strip shows on its handle
    '*:focus-visible > &': {
      boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.25), 0 0 0 4px ${theme.fn.rgba(theme.colors.blue[5], 0.5)}`,
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginTop: 12,
  },
  swatches: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  swatch: {
    width: 18,
    height: 18,
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    boxShadow: `inset 0 0 0 1px ${getPalette(theme).swatchEdge}`,
    cursor: 'pointer',
    transition: 'transform 0.1s',

    '&:hover': {
      transform: 'scale(1.12)',
    },
  },
}));

const toHex = (hsv: Rgb): string => rgbToHex(hsvToRgb(hsv));

interface Props {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

/**
 * Picks a color off a graph: saturation and brightness across a square, for the hue on the strip below it. Plain
 * elements following the pointer, Mantine's picker can't be dragged in this window.
 */
export const ColorGraph: FunctionComponent<Props> = ({ label, value, onChange }) => {
  const { classes, theme } = useStyles();
  const accent = theme.colors[useSectionColor()][6];
  const [hsv, setHsv] = useState<Rgb>(() => rgbToHsv(hexToRgb(value)));
  const [hexText, setHexText] = useState(value);
  const [hue, saturation, brightness] = hsv;

  // a color set from elsewhere, grays and black keep the hue they had: they have none of their own
  useEffect(() => {
    setHexText(value);
    if (isHexColor(value) && toHex(hsv) !== value.toLowerCase()) {
      const next = rgbToHsv(hexToRgb(value));
      setHsv(next[1] && next[2] ? next : [hsv[0], next[1], next[2]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (next: Rgb): void => {
    setHsv(next);
    onChange(toHex(next));
  };

  // the element keeps the pointer while it's dragged, wherever it goes
  const followPointer =
    (toColor: (x: number, y: number) => Rgb) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      const element = event.currentTarget;
      if (event.type === 'pointerdown') {
        if (event.button !== 0) {
          return;
        }
        element.setPointerCapture(event.pointerId);
        element.focus();
      } else if (!element.hasPointerCapture(event.pointerId)) {
        return;
      }
      const { left, top, width, height } = element.getBoundingClientRect();
      pick(toColor(clamp((event.clientX - left) / width, 0, 1), clamp((event.clientY - top) / height, 0, 1)));
    };

  const handleArea = followPointer((x, y) => [hue, x, 1 - y]);
  const handleHue = followPointer((x) => [Math.min(x, 0.999), saturation, brightness]);

  const handleAreaKeys = (event: KeyboardEvent): void => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      pick([hue, clamp(saturation + move[0], 0, 1), clamp(brightness + move[1], 0, 1)]);
    }
  };

  const handleHueKeys = (event: KeyboardEvent): void => {
    const move = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
    if (move) {
      event.preventDefault();
      pick([(hue + move + 1) % 1, saturation, brightness]);
    }
  };

  const applyHexText = (): void => {
    const text = hexText.startsWith('#') ? hexText : `#${hexText}`;
    if (isHexColor(text)) {
      onChange(text.toLowerCase());
    } else {
      setHexText(value);
    }
  };

  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} saturation and brightness`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(brightness * 100)}
        aria-valuetext={value}
        className={classes.area}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${
            hue * 360
          }, 100%, 50%))`,
        }}
        onPointerDown={handleArea}
        onPointerMove={handleArea}
        onKeyDown={handleAreaKeys}>
        <span
          className={classes.handle}
          style={{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%`, backgroundColor: value }}
        />
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue * 360)}
        className={classes.hue}
        onPointerDown={handleHue}
        onPointerMove={handleHue}
        onKeyDown={handleHueKeys}>
        <span
          className={classes.handle}
          style={{ left: `${hue * 100}%`, top: '50%', backgroundColor: `hsl(${hue * 360}, 100%, 50%)` }}
        />
      </div>

      <div className={classes.footer}>
        <div className={classes.swatches}>
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              title={swatch}
              aria-label={`${label} ${swatch}`}
              className={classes.swatch}
              style={{
                backgroundColor: swatch,
                ...(swatch === value.toLowerCase() && {
                  boxShadow: `0 0 0 2px ${getPalette(theme).card}, 0 0 0 3.5px ${accent}`,
                }),
              }}
              onClick={() => onChange(swatch)}
            />
          ))}
        </div>
        <TextInput
          size="xs"
          w={86}
          aria-label={`${label} hex code`}
          spellCheck={false}
          value={hexText}
          onChange={(event) => setHexText(event.currentTarget.value.trim())}
          onBlur={applyHexText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyHexText();
            }
          }}
          styles={{ input: { fontFamily: 'monospace' } }}
        />
      </div>
    </div>
  );
};
