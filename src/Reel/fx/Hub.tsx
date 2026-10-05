import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";

// Ядро + модули: модули подключаются по очереди, по линиям бежит свет.
export const Hub: React.FC<FxProps<OverlayOf<"hub">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const n = o.items.length;
  const R = Math.min(zone.w, zone.h) * 0.3;
  const size = R * 2 + 300;
  const c = size / 2;
  // модули по кругу: 2 — слева/справа, 3 — треугольником, 4 — крестом
  const angle = (i: number) => (n === 2 ? Math.PI : -Math.PI / 2) + (2 * Math.PI * i) / n;
  const pos = (i: number) => ({ x: c + Math.cos(angle(i)) * R, y: c + Math.sin(angle(i)) * R });
  const at = (i: number) => 0.6 * fps + i * 0.6 * fps;
  const coreS = pop(f, fps, 0);
  return (
    <Center style={{ opacity: out }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
          {o.items.map((_, i) => {
            const t = enter(f, at(i) - 6, 10);
            const q = pos(i);
            const x2 = c + (q.x - c) * t;
            const y2 = c + (q.y - c) * t;
            const run = ((f - at(i)) % 30) / 30;
            const lx = c + (q.x - c) * run;
            const ly = c + (q.y - c) * run;
            return (
              <g key={i}>
                <line x1={c} y1={c} x2={x2} y2={y2} stroke="rgba(255,255,255,0.22)" strokeWidth={3} />
                {f > at(i) ? <circle cx={lx} cy={ly} r={9} fill={p.accent} style={{ filter: `drop-shadow(0 0 12px ${p.accent})` }} /> : null}
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: c, top: c, transform: `translate(-50%, -50%) scale(${coreS})`, width: 250, height: 250, borderRadius: "50%", background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 80px ${p.accentSoft}`, fontFamily: FONT, fontWeight: 900, fontSize: o.center.length > 7 ? 44 : 56, color: p.onAccent, textAlign: "center", padding: 20 }}>
          {o.center}
        </div>
        {o.items.map((it, i) => {
          const s = pop(f, fps, at(i));
          const q = pos(i);
          return (
            <div key={i} style={{ position: "absolute", left: q.x, top: q.y, transform: `translate(-50%, -50%) scale(${s})`, padding: "22px 34px", borderRadius: 28, background: p.panel, border: "2px solid rgba(255,255,255,0.16)", fontFamily: FONT, fontWeight: 800, fontSize: 42, color: p.text, whiteSpace: "nowrap", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
              {it}
            </div>
          );
        })}
      </div>
    </Center>
  );
};
