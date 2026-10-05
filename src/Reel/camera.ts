import type { Caption } from "@remotion/captions";
import { interpolate } from "remotion";
import type { Timeline } from "./cuts";
import { EASE_IN_OUT, EASE_OUT } from "./motion";
import type { Overlay, Zoom } from "./schema";

// Камера спикера: смена плана на каждой фразе (общий ↔ крупный), явные наезды, тряска на ударах.

export type Cam = { scale: number; x: number; y: number };

/** Кадры результата, с которых начинаются фразы */
export const phraseStarts = (captions: Caption[], tl: Timeline): number[] => {
  const starts: number[] = [];
  captions.forEach((c, i) => {
    const prev = captions[i - 1];
    if (!prev || c.startMs - prev.endMs > 280 || /[.!?…]$/.test(prev.text.trim())) {
      starts.push(tl.toFrame(c.startMs / 1000));
    }
  });
  return starts;
};

const CLOSE = 1.14;

export const cameraAt = (
  frame: number,
  opts: {
    autoFraming: boolean;
    phrases: number[];
    zooms: Zoom[];
    shakes: number[];
    tl: Timeline;
  },
): Cam => {
  let scale = 1;
  let y = 0;
  if (opts.autoFraming && opts.phrases.length) {
    // какой по счёту фразе принадлежит кадр → чётные общий план, нечётные крупный
    let idx = 0;
    for (let i = 0; i < opts.phrases.length; i++) if (frame >= opts.phrases[i]) idx = i;
    const start = opts.phrases[idx];
    const target = idx % 2 === 1 ? CLOSE : 1;
    const prev = idx % 2 === 1 ? 1 : CLOSE;
    const t = idx === 0 ? 1 : interpolate(frame, [start, start + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
    scale = prev + (target - prev) * t;
    // в крупном плане чуть поднимаем точку фокуса к лицу
    y = (scale - 1) * 260;
  }
  for (const z of opts.zooms) {
    const { from, frames } = opts.tl.span(z.at, z.dur);
    if (frame < from || frame > from + frames) continue;
    const ramp = Math.max(3, Math.round(frames * 0.3));
    const k = interpolate(frame, [from, from + ramp, from + frames - ramp, from + frames], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_IN_OUT,
    });
    scale *= 1 + (z.scale - 1) * k;
  }
  let x = 0;
  for (const s of opts.shakes) {
    const d = frame - s;
    if (d < 0 || d > 10) continue;
    const amp = (1 - d / 10) * 14;
    x += Math.sin(d * 2.7) * amp;
    y += Math.cos(d * 3.3) * amp * 0.6;
  }
  return { scale, x, y };
};

/** Кадры, на которых трясём камеру: удары accent и slam */
export const shakeFrames = (overlays: Overlay[], tl: Timeline) =>
  overlays.filter((o) => o.type === "accent" || o.type === "slam").map((o) => tl.toFrame(o.at) + 3);
