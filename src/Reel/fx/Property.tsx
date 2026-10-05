import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, metalGradient } from "../theme";
import { EASE_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// Карточка объекта: фото (или схематичный дом), цена «металлом», район, параметры-чипы.
// Только реальные данные объекта — цену и метры не выдумываем.
export const Property: React.FC<FxProps<OverlayOf<"property">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inT = enter(f, 0, 14);
  const out = exit(f, total, 8);
  const w = Math.min(zone.w - 140, zone.h * 0.78, 820);
  const photoH = w * 0.56;
  const kb = interpolate(f, [0, total], [1.02, 1.12]);
  const priceT = interpolate(f, [0.5 * fps, 1.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  return (
    <Center style={{ opacity: out }}>
      <div style={{ width: w, borderRadius: 40, overflow: "hidden", background: p.panel, border: "1.5px solid rgba(255,255,255,0.1)", boxShadow: "0 50px 110px rgba(0,0,0,0.6)", opacity: inT, transform: `translateY(${(1 - inT) * 90}px) scale(${0.94 + 0.06 * inT})` }}>
        <div style={{ height: photoH, position: "relative", overflow: "hidden", background: `radial-gradient(circle at 70% 30%, ${p.metal[1]} 0%, ${p.bg} 80%)` }}>
          {o.image ? (
            <Img src={staticFile(o.image)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="apartment" size={photoH * 0.5} color={p.text} stroke={1.1} />
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55))" }} />
          {o.place ? (
            <div style={{ position: "absolute", left: 28, bottom: 24, display: "flex", alignItems: "center", gap: 10, fontFamily: FONT, fontWeight: 700, fontSize: 34, color: "#fff" }}>
              <Icon name="location" size={36} color={p.accent} stroke={2.2} />
              {o.place}
            </div>
          ) : null}
        </div>
        <div style={{ padding: "30px 36px 36px" }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 46, color: p.text, letterSpacing: -1 }}>{o.title}</div>
          {o.price ? (
            <div style={{ marginTop: 10, fontFamily: FONT, fontWeight: 900, fontSize: 92, letterSpacing: -3, lineHeight: 1.05, backgroundImage: metalGradient(p), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", opacity: priceT, transform: `translateY(${(1 - priceT) * 20}px)` }}>
              {o.price}
            </div>
          ) : null}
          {o.specs.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 22 }}>
              {o.specs.map((s, i) => {
                const t = pop(f, fps, 0.9 * fps + i * 5);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderRadius: 999, background: p.accentSoft, border: `1.5px solid ${p.accent}55`, transform: `scale(${t})`, opacity: Math.min(1, t * 1.4) }}>
                    <Icon name={s.icon} size={36} color={p.accent} stroke={2} />
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34, color: p.text }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </Center>
  );
};
