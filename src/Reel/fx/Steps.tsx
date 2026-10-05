import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { enter, exit } from "../motion";
import { Center, type FxProps } from "./common";

// Шаги 01-02-03: пункты появляются каждые 0,85 с.
export const Steps: React.FC<FxProps<OverlayOf<"steps">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const n = o.items.length;
  const size = n > 3 ? 58 : 66;
  return (
    <Center style={{ opacity: out, alignItems: "stretch", padding: `0 ${Math.max(90, (zone.w - 860) / 2)}px` }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 76, color: p.text, letterSpacing: -2, marginBottom: 40, opacity: enter(f, 0, 10) }}>
        {o.title}
      </div>
      {o.items.map((it, i) => {
        const t = enter(f, 0.4 * fps + i * 0.85 * fps, 12);
        const active = f >= 0.4 * fps + i * 0.85 * fps && (i === n - 1 || f < 0.4 * fps + (i + 1) * 0.85 * fps);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 34,
              padding: "24px 0",
              borderTop: `1.5px solid rgba(255,255,255,${i === 0 ? 0.14 : 0.08})`,
              opacity: t,
              transform: `translateX(${(1 - t) * 80}px)`,
            }}
          >
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size * 0.7, color: p.accent, width: 70, fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, color: active ? p.text : "rgba(255,255,255,0.78)", letterSpacing: -1 }}>
              {it}
            </div>
          </div>
        );
      })}
    </Center>
  );
};
