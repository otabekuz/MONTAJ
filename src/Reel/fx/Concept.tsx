import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// Иконки-понятия: 1 крупно или 2–3 в ряд, выпрыгивают по очереди.
export const Concept: React.FC<FxProps<OverlayOf<"icon">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = o.items.length;
  const box = n === 1 ? 300 : n === 2 ? 240 : 210;
  const out = exit(f, total, 7);
  return (
    <Center style={{ opacity: out }}>
      <div style={{ display: "flex", gap: n === 1 ? 0 : 50, alignItems: "flex-start" }}>
        {o.items.map((it, i) => {
          const s = pop(f, fps, i * 6);
          const float = Math.sin((f + i * 20) / 18) * 6;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: box + 40, opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 80 + float}px) scale(${0.6 + 0.4 * s})` }}>
              <div
                style={{
                  width: box,
                  height: box,
                  borderRadius: box * 0.3,
                  background: i === n - 1 && n > 1 ? p.accentSoft : "rgba(255,255,255,0.05)",
                  border: `2px solid ${i === n - 1 && n > 1 ? p.accent : "rgba(255,255,255,0.12)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
                }}
              >
                <Icon name={it.icon} size={box * 0.48} color={i === n - 1 || n === 1 ? p.accent : p.text} />
              </div>
              {it.label ? (
                <div style={{ marginTop: 26, fontFamily: FONT, fontWeight: 800, fontSize: n === 1 ? 64 : 48, color: p.text, textAlign: "center", letterSpacing: -1 }}>
                  {it.label}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Center>
  );
};
