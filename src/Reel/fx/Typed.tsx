import { useCurrentFrame } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, SERIF } from "../theme";
import { enter, exit } from "../motion";
import { Center, fitFont, type FxProps } from "./common";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

// Фраза набирается по словам со свечением; слова из `em` — курсив с засечками акцентным цветом.
export const Typed: React.FC<FxProps<OverlayOf<"typed">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const words = o.text.split(/\s+/);
  const em = new Set(o.em.split(/\s+/).map(norm).filter(Boolean));
  const step = Math.max(3, Math.min(7, Math.floor((total * 0.45) / words.length)));
  const size = fitFont(o.text, (zone.w - 140) * 1.9, 112, 70, 0.55);
  const out = exit(f, total, 7);
  return (
    <Center style={{ opacity: out, padding: "0 70px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.28, rowGap: size * 0.12 }}>
        {words.map((w, i) => {
          const t = enter(f, i * step, 9);
          const isEm = em.has(norm(w));
          const glow = Math.max(0, 1 - (f - i * step) / 14);
          return (
            <span
              key={i}
              style={{
                fontFamily: isEm ? SERIF : FONT,
                fontStyle: isEm ? "italic" : "normal",
                fontWeight: isEm ? 700 : 800,
                fontSize: isEm ? size * 1.12 : size,
                lineHeight: 1.05,
                letterSpacing: isEm ? 0 : -size * 0.025,
                color: isEm ? p.accent : p.text,
                opacity: t,
                filter: `blur(${(1 - t) * 10}px)`,
                transform: `translateY(${(1 - t) * 24}px)`,
                textShadow: `0 0 ${30 * glow}px ${isEm ? p.accent : "rgba(255,255,255,0.9)"}`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 30,
          width: 4,
          height: size * 0.9,
          background: p.accent,
          opacity: Math.floor(f / 8) % 2 === 0 ? 1 : 0,
          display: f < words.length * step + 10 ? "block" : "none",
        }}
      />
    </Center>
  );
};
