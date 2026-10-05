import { Easing, interpolate, spring } from "remotion";

// Единые кривые движения: всё в ролике двигается «одним почерком».
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 за `len` кадров начиная с `start` (мягкий выход) */
export const enter = (frame: number, start = 0, len = 12) =>
  interpolate(frame, [start, start + len], [0, 1], { ...clamp, easing: EASE_OUT });

/** 1→0 в последние `len` кадров элемента длиной `total` */
export const exit = (frame: number, total: number, len = 8) =>
  interpolate(frame, [total - len, total], [1, 0], { ...clamp, easing: EASE_IN });

/** Пружина «поп» с задержкой */
export const pop = (frame: number, fps: number, delay = 0, stiffness = 220) =>
  spring({ frame: frame - delay, fps, config: { damping: 16, stiffness, mass: 0.7 } });

export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

/** Появление + исчезновение элемента: прозрачность и лёгкий подъём */
export const inOut = (frame: number, total: number, inLen = 12, outLen = 8) => {
  const i = enter(frame, 0, inLen);
  const o = exit(frame, total, outLen);
  return { opacity: Math.min(i, o), y: (1 - i) * 40 + (1 - o) * -20, scale: 0.94 + 0.06 * i };
};
