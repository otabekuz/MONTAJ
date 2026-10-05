import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, metalGradient, type Palette } from "../theme";
import { EASE_IN, EASE_OUT } from "../motion";

// Уровень 1 системы layered: огромное слово «за спиной» (как «years old», «built» на образце).
// Рисуется МЕЖДУ видео и вырезанным человеком, поэтому человек закрывает середину слова.
// Буквы проявляются слева направо из размытия, слово медленно «дышит», уходит в размытие.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const fill = (p: Palette, color: OverlayOf<"giant">["color"]) => {
  if (color === "white") return "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(255,255,255,0.82))";
  if (color === "accent") return `linear-gradient(100deg, ${p.metal[0]} 0%, ${p.accent} 45%, ${p.metal[2]} 100%)`;
  return metalGradient(p);
};

export const Giant: React.FC<{ o: OverlayOf<"giant">; total: number; p: Palette }> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const letters = [...o.text];
  // ширина буквы: прописные и курсив шире строчных
  const upper = letters.filter((c) => c !== c.toLowerCase()).length / Math.max(1, letters.length);
  const k = 0.56 + upper * 0.16 + (o.italic ? 0.03 : 0);
  const size = Math.min(360, (width * 0.9) / Math.max(2, letters.length * k));
  const cy = (o.y ?? 0.3) * height;
  const outT = interpolate(f, [total - 7, total], [0, 1], { ...clamp, easing: EASE_IN });
  const breathe = interpolate(f, [0, total], [1, 1.05]);
  const sweep = interpolate(f, [6, Math.max(7, total - 4)], [-40, 140], clamp);
  const bg = fill(p, o.color);
  const preT = interpolate(f, [2, 10], [0, 1], { ...clamp, easing: EASE_OUT });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width,
        top: cy,
        transform: `translateY(-50%) scale(${breathe})`,
        display: "flex",
        justifyContent: "center",
        opacity: 1 - outT,
        filter: outT > 0 ? `blur(${outT * 18}px)` : undefined,
      }}
    >
      {/* мягкое затемнение позади слова: фон темнее, человек (он выше слоем) — нет, отсюда глубина */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: width * 1.1,
          height: size * 1.6,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.18) 45%, transparent 72%)",
          opacity: interpolate(f, [0, 8], [0, 1], clamp),
        }}
      />
      <div style={{ position: "relative", display: "flex", letterSpacing: -size * 0.055 }}>
        {o.pre ? (
          <div
            style={{
              position: "absolute",
              left: size * 0.04,
              top: -size * 0.32,
              fontFamily: FONT,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: Math.max(46, size * 0.3),
              color: "#fff",
              letterSpacing: 0,
              opacity: preT,
              filter: `blur(${(1 - preT) * 8}px)`,
              textShadow: "0 3px 14px rgba(0,0,0,0.6), 0 0 3px rgba(0,0,0,0.4)",
              whiteSpace: "nowrap",
            }}
          >
            {o.pre}
          </div>
        ) : null}
        {letters.map((ch, i) => {
          const t = interpolate(f, [i * 1.6, i * 1.6 + 9], [0, 1], { ...clamp, easing: EASE_OUT });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: FONT,
                fontWeight: 900,
                fontStyle: o.italic ? "italic" : "normal",
                fontSize: size,
                lineHeight: 1,
                whiteSpace: "pre",
                backgroundImage: `linear-gradient(100deg, transparent ${sweep - 10}%, rgba(255,255,255,0.55) ${sweep}%, transparent ${sweep + 10}%), ${bg}`,
                backgroundSize: `${letters.length * 100}% 100%`,
                backgroundPosition: `${(i / Math.max(1, letters.length - 1)) * 100}% 0`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                opacity: t,
                filter: `blur(${(1 - t) * 12}px) drop-shadow(0 10px 30px rgba(0,0,0,0.4))`,
                transform: `translateY(${(1 - t) * size * 0.12}px)`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};
