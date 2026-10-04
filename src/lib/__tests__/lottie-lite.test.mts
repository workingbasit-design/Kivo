import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  easeBezier,
  evalProp,
  shapeToSvg,
  renderIcon,
  finalFrame,
  type LottieDocument,
} from '../../components/animated-icons/lottie-lite.ts';

describe('lottie-lite keyframes', () => {
  it('returns static values as-is', () => {
    assert.equal(evalProp({ a: 0, k: 42 }, 10), 42);
    assert.deepEqual(evalProp({ a: 0, k: [10, 20] }, 3), [10, 20]);
    assert.equal(evalProp(7, 0), 7);
  });

  it('clamps before the first keyframe and after the last', () => {
    const k = [
      { t: 5, s: [0], i: { x: [0.3], y: [1] }, o: { x: [0.3], y: [0] } },
      { t: 10, s: [100] },
    ];
    assert.deepEqual(evalProp({ a: 1, k }, 0), [0]);
    assert.deepEqual(evalProp({ a: 1, k }, 99), [100]);
  });

  it('interpolates between keyframes', () => {
    const k = [
      { t: 0, s: 0, i: { x: [0.3], y: [1] }, o: { x: [0.3], y: [0] } },
      { t: 10, s: 100 },
    ];
    const mid = evalProp({ a: 1, k }, 5);
    assert.ok(typeof mid === 'number' && mid > 0 && mid < 100, `mid=${mid}`);
    // endpoints exact
    assert.equal(evalProp({ a: 1, k }, 0), 0);
    assert.equal(evalProp({ a: 1, k }, 10), 100);
  });

  it('honours hold keyframes', () => {
    const k = [
      { t: 0, s: 5, h: 1, i: { x: [0.3], y: [1] }, o: { x: [0.3], y: [0] } },
      { t: 10, s: [100] },
    ];
    assert.equal(evalProp({ a: 1, k }, 7), 5);
  });

  it('easeBezier hits 0 and 1 at the ends', () => {
    assert.ok(Math.abs(easeBezier(0, 0.3, 1, 0.3, 0)) < 1e-6);
    assert.ok(Math.abs(easeBezier(1, 0.3, 1, 0.3, 0) - 1) < 1e-6);
  });
});

describe('lottie-lite shapes', () => {
  it('converts a square to an SVG path with a sane length', () => {
    const { d, length } = shapeToSvg({
      v: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      i: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      o: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      c: true,
    });
    assert.ok(d.startsWith('M0 0'), d);
    assert.ok(d.endsWith('Z'), d);
    assert.ok(Math.abs(length - 40) < 0.5, `length=${length}`);
  });
});

const FIXTURE = {
  w: 32,
  h: 32,
  fr: 30,
  ip: 0,
  op: 10,
  layers: [
    {
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [16, 16] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'sh',
              ks: {
                a: 0,
                k: {
                  v: [
                    [0, 0],
                    [10, 0],
                  ],
                  i: [
                    [0, 0],
                    [0, 0],
                  ],
                  o: [
                    [0, 0],
                    [0, 0],
                  ],
                  c: false,
                },
              },
            },
            {
              ty: 'st',
              mn: 'ADBE Vector Graphic - Stroke',
              c: { a: 0, k: [0, 0, 0, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 2 },
              lc: 2,
              lj: 2,
            },
            {
              ty: 'tr',
              mn: 'ADBE Vector Filter - Trim',
              s: {
                a: 1,
                k: [
                  { t: 0, s: [0], i: { x: [0.3], y: [1] }, o: { x: [0.3], y: [0] } },
                  { t: 10, s: [0] },
                ],
              },
              e: {
                a: 1,
                k: [
                  { t: 0, s: [0], i: { x: [0.3], y: [1] }, o: { x: [0.3], y: [0] } },
                  { t: 10, s: [100] },
                ],
              },
            },
            { ty: 'tr', mn: 'ADBE Vector Graphic - Transform' },
          ],
        },
      ],
    },
  ],
} as unknown as LottieDocument;

describe('lottie-lite renderIcon', () => {
  it('draws the trim progressively and maps black to currentColor', () => {
    const start = renderIcon(FIXTURE, 0);
    assert.equal(start.paths.length, 1);
    assert.equal(start.paths[0]?.stroke, 'currentColor');
    // frame 0: nothing drawn yet
    assert.ok(start.paths[0]?.dashArray?.startsWith('0 '), start.paths[0]?.dashArray);
    const end = renderIcon(FIXTURE, 10);
    // fully drawn: dash removed
    assert.equal(end.paths[0]?.dashArray, undefined);
  });

  it('finalFrame returns the last frame', () => {
    assert.ok(Math.abs(finalFrame(FIXTURE) - 10) < 0.01);
  });
});
