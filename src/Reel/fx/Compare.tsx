import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, enter, exit } from "../motion";
import { Center, type FxProps, panelStyle } from "./common";
import { Icon } from "./icons";

// Было / стало: «плохая» карточка сразу, перечёркивается через 0,5 с; «хорошая» — через 1 с.
export const Compare: React.FC<FxProps<OverlayOf<"compare">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const badIn = enter(f, 0, 12);
  const strike = interpolate(f, [0.5 * fps, 0.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const goodIn = enter(f, fps, 14);
  const w = Math.min(zone.w - 120, 900);
  const card = (label: string, text: string, good: boolean, t: number) => (
    <div
      style={{
        ...panelStyle(p),
        width: w,
        padding: "30px 40px",
        opacity: t,
        transform: `translateY(${(1 - t) * 50}px)`,
        border: good ? `2px solid ${p.accent}` : panelStyle(p).border,
        background: good ? `linear-gradient(180deg, ${p.accentSoft}, ${p.bg})` : panelStyle(p).background,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <Icon name={good ? "right" : "wrong"} size={40} color={good ? p.accent : p.bad} stroke={2.2} />
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: good ? p.accent : p.bad }}>{label}</div>
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ fontFamily: FONT, fontWeight: good ? 800 : 600, fontSize: zone.h < 1000 ? 46 : 52, lineHeight: 1.2, color: good ? p.text : "rgba(255,255,255,0.6)" }}>{text}</div>
        {!good ? (
          <div style={{ position: "absolute", left: 0, top: "52%", height: 5, width: `${strike * 100}%`, background: p.bad, borderRadius: 3 }} />
        ) : null}
      </div>
    </div>
  );
  return (
    <Center style={{ opacity: out, gap: 30 }}>
      {card(o.badLabel, o.bad, false, badIn)}
      {card(o.goodLabel, o.good, true, goodIn)}
    </Center>
  );
};
