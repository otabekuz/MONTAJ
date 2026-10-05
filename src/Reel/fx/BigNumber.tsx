import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, metalGradient } from "../theme";
import { EASE_OUT, enter, exit } from "../motion";
import { Center, fitFont, formatNumber, type FxProps } from "./common";

// Крупная «металлическая» цифра со счётчиком — как «$17 M» на образце.
export const BigNumber: React.FC<FxProps<OverlayOf<"number">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const decimals = Number.isInteger(o.value) ? 0 : 1;
  const v = interpolate(f, [4, 4 + 1.2 * fps], [0, o.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const text = `${o.prefix ?? ""}${formatNumber(v, decimals)}${o.suffix ? ` ${o.suffix}` : ""}`;
  const finalText = `${o.prefix ?? ""}${formatNumber(o.value, decimals)}${o.suffix ? ` ${o.suffix}` : ""}`;
  const size = fitFont(finalText, zone.w - 100, 300, 120, 0.6);
  const inT = enter(f, 0, 14);
  const out = exit(f, total, 8);
  const sweep = interpolate(f, [1.2 * fps, 2.2 * fps], [-30, 130], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ position: "relative", transform: `scale(${0.85 + 0.15 * inT})` }}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 1,
            letterSpacing: -size * 0.04,
            backgroundImage: `linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,255,255,0.85) ${sweep}%, transparent ${sweep + 12}%), ${metalGradient(p)}`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.45))",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
      </div>
      {o.label ? (
        <div style={{ marginTop: 24, fontFamily: FONT, fontWeight: 700, fontSize: 52, color: p.text, opacity: enter(f, 0.6 * fps, 12), textAlign: "center", padding: "0 80px" }}>
          {o.label}
        </div>
      ) : null}
    </Center>
  );
};
