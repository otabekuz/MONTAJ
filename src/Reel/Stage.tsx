import { useCurrentFrame } from "remotion";
import type { Box } from "./layout";
import type { Palette } from "./theme";

// Живой фон графики: тёмный мир с сеткой, которая медленно плывёт, и мягким светом акцента.
export const Stage: React.FC<{ zone: Box; p: Palette }> = ({ zone, p }) => {
  const f = useCurrentFrame();
  const cell = 90;
  const off = (f * 0.35) % cell;
  const gx = 50 + Math.sin(f / 140) * 22;
  const gy = 40 + Math.cos(f / 170) * 16;
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, overflow: "hidden", background: p.bg }}>
      <div
        style={{
          position: "absolute",
          inset: -cell,
          backgroundImage: `linear-gradient(${p.line} 1.5px, transparent 1.5px), linear-gradient(90deg, ${p.line} 1.5px, transparent 1.5px)`,
          backgroundSize: `${cell}px ${cell}px`,
          transform: `translate(${off}px, ${off * 0.5}px)`,
          maskImage: "radial-gradient(ellipse at 50% 45%, black 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 25%, transparent 75%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${gx}% ${gy}%, ${p.accentSoft} 0%, transparent 45%)` }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 220px rgba(0,0,0,0.7)" }} />
    </div>
  );
};
