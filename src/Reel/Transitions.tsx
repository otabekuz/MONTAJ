import { interpolate, random, useCurrentFrame } from "remotion";
import type { Box } from "./layout";
import type { Transition } from "./schema";
import type { Palette } from "./theme";

// Переходы между смысловыми блоками. Окно перехода: 6 кадров до момента и 8 после.
const BEFORE = 6;
const AFTER = 8;

export type TItem = { frame: number; type: Transition["type"] };

/** Сдвиг и размытие слоя графики во время перехода (whip, smear, glitch) */
export const gfxMotion = (f: number, items: TItem[]) => {
  let x = 0;
  let blur = 0;
  for (const t of items) {
    const d = f - t.frame;
    if (d < -BEFORE || d > AFTER) continue;
    const k = 1 - Math.abs(d) / (d < 0 ? BEFORE : AFTER);
    if (t.type === "whip") {
      x += (d < 0 ? -1 : 1) * -220 * k;
      blur += 26 * k;
    } else if (t.type === "smear") {
      blur += 16 * k;
      x += (d < 0 ? -1 : 1) * -60 * k;
    } else if (t.type === "glitch") {
      x += (random(`g${f}`) - 0.5) * 50 * k;
    }
  }
  return { x, blur };
};

export const TransitionsLayer: React.FC<{ items: TItem[]; zone: Box; p: Palette }> = ({ items, zone, p }) => {
  const f = useCurrentFrame();
  const active = items.filter((t) => f - t.frame >= -BEFORE && f - t.frame <= AFTER);
  if (!active.length) return null;
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, overflow: "hidden", pointerEvents: "none" }}>
      {active.map((t, i) => {
        const d = f - t.frame;
        const k = 1 - Math.abs(d) / (d < 0 ? BEFORE : AFTER);
        if (t.type === "flash") {
          return <div key={i} style={{ position: "absolute", inset: 0, background: "#fff", opacity: Math.pow(k, 1.6) * 0.95 }} />;
        }
        if (t.type === "leak") {
          // засветка: тёплое пятно света проплывает через кадр (окно перехода шире — ±14 кадров)
          const pos = interpolate(d, [-BEFORE, AFTER], [-30, 130]);
          return (
            <div key={i} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: k * 0.85 }}>
              <div style={{ position: "absolute", top: "-20%", left: `${pos - 40}%`, width: "80%", height: "140%", background: `radial-gradient(ellipse at center, rgba(255,214,160,0.75) 0%, ${p.accentSoft} 35%, transparent 70%)`, transform: "rotate(18deg)", filter: "blur(30px)" }} />
              <div style={{ position: "absolute", top: 0, left: `${pos}%`, width: "18%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", filter: "blur(18px)" }} />
            </div>
          );
        }
        if (t.type === "wipe") {
          const pos = interpolate(d, [-BEFORE, AFTER], [-110, 110]);
          return (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, width: "120%", left: `${pos}%`, background: `linear-gradient(90deg, transparent 0%, ${p.accent} 12%, ${p.bg} 30%, ${p.bg} 80%, transparent 100%)` }} />
          );
        }
        if (t.type === "smear") {
          // полосы света пролетают через кадр
          return (
            <div key={i} style={{ position: "absolute", inset: 0 }}>
              {Array.from({ length: 7 }).map((_, j) => {
                const yy = random(`s${t.frame}-${j}`) * 100;
                const hh = 6 + random(`h${t.frame}-${j}`) * 40;
                const xx = interpolate(d, [-BEFORE, AFTER], [-80, 140]) + (random(`x${t.frame}-${j}`) - 0.5) * 60;
                return (
                  <div key={j} style={{ position: "absolute", top: `${yy}%`, left: `${xx}%`, width: "70%", height: hh, borderRadius: hh, background: j % 3 === 0 ? p.accent : "#fff", opacity: k * 0.55, filter: "blur(12px)" }} />
                );
              })}
            </div>
          );
        }
        if (t.type === "glitch") {
          return (
            <div key={i} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
              {Array.from({ length: 8 }).map((_, j) => {
                const yy = random(`gy${f}-${j}`) * 100;
                return (
                  <div key={j} style={{ position: "absolute", left: (random(`gx${f}-${j}`) - 0.5) * 120, right: 0, top: `${yy}%`, height: 10 + random(`gh${f}-${j}`) * 50, background: j % 2 ? "rgba(255,0,80,0.45)" : "rgba(0,220,255,0.45)", opacity: k }} />
                );
              })}
            </div>
          );
        }
        // whip — только сдвиг слоя + лёгкая вспышка-полоса
        return <div key={i} style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)", opacity: k }} />;
      })}
    </div>
  );
};
