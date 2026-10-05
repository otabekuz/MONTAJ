import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { normWord } from "./Captions";
import { balance, fitFont } from "./fx/common";
import { Icon } from "./fx/icons";
import type { Box } from "./layout";
import { EASE_OUT, enter, exit, pop } from "./motion";
import { FONT, type Palette } from "./theme";

// Хук: крупная фраза в первые секунды, слова выпрыгивают по очереди, ключевые — акцентом.
export const Hook: React.FC<{
  text: string;
  total: number;
  zone: Box;
  layout: "full" | "split" | "voice";
  highlight: Set<string>;
  p: Palette;
}> = ({ text, total, zone, layout, highlight, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = balance(text, layout === "voice" ? 16 : 13);
  const size = fitFont(lines.join("\n"), zone.w - 120, layout === "voice" ? 120 : 138, 76, 0.58);
  const out = exit(f, total, 6);
  // full: хук над головой спикера; voice: сверху, под ним идёт графика; split: по центру верхней половины
  const top = layout === "full" ? 300 : layout === "voice" ? zone.y + 20 : zone.y + zone.h / 2;
  let wi = 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: zone.w,
        top,
        transform: layout === "split" ? "translateY(-50%)" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: out,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: "center", gap: size * 0.24 }}>
          {line.split(" ").map((w, i) => {
            const s = pop(f, fps, wi++ * 3, 300);
            const hl = highlight.has(normWord(w));
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: size,
                  lineHeight: 1.02,
                  letterSpacing: -size * 0.035,
                  color: hl ? p.accent : "#FFFFFF",
                  transform: `translateY(${(1 - s) * 50}px) scale(${0.7 + 0.3 * s})`,
                  opacity: Math.min(1, s * 1.6),
                  textShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Концовка с кодовым словом: плашка, слово ВЕРХНИМ РЕГИСТРОМ подсвечено акцентом.
export const Cta: React.FC<{ text: string; total: number; y: number; p: Palette }> = ({ text, total, y, p }) => {
  const f = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const s = pop(f, fps, 0, 200);
  const out = exit(f, total, 6);
  const scrim = interpolate(f, [0, 10], [0, 0.55], { extrapolateRight: "clamp", easing: EASE_OUT });
  const words = text.split(/\s+/);
  const size = fitFont(text, (width - 200) * 1.9, 76, 50, 0.55);
  const pulse = 1 + 0.04 * Math.sin((f / fps) * Math.PI * 2.2);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${scrim})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: width - 140,
            padding: "40px 54px",
            borderRadius: 44,
            background: "rgba(16,16,18,0.88)",
            border: `2px solid ${p.accent}`,
            boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 70px ${p.accentSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 34,
            transform: `translateY(${(1 - s) * 140}px) scale(${(0.85 + 0.15 * s) * (f > 20 ? pulse : 1)})`,
            opacity: enter(f, 0, 8),
          }}
        >
          <div style={{ flexShrink: 0, width: 110, height: 110, borderRadius: 32, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chat" size={64} color={p.onAccent} stroke={2.2} />
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.12, color: "#fff", letterSpacing: -1 }}>
            {words.map((w, i) => {
              const code = w.length > 1 && w === w.toUpperCase() && /\p{L}/u.test(w);
              return (
                <span key={i} style={{ color: code ? p.accent : "#fff", fontWeight: code ? 900 : 800 }}>
                  {w}
                  {i < words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
