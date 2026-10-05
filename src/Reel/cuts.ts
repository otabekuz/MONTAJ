import type { Caption } from "@remotion/captions";
import type { Segment } from "./schema";

// Сколько воздуха оставлять вокруг слов при вырезке пауз (секунды)
const PAD_BEFORE = 0.08;
const PAD_AFTER = 0.14;
// Паузы короче этого не режем — иначе речь звучит рвано
const MIN_GAP = 0.32;
// «Тишина перед главной мыслью» держится не дольше
const BEAT_MAX = 0.7;

/** Куски исходника, которые остаются после вырезки пауз. */
export const computeSegments = (
  captions: Caption[],
  durationSec: number,
  cutPauses: boolean,
  beats: number[],
): Segment[] => {
  if (!cutPauses || captions.length === 0) {
    return [{ from: 0, to: durationSec }];
  }
  const words = [...captions].sort((a, b) => a.startMs - b.startMs);
  const isBeat = (sec: number) => beats.some((b) => Math.abs(b - sec) < 0.3);

  const segs: Segment[] = [];
  let cur: Segment = {
    from: Math.max(0, words[0].startMs / 1000 - PAD_BEFORE),
    to: words[0].endMs / 1000 + PAD_AFTER,
  };
  if (cur.from < 0.4) cur.from = 0;

  for (let i = 1; i < words.length; i++) {
    const start = words[i].startMs / 1000;
    const end = words[i].endMs / 1000;
    const prevEnd = words[i - 1].endMs / 1000;
    const gap = start - prevEnd;
    if (gap <= MIN_GAP) {
      cur.to = Math.max(cur.to, end + PAD_AFTER);
      continue;
    }
    if (isBeat(start)) {
      // пауза остаётся, но не длиннее BEAT_MAX: обрезаем её середину
      const keep = Math.min(gap, BEAT_MAX);
      cur.to = prevEnd + keep / 2;
      segs.push(cur);
      cur = { from: start - keep / 2, to: end + PAD_AFTER };
      continue;
    }
    segs.push(cur);
    cur = { from: Math.max(cur.to, start - PAD_BEFORE), to: end + PAD_AFTER };
  }
  cur.to = Math.min(durationSec, cur.to + 0.3);
  segs.push(cur);
  return segs
    .map((s) => ({ from: Math.max(0, s.from), to: Math.min(durationSec, s.to) }))
    .filter((s) => s.to - s.from > 0.05);
};

export type Timeline = {
  fps: number;
  speed: number;
  segments: (Segment & { outFrom: number })[];
  /** длина ролика без концовки, секунды результата */
  bodySeconds: number;
  /** секунда исходника → кадр результата */
  toFrame: (sourceSec: number) => number;
  /** отрезок исходника → [кадр начала, длительность в кадрах] (минимум 1 кадр) */
  span: (at: number, dur: number) => { from: number; frames: number };
};

export const buildTimeline = (segments: Segment[], speed: number, fps: number): Timeline => {
  let acc = 0;
  const segs = segments.map((s) => {
    const out = { ...s, outFrom: acc };
    acc += (s.to - s.from) / speed;
    return out;
  });
  const toSec = (t: number) => {
    for (const s of segs) {
      if (t < s.from) return s.outFrom;
      if (t <= s.to) return s.outFrom + (t - s.from) / speed;
    }
    return acc;
  };
  const toFrame = (t: number) => Math.round(toSec(t) * fps);
  return {
    fps,
    speed,
    segments: segs,
    bodySeconds: acc,
    toFrame,
    span: (at, dur) => {
      const from = toFrame(at);
      const end = toFrame(at + dur);
      return { from, frames: Math.max(1, end - from) };
    },
  };
};
