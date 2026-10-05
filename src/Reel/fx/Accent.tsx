import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { exit, pop } from "../motion";
import { balance, Center, fitFont, type FxProps } from "./common";

// Ударная фраза: слово падает сверху, приземляется с ударом и пульсом акцентного кольца.
export const Accent: React.FC<FxProps<OverlayOf<"accent">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(f, fps, 0, 320);
  const out = exit(f, total, 7);
  const lines = balance(o.text.toUpperCase(), 11);
  const size = fitFont(lines.join("\n"), zone.w - 160, 170, 80, 0.72);
  const ring = Math.min(1, f / 14);
  return (
    <Center style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          border: `4px solid ${p.accent}`,
          opacity: (1 - ring) * 0.7,
          transform: `scale(${0.4 + ring * 1.3})`,
        }}
      />
      {o.emoji ? <div style={{ fontSize: 120, marginBottom: 10, transform: `scale(${s})` }}>{o.emoji}</div> : null}
      <div
        style={{
          transform: `translateY(${(1 - s) * -260}px) scale(${1.5 - 0.5 * s})`,
          textAlign: "center",
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: size,
              lineHeight: 0.98,
              letterSpacing: -size * 0.03,
              color: p.text,
              textShadow: "0 18px 50px rgba(0,0,0,0.5)",
            }}
          >
            {l}
          </div>
        ))}
        <div style={{ margin: "26px auto 0", width: 120 * s, height: 8, background: p.accent, borderRadius: 4 }} />
      </div>
    </Center>
  );
};
