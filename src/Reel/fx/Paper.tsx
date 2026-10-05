import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, enter, exit } from "../motion";
import { Center, type FxProps } from "./common";

// Светлый «бумажный» мир: бланк с пунктами, галочки и зачёркивания появляются по очереди.
export const Paper: React.FC<FxProps<OverlayOf<"paper">>> = ({ o, total, zone, p, local }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inT = enter(f, 0, 14);
  const out = exit(f, total, 8);
  const w = Math.min(zone.w - 140, 860);
  const itemAt = (i: number) => (o.times?.[i] !== undefined ? local(o.times[i]) : 0.5 * fps + i * 0.9 * fps);
  return (
    <Center style={{ opacity: out }}>
      <div
        style={{
          width: w,
          background: p.paper,
          borderRadius: 14,
          padding: "50px 56px 40px",
          boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
          transform: `translateY(${(1 - inT) * 160}px) rotate(${(1 - inT) * -4}deg)`,
          opacity: inT,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `3px solid ${p.paperInk}`, paddingBottom: 20, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: p.paperInk, letterSpacing: -1.5 }}>{o.tag}</div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 30, color: p.paperMuted }}>{o.title}</div>
        </div>
        {o.items.map((it, i) => {
          const t = enter(f, itemAt(i), 10);
          const m = interpolate(f, [itemAt(i) + 6, itemAt(i) + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, padding: "22px 0", borderBottom: `1.5px dashed ${p.paperMuted}55`, opacity: t }}>
              <div style={{ width: 54, height: 54, borderRadius: 10, border: `3px solid ${p.paperInk}`, position: "relative", flexShrink: 0 }}>
                {it.mark === "v" ? (
                  <svg viewBox="0 0 54 54" style={{ position: "absolute", inset: -3 }}>
                    <path d="M12 28 L23 39 L44 14" fill="none" stroke={p.paperInk} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={60} strokeDashoffset={60 * (1 - m)} />
                  </svg>
                ) : null}
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 56, color: it.mark === "x" ? p.paperMuted : p.paperInk, letterSpacing: -1 }}>{it.text}</div>
                {it.mark === "x" ? <div style={{ position: "absolute", left: -6, top: "50%", height: 6, width: `calc(${m * 100}% + 12px)`, background: p.bad, borderRadius: 3 }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Center>
  );
};
