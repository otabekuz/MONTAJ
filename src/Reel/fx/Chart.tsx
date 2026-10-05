import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, enter, exit } from "../motion";
import { Center, formatNumber, type FxProps } from "./common";

// Столбики растут по очереди; главный — акцентный. Только реальные цифры из речи.
export const Chart: React.FC<FxProps<OverlayOf<"chart">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const max = Math.max(...o.bars.map((b) => b.value), 1);
  const H = Math.min(zone.h - 330, 560);
  const n = o.bars.length;
  const bw = Math.min(190, (zone.w - 200) / n - 40);
  return (
    <Center style={{ opacity: out }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: p.text, marginBottom: 12, letterSpacing: -1.5, opacity: enter(f, 0, 10) }}>{o.title}</div>
      {o.unit ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 30, color: p.muted, marginBottom: 30 }}>{o.unit}</div> : null}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 40, height: H + 70, borderBottom: "2px solid rgba(255,255,255,0.18)" }}>
        {o.bars.map((b, i) => {
          const t = interpolate(f, [8 + i * 6, 8 + i * 6 + 0.9 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
          const h = (b.value / max) * H * t;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: b.highlight ? p.accent : p.text, opacity: t, fontVariantNumeric: "tabular-nums" }}>
                {formatNumber(b.value * t, Number.isInteger(b.value) ? 0 : 1)}
              </div>
              <div style={{ width: bw, height: h, borderRadius: "18px 18px 0 0", background: b.highlight ? `linear-gradient(180deg, ${p.accent}, ${p.accentSoft})` : "rgba(255,255,255,0.14)", boxShadow: b.highlight ? `0 0 50px ${p.accentSoft}` : "none" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 18 }}>
        {o.bars.map((b, i) => (
          <div key={i} style={{ width: bw, textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 32, color: b.highlight ? p.text : p.muted }}>{b.label}</div>
        ))}
      </div>
    </Center>
  );
};
