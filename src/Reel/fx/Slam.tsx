import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, SERIF } from "../theme";
import { EASE_OUT, exit, pop } from "../motion";
import { type FxProps, fitFont } from "./common";

// Смена мира: весь кадр заливается акцентом, одно огромное слово. Один раз на ролик.
export const Slam: React.FC<FxProps<OverlayOf<"slam">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const fill = interpolate(f, [0, 5], [0, 1], { extrapolateRight: "clamp", easing: EASE_OUT });
  const s = pop(f, fps, 2, 380);
  const out = exit(f, total, 6);
  const word = o.text.toUpperCase();
  const size = fitFont(word, width - 80, 330, 150, 0.66);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        background: p.accent,
        clipPath: `circle(${fill * 120}% at 50% 50%)`,
        opacity: out,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.9,
          letterSpacing: -size * 0.045,
          color: p.onAccent,
          transform: `scale(${2.2 - 1.2 * s})`,
        }}
      >
        {word}
      </div>
      {o.em ? (
        <div
          style={{
            marginTop: 40,
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 64,
            color: p.onAccent,
            opacity: interpolate(f, [8, 18], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            maxWidth: width - 160,
            textAlign: "center",
          }}
        >
          {o.em}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${height * 0.12}px rgba(0,0,0,0.18)` }} />
    </div>
  );
};
