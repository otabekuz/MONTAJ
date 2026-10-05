import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, metalGradient, type Palette } from "../theme";
import { EASE_IN_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// Объект-герой роликов о продаже: объявление о квартире.
// clones — три одинаковых «типовых» объявления; morph — типовое превращается в премиальное.

const Bar: React.FC<{ w: string; h: number; c: string }> = ({ w, h, c }) => (
  <div style={{ width: w, height: h, borderRadius: h / 2, background: c }} />
);

/** Типовое объявление: серое фото, серые строки, ничего не цепляет */
const PlainCard: React.FC<{ w: number }> = ({ w }) => (
  <div style={{ width: w, background: "#E9E9EC", borderRadius: w * 0.05, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.45)" }}>
    <div style={{ height: w * 0.72, background: "linear-gradient(160deg, #B9BCC4, #8F939C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="apartment" size={w * 0.3} color="#E9E9EC" stroke={1.4} />
    </div>
    <div style={{ padding: w * 0.07, display: "flex", flexDirection: "column", gap: w * 0.045 }}>
      <Bar w="80%" h={w * 0.055} c="#9FA3AB" />
      <Bar w="55%" h={w * 0.045} c="#C2C5CB" />
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: w * 0.09, color: "#7D818A" }}>$ ??? ???</div>
    </div>
  </div>
);

/** Премиальное объявление: свет, акцент, «металлическая» цена, параметры */
const PremiumCard: React.FC<{ w: number; p: Palette; label: string }> = ({ w, p, label }) => (
  <div style={{ width: w, background: p.panel, border: `2px solid ${p.accent}`, borderRadius: w * 0.05, overflow: "hidden", boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 60px ${p.accentSoft}` }}>
    <div style={{ height: w * 0.72, position: "relative", background: `radial-gradient(circle at 75% 25%, ${p.metal[0]} 0%, ${p.accent} 18%, ${p.bg} 75%)`, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
      <Icon name="apartment" size={w * 0.42} color={p.text} stroke={1.2} />
      <div style={{ position: "absolute", top: w * 0.05, left: w * 0.05, background: p.accent, color: p.onAccent, fontFamily: FONT, fontWeight: 800, fontSize: w * 0.045, padding: `${w * 0.015}px ${w * 0.035}px`, borderRadius: 999, letterSpacing: 2, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
    <div style={{ padding: w * 0.07, display: "flex", flexDirection: "column", gap: w * 0.04 }}>
      <Bar w="78%" h={w * 0.05} c="rgba(255,255,255,0.85)" />
      <div style={{ display: "flex", gap: w * 0.04 }}>
        {(["rooms", "area", "view"] as const).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: w * 0.015, padding: `${w * 0.015}px ${w * 0.03}px`, borderRadius: 999, background: p.accentSoft }}>
            <Icon name={k} size={w * 0.06} color={p.accent} stroke={2} />
            <Bar w={`${w * 0.08}px`} h={w * 0.025} c={p.accent} />
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: w * 0.11, backgroundImage: metalGradient(p), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>$ ███ ███</div>
    </div>
  </div>
);

export const Clones: React.FC<FxProps<OverlayOf<"clones">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const w = Math.min(300, (zone.w - 120) / 3 - 20);
  return (
    <Center style={{ opacity: out }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {[0, 1, 2].map((i) => {
          const s = pop(f, fps, i * 4);
          const mark = o.marks?.[i] ?? 0.25 + i * 0.2;
          const lt = enter(f, mark * total, 10);
          const jitter = Math.sin((f + i * 13) / 9) * 3;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 120 + jitter}px) rotate(${(i - 1) * 2}deg)` }}>
              <PlainCard w={w} />
              {o.labels[i] ? (
                <div style={{ marginTop: 24, fontFamily: FONT, fontWeight: 800, fontSize: 36, color: p.text, opacity: lt, transform: `translateY(${(1 - lt) * 16}px)`, textAlign: "center", maxWidth: w + 20 }}>
                  {o.labels[i]}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Center>
  );
};

export const Morph: React.FC<FxProps<OverlayOf<"morph">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const inT = enter(f, 0, 12);
  const out = exit(f, total, 8);
  const w = Math.min(600, zone.h * 0.56);
  // сканер проходит в середине элемента
  const scan = interpolate(f, [total * 0.32, total * 0.62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT });
  const cardH = w * 1.28;
  const labelT = enter(f, total * 0.62, 12);
  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, letterSpacing: 3, textTransform: "uppercase", color: scan < 0.5 ? p.muted : p.accent, marginBottom: 26, height: 50 }}>
        {scan < 0.5 ? o.before : o.after}
      </div>
      <div style={{ position: "relative", width: w, height: cardH, transform: `scale(${0.92 + 0.08 * inT + 0.04 * labelT})` }}>
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(${scan * 100}% 0 0 0)` }}>
          <PlainCard w={w} />
        </div>
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)` }}>
          <PremiumCard w={w} p={p} label={o.after} />
        </div>
        {scan > 0 && scan < 1 ? (
          <div style={{ position: "absolute", left: -40, right: -40, top: `${scan * 100}%`, height: 6, background: p.accent, boxShadow: `0 0 40px 10px ${p.accent}`, borderRadius: 3 }} />
        ) : null}
      </div>
    </Center>
  );
};
