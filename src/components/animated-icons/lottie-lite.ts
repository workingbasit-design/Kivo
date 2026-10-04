/**
 * lottie-lite — a dependency-free renderer for the simple stroke-based Lottie
 * icons in ./icons (MIT-licensed; see LICENSES.md).
 *
 * Supported subset: cubic-bezier shapes (static or keyframed), strokes,
 * group + layer transforms (position / rotation / scale / opacity, static or
 * keyframed) and trim-path start/end animation. Anything else in the Lottie
 * spec is ignored. This keeps the $0 / zero-dependency promise: no
 * lottie-react, no lottie-web.
 */

export interface LottieDocument {
  w: number;
  h: number;
  fr: number;
  ip: number;
  op: number;
  layers: unknown[];
}

/* ------------------------------------------------------------------ */
/* keyframes                                                           */
/* ------------------------------------------------------------------ */

type Scalar = number | number[];

interface Keyframe {
  t: number;
  s: Scalar;
  e?: Scalar;
  h?: number;
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

interface AnimProp {
  a: 0 | 1;
  k: Scalar | Keyframe[];
}

function isAnimProp(v: unknown): v is AnimProp {
  return (
    typeof v === 'object' &&
    v !== null &&
    'a' in v &&
    'k' in v &&
    ((v as AnimProp).a === 0 || (v as AnimProp).a === 1)
  );
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function lerpScalar(a: Scalar, b: Scalar, p: number): Scalar {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, p);
  const aa = Array.isArray(a) ? a : [a];
  const bb = Array.isArray(b) ? b : [b];
  return aa.map((v, i) => lerp(v, bb[i] ?? v, p));
}

function cubic(t: number, p1: number, p2: number): number {
  // cubic bezier with p0=0, p3=1
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

function cubicD(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/** Solve the easing curve x(t)=p for t, then return y(t). */
export function easeBezier(p: number, x1: number, y1: number, x2: number, y2: number): number {
  let t = p;
  for (let n = 0; n < 8; n++) {
    const x = cubic(t, x1, x2) - p;
    if (Math.abs(x) < 1e-4) break;
    const dx = cubicD(t, x1, x2);
    if (Math.abs(dx) < 1e-6) break;
    t -= x / dx;
  }
  return cubic(t, y1, y2);
}

function easedProgress(kf: Keyframe, p: number): number {
  const pick = (v: unknown): number | undefined =>
    Array.isArray(v) ? (v[0] as number) : typeof v === 'number' ? v : undefined;
  const x1 = pick(kf.o?.x) ?? p;
  const y1 = pick(kf.o?.y) ?? p;
  const x2 = pick(kf.i?.x) ?? p;
  const y2 = pick(kf.i?.y) ?? p;
  // Degenerate control points collapse to linear.
  if (x1 === p && x2 === p) return p;
  return easeBezier(p, x1, y1, x2, y2);
}

function keyframeValue(kfs: Keyframe[], frame: number): Scalar {
  if (kfs.length === 0) return 0;
  const first = kfs[0] as Keyframe;
  if (frame <= first.t) return first.s;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i] as Keyframe;
    const b = kfs[i + 1] as Keyframe;
    if (frame < b.t) {
      if (a.h === 1) return a.s;
      const end = a.e !== undefined ? a.e : b.s;
      const span = b.t - a.t;
      const p = span <= 0 ? 1 : (frame - a.t) / span;
      return lerpScalar(a.s, end, easedProgress(a, Math.min(1, Math.max(0, p))));
    }
  }
  const last = kfs[kfs.length - 1] as Keyframe;
  if (last.h === 1) return last.s;
  return last.e !== undefined ? last.e : last.s;
}

/** Evaluate a Lottie property at a frame. Non-animated props return as-is. */
export function evalProp(prop: unknown, frame: number): Scalar {
  if (!isAnimProp(prop)) {
    if (typeof prop === 'number') return prop;
    if (Array.isArray(prop)) return prop as number[];
    return 0;
  }
  if (prop.a === 0) return prop.k as Scalar;
  return keyframeValue(prop.k as Keyframe[], frame);
}

function num(v: Scalar): number {
  return typeof v === 'number' ? v : (v[0] ?? 0);
}

function pair(v: Scalar): [number, number] {
  if (typeof v === 'number') return [v, v];
  return [v[0] ?? 0, v[1] ?? 0];
}

/* ------------------------------------------------------------------ */
/* shapes -> SVG                                                       */
/* ------------------------------------------------------------------ */

interface BezShape {
  v: [number, number][];
  i: [number, number][];
  o: [number, number][];
  c: boolean;
}

function isBezShape(v: unknown): v is BezShape {
  const o = asRecord(v);
  return Array.isArray(o.v) && Array.isArray(o.i) && Array.isArray(o.o);
}

function lerpPt(a: [number, number], b: [number, number], p: number): [number, number] {
  return [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
}

function lerpShape(a: BezShape, b: BezShape, p: number): BezShape {
  const n = Math.max(a.v.length, b.v.length);
  const vv: [number, number][] = [];
  const ii: [number, number][] = [];
  const oo: [number, number][] = [];
  for (let j = 0; j < n; j++) {
    vv.push(lerpPt(a.v[j] ?? [0, 0], b.v[j] ?? [0, 0], p));
    ii.push(lerpPt(a.i[j] ?? [0, 0], b.i[j] ?? [0, 0], p));
    oo.push(lerpPt(a.o[j] ?? [0, 0], b.o[j] ?? [0, 0], p));
  }
  return { v: vv, i: ii, o: oo, c: a.c };
}

/** Shape keyframes hold the shape object inside s: [shape]. */
function shapeKeyValue(kfs: Keyframe[], frame: number): BezShape | null {
  const val = (kf: Keyframe): BezShape | null => {
    const s = kf.s;
    const cand = Array.isArray(s) ? s[0] : s;
    return isBezShape(cand) ? cand : null;
  };
  if (kfs.length === 0) return null;
  const first = kfs[0] as Keyframe;
  if (frame <= first.t) return val(first);
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i] as Keyframe;
    const b = kfs[i + 1] as Keyframe;
    if (frame < b.t) {
      const sa = val(a);
      if (!sa || a.h === 1) return sa;
      const sb = val(b);
      if (!sb) return sa;
      const span = b.t - a.t;
      const p = span <= 0 ? 1 : (frame - a.t) / span;
      return lerpShape(sa, sb, easedProgress(a, Math.min(1, Math.max(0, p))));
    }
  }
  return val(kfs[kfs.length - 1] as Keyframe);
}

/** Evaluate a shape's ks at a frame — static or keyframed geometry. */
function evalShape(ks: unknown, frame: number): BezShape | null {
  const o = asRecord(ks);
  if (o.a === 1 && Array.isArray(o.k)) {
    return shapeKeyValue(o.k as Keyframe[], frame);
  }
  const k = o.k;
  const cand = Array.isArray(k) ? k[0] : k;
  return isBezShape(cand) ? cand : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function cubicSegLen(
  p0: [number, number],
  c1: [number, number],
  c2: [number, number],
  p1: [number, number],
): number {
  let len = 0;
  let px = p0[0];
  let py = p0[1];
  const N = 16;
  for (let s = 1; s <= N; s++) {
    const t = s / N;
    const u = 1 - t;
    const x =
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
    const y =
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

export function shapeToSvg(shape: BezShape): { d: string; length: number } {
  const n = shape.v.length;
  if (n === 0) return { d: '', length: 0 };
  const start = shape.v[0] as [number, number];
  let d = `M${r2(start[0])} ${r2(start[1])}`;
  let length = 0;
  const segs = shape.c ? n : n - 1;
  for (let j = 0; j < segs; j++) {
    const p0 = shape.v[j] as [number, number];
    const p1 = shape.v[(j + 1) % n] as [number, number];
    const o = shape.o[j] as [number, number];
    const ii = shape.i[(j + 1) % n] as [number, number];
    const c1: [number, number] = [p0[0] + o[0], p0[1] + o[1]];
    const c2: [number, number] = [p1[0] + ii[0], p1[1] + ii[1]];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p1[0])} ${r2(p1[1])}`;
    length += cubicSegLen(p0, c1, c2, p1);
  }
  if (shape.c) d += 'Z';
  return { d, length };
}

/* ------------------------------------------------------------------ */
/* render model                                                        */
/* ------------------------------------------------------------------ */

export interface RenderedPath {
  d: string;
  length: number;
  stroke: string;
  strokeWidth: number;
  linecap: 'butt' | 'round' | 'square';
  linejoin: 'miter' | 'round' | 'bevel';
  opacity: number;
  transform: string;
  dashArray?: string;
  dashOffset?: string;
}

export interface RenderedIcon {
  width: number;
  height: number;
  paths: RenderedPath[];
}

interface WalkCtx {
  transform: string;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  linecap: RenderedPath['linecap'];
  linejoin: RenderedPath['linejoin'];
  strokeOpacity: number;
  trim: { s: number; e: number } | null;
  color: string;
}

const CAPS = { 1: 'butt', 2: 'round', 3: 'square' } as const;
const JOINS = { 1: 'miter', 2: 'round', 3: 'bevel' } as const;

function strokeColor(c: unknown, fallback: string): string {
  // Lottie stroke color is { a: 0, k: [r, g, b, a] }.
  const v = evalProp(c, 0);
  const arr = Array.isArray(v) ? v : [v];
  const [rr, gg, bb, aa] = [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 1];
  const near = (x: number, t: number) => Math.abs(x - t) < 0.02;
  if (near(rr, 0) && near(gg, 0) && near(bb, 0)) return fallback;
  if (near(rr, 1) && near(gg, 1) && near(bb, 1)) return '#ffffff';
  return `rgba(${Math.round(rr * 255)},${Math.round(gg * 255)},${Math.round(bb * 255)},${aa})`;
}

function transformString(tr: unknown, frame: number): { t: string; opacity: number } {
  const o = (tr ?? {}) as Record<string, unknown>;
  const p = pair(evalProp(o.p, frame));
  const a = pair(evalProp(o.a, frame));
  const s = pair(evalProp(o.s, frame));
  const rot = num(evalProp(o.r, frame));
  const op = num(evalProp(o.o, frame));
  const parts: string[] = [];
  if (p[0] !== 0 || p[1] !== 0) parts.push(`translate(${r2(p[0])} ${r2(p[1])})`);
  if (rot !== 0) parts.push(`rotate(${r2(rot)})`);
  if (s[0] !== 100 || s[1] !== 100) parts.push(`scale(${r2(s[0] / 100)} ${r2(s[1] / 100)})`);
  if (a[0] !== 0 || a[1] !== 0) parts.push(`translate(${r2(-a[0])} ${r2(-a[1])})`);
  return { t: parts.join(' '), opacity: op / 100 };
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

function walkItems(items: unknown[], ctx: WalkCtx, frame: number, out: RenderedPath[]): void {
  // First pass: collect style (stroke + trim apply to the whole group).
  let stroke = ctx.stroke;
  let strokeWidth = ctx.strokeWidth;
  let linecap = ctx.linecap;
  let linejoin = ctx.linejoin;
  let strokeOpacity = ctx.strokeOpacity;
  let trim = ctx.trim;
  for (const raw of items) {
    const it = asRecord(raw);
    const mn = typeof it.mn === 'string' ? it.mn : '';
    if (mn.includes('Stroke')) {
      stroke = strokeColor(it.c, ctx.color);
      strokeWidth = num(evalProp(it.w, frame));
      const lc = num(evalProp(it.lc, frame));
      const lj = num(evalProp(it.lj, frame));
      linecap = CAPS[lc as keyof typeof CAPS] ?? linecap;
      linejoin = JOINS[lj as keyof typeof JOINS] ?? linejoin;
      strokeOpacity = num(evalProp(it.o, frame)) / 100;
    } else if (mn.includes('Trim')) {
      trim = { s: num(evalProp(it.s, frame)), e: num(evalProp(it.e, frame)) };
    }
  }
  const child: WalkCtx = { ...ctx, stroke, strokeWidth, linecap, linejoin, strokeOpacity, trim };
  for (const raw of items) {
    const it = asRecord(raw);
    const ty = it.ty;
    if (ty === 'gr') {
      const sub = Array.isArray(it.it) ? (it.it as unknown[]) : [];
      const trRaw = sub[sub.length - 1];
      const trMn = asRecord(trRaw).mn;
      const hasTr = typeof trMn === 'string' && trMn.includes('Transform');
      const body = hasTr ? sub.slice(0, -1) : sub;
      const { t: tt, opacity: to } = transformString(hasTr ? asRecord(trRaw) : {}, frame);
      walkItems(
        body,
        {
          ...child,
          transform: child.transform ? `${child.transform} ${tt}` : tt,
          opacity: child.opacity * to,
          // trim filters inherit into nested groups (a nested trim would override via the first pass)
        },
        frame,
        out,
      );
    } else if (ty === 'sh') {
      const shape = evalShape(it.ks, frame);
      if (!shape || shape.v.length === 0 || shape.i.length === 0 || shape.o.length === 0) continue;
      const { d, length } = shapeToSvg(shape);
      if (!d) continue;
      const p: RenderedPath = {
        d,
        length,
        stroke: child.stroke,
        strokeWidth: child.strokeWidth,
        linecap: child.linecap,
        linejoin: child.linejoin,
        opacity: Math.max(0, Math.min(1, child.opacity * child.strokeOpacity)),
        transform: child.transform,
      };
      if (child.trim && length > 0) {
        const s = Math.min(100, Math.max(0, child.trim.s)) / 100;
        const e = Math.min(100, Math.max(0, child.trim.e)) / 100;
        const vis = Math.max(0, e - s) * length;
        // Fully drawn → no dash needed (avoids sub-pixel seams).
        if (vis < length - 0.5) {
          p.dashArray = `${r2(vis)} ${r2(length)}`;
          p.dashOffset = `${r2(-s * length)}`;
        }
      }
      out.push(p);
    }
    // 'mm' (merge) and anything else: ignored — strokes render identically unmerged.
  }
}

/**
 * Render one frame of the icon as a list of SVG paths.
 * @param color replaces the icon's black strokes (defaults to currentColor).
 */
export function renderIcon(doc: LottieDocument, frame: number, color = 'currentColor'): RenderedIcon {
  const out: RenderedPath[] = [];
  const layers = Array.isArray(doc.layers) ? doc.layers : [];
  for (const raw of layers) {
    const layer = asRecord(raw);
    if (layer.hd === true) continue;
    const { t: lt, opacity: lo } = transformString(layer.ks, frame);
    const shapes = Array.isArray(layer.shapes) ? (layer.shapes as unknown[]) : [];
    walkItems(
      shapes,
      {
        transform: lt,
        opacity: lo,
        stroke: color,
        strokeWidth: 2,
        linecap: 'round',
        linejoin: 'round',
        strokeOpacity: 1,
        trim: null,
        color,
      },
      frame,
      out,
    );
  }
  return { width: doc.w || 32, height: doc.h || 32, paths: out };
}

/** Final frame of the icon (used for reduced-motion and SSR). */
export function finalFrame(doc: LottieDocument): number {
  return Math.max(doc.ip, doc.op - 0.001);
}
