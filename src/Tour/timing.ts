import type { ResolvedClip, TourClip, TourTransition } from "./schema";

// Время в формате Tour. У каждого клипа своя кривая скорости v(t) по секундам исходника:
// база × участки ramps × разгон к whip/push-склейкам. Длина клипа в ролике = ∫ dt / v(t).

export const DEFAULT_DUR: Record<TourTransition["type"], number> = {
  cut: 0,
  dissolve: 0.4,
  whip: 0.3,
  push: 0.36,
  wall: 0.4,
  inset: 0.9,
};

/** скорость в самой склейке whip/push (кадр «смазывается», как от резкого поворота) */
const EDGE_SPEED = 3;
/** сколько секунд исходника занимает разгон/торможение у склейки */
const EDGE_LEN = 0.5;
const STEPS_PER_SEC = 240;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export const transitionDur = (t: TourTransition | undefined) => (t ? (t.dur ?? DEFAULT_DUR[t.type]) : 0);

const ramps = (t: TourTransition | undefined) => !!t && (t.type === "whip" || t.type === "push") && t.ramp !== false;

/** скорость клипа в секунду исходника t (без подгонки под бит) */
export const speedCurve = (clip: TourClip, enter: TourTransition | undefined) => {
  const base = clip.speed ?? 1;
  const rampIn = ramps(enter);
  const rampOut = ramps(clip.exit);
  const list = clip.ramps ?? [];
  return (t: number) => {
    let v = base;
    for (const r of list) {
      // края участка — плавные (до 0,3 с), без рывка скорости
      const e = Math.min(0.3, r.dur / 3);
      const w = smooth((t - r.at) / e) * smooth((r.at + r.dur - t) / e);
      v = v * (1 - w) + r.speed * w;
    }
    if (rampOut) {
      const w = smooth((t - (clip.out - EDGE_LEN)) / EDGE_LEN);
      v = v * (1 - w) + Math.max(v, EDGE_SPEED) * w;
    }
    if (rampIn) {
      const w = smooth((clip.in + EDGE_LEN - t) / EDGE_LEN);
      v = v * (1 - w) + Math.max(v, EDGE_SPEED) * w;
    }
    return v;
  };
};

export type SpeedMap = {
  /** длина в ролике, с */
  dur: number;
  /** секунда исходника для секунды клипа o (o < 0 и o > dur — «ручки» за краями, для переходов) */
  srcAt: (o: number) => number;
  /** скорость (секунд исходника в секунду ролика) */
  speedAt: (o: number) => number;
  /** секунда клипа, когда показывается секунда исходника t */
  toLocal: (t: number) => number;
};

export const buildSpeedMap = (clip: TourClip, enter: TourTransition | undefined, scale = 1): SpeedMap => {
  const v = speedCurve(clip, enter);
  const a = clip.in;
  const b = Math.max(clip.out, a + 0.1);
  const n = Math.max(2, Math.ceil((b - a) * STEPS_PER_SEC));
  const dt = (b - a) / n;
  // cum[k] — секунда ролика, когда показывается секунда исходника a + k·dt
  const cum = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) {
    const mid = a + (k + 0.5) * dt;
    cum[k + 1] = cum[k] + dt / (v(mid) * scale);
  }
  const dur = cum[n];
  const va = v(a) * scale;
  const vb = v(b) * scale;
  const srcAt = (o: number) => {
    if (o <= 0) return a + o * va;
    if (o >= dur) return b + (o - dur) * vb;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= o) lo = mid;
      else hi = mid;
    }
    const k = (o - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return a + (lo + k) * dt;
  };
  const speedAt = (o: number) => {
    if (o <= 0) return va;
    if (o >= dur) return vb;
    return v(srcAt(o)) * scale;
  };
  const toLocal = (t: number) => {
    if (t <= a) return (t - a) / va;
    if (t >= b) return dur + (t - b) / vb;
    const x = (t - a) / dt;
    const k = Math.floor(x);
    return cum[k] + (x - k) * (cum[Math.min(n, k + 1)] - cum[k]);
  };
  return { dur, srcAt, speedAt, toLocal };
};

/** переход, которым клип i начинается (выход предыдущего; у первого — выход последнего при loop) */
export const enterOf = (clips: TourClip[], i: number, loop: boolean) =>
  i > 0 ? clips[i - 1].exit : loop ? clips[clips.length - 1].exit : undefined;

/** сетка ударов в секундах ролика */
export const beatGrid = (opts: { bpm?: number; beatOffset?: number; musicStart?: number; beats?: number[]; until: number }) => {
  const start = opts.musicStart ?? 0;
  if (opts.beats?.length) return opts.beats.map((b) => b - start).filter((b) => b > 0 && b < opts.until);
  if (!opts.bpm) return [];
  const period = 60 / opts.bpm;
  const out: number[] = [];
  let t = (opts.beatOffset ?? 0) - start;
  while (t > period) t -= period;
  for (; t < opts.until; t += period) if (t > 0) out.push(t);
  return out;
};

/**
 * Раскладка клипов по ролику. С beatSync каждая склейка ставится на ближайший удар (каждый beatEvery-й),
 * если для этого базовую скорость клипа хватает изменить в пределах 0.8–1.25×.
 */
export const layoutClips = (
  clips: TourClip[],
  loop: boolean,
  beats: number[],
  beatEvery: number,
  files: { fileDur: number; fps: number; stackDur?: number }[],
): ResolvedClip[] => {
  const natural = clips.map((c, i) => buildSpeedMap(c, enterOf(clips, i, loop), 1).dur);
  const grid = beats.filter((_, i) => i % beatEvery === 0);
  const out: ResolvedClip[] = [];
  let t = 0;
  clips.forEach((_, i) => {
    let scale = 1;
    const isLast = i === clips.length - 1;
    // последний клип без петли не подгоняем — он просто заканчивается
    if (grid.length && (!isLast || loop)) {
      const want = t + natural[i];
      let best: number | null = null;
      for (const g of grid) {
        const s = natural[i] / (g - t);
        if (g <= t || s < 0.8 || s > 1.25) continue;
        if (best === null || Math.abs(g - want) < Math.abs(best - want)) best = g;
      }
      if (best !== null) scale = natural[i] / (best - t);
    }
    const dur = natural[i] / scale;
    out.push({ start: t, dur, scale, ...files[i] });
    t += dur;
  });
  return out;
};
