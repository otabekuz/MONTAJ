import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// Схематичная карта: улицы прорисовываются, падает метка, расходится круг, подпись района.
// Карта условная, не настоящая — реальный адрес показываем только подписью.
const STREETS: [number, number, number, number][] = [
  [0, 0.28, 1, 0.22], [0, 0.62, 1, 0.7], [0.18, 0, 0.26, 1], [0.7, 0, 0.62, 1],
  [0, 0.9, 0.55, 0.45], [0.45, 0, 1, 0.48], [0.38, 1, 1, 0.84],
];

export const Location: React.FC<FxProps<OverlayOf<"location">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 8);
  const inT = enter(f, 0, 12);
  const size = Math.min(zone.w - 160, zone.h - 330, 760);
  const draw = interpolate(f, [0, 0.8 * fps], [0, 1], { extrapolateRight: "clamp", easing: EASE_OUT });
  const pin = pop(f, fps, 0.55 * fps, 260);
  const ring = ((f - 0.75 * fps) % (1.2 * fps)) / (1.2 * fps);
  const label = enter(f, 0.8 * fps, 12);
  return (
    <Center style={{ opacity: Math.min(out, inT) }}>
      <div style={{ position: "relative", width: size, height: size, borderRadius: 48, overflow: "hidden", background: p.panel, border: "1.5px solid rgba(255,255,255,0.1)", boxShadow: "0 50px 100px rgba(0,0,0,0.55)" }}>
        <svg viewBox="0 0 1 1" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
          <rect x={0.48} y={0.02} width={0.3} height={0.2} rx={0.02} fill={p.accentSoft} opacity={draw * 0.6} />
          <rect x={0.04} y={0.7} width={0.24} height={0.26} rx={0.02} fill="rgba(255,255,255,0.05)" opacity={draw} />
          {STREETS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * draw} y2={y1 + (y2 - y1) * draw} stroke={i < 4 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.13)"} strokeWidth={i < 4 ? 0.022 : 0.01} strokeLinecap="round" />
          ))}
        </svg>
        {f > 0.75 * fps ? (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 300, marginLeft: -150, marginTop: -150, borderRadius: "50%", border: `4px solid ${p.accent}`, opacity: 1 - ring, transform: `scale(${0.15 + ring})` }} />
        ) : null}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -92%) translateY(${(1 - pin) * -400}px)`, filter: `drop-shadow(0 18px 24px rgba(0,0,0,0.55))` }}>
          <Icon name="location" size={150} color={p.accent} stroke={2.2} />
        </div>
      </div>
      <div style={{ marginTop: 34, textAlign: "center", opacity: label, transform: `translateY(${(1 - label) * 20}px)` }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 70, color: p.text, letterSpacing: -1.5 }}>{o.place}</div>
        {o.sub ? <div style={{ marginTop: 6, fontFamily: FONT, fontWeight: 600, fontSize: 36, color: p.accent }}>{o.sub}</div> : null}
      </div>
    </Center>
  );
};
