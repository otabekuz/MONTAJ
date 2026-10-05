import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// Процесс A → B → C: блоки появляются каждые 0,75 с, последний — результат (акцент).
export const Flow: React.FC<FxProps<OverlayOf<"flow">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = exit(f, total, 7);
  const n = o.nodes.length;
  const at = (i: number) => 0.15 * fps + i * 0.75 * fps;
  return (
    <Center style={{ opacity: out }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {o.nodes.map((node, i) => {
          const s = pop(f, fps, at(i));
          const last = i === n - 1;
          const arrow = enter(f, at(i) - 0.3 * fps, 10);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {i > 0 ? (
                <div style={{ width: 4, height: n > 3 ? 44 : 64, background: `linear-gradient(${p.muted}, ${last ? p.accent : p.muted})`, transformOrigin: "top", transform: `scaleY(${arrow})`, borderRadius: 2 }} />
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 26,
                  padding: n > 3 ? "20px 44px" : "26px 52px",
                  borderRadius: 999,
                  background: last ? p.accent : "rgba(255,255,255,0.06)",
                  border: `2px solid ${last ? p.accent : "rgba(255,255,255,0.14)"}`,
                  opacity: Math.min(1, s * 1.5),
                  transform: `scale(${0.7 + 0.3 * s})`,
                  boxShadow: last ? `0 0 60px ${p.accentSoft}` : "none",
                }}
              >
                {node.icon ? <Icon name={node.icon} size={n > 3 ? 50 : 60} color={last ? p.onAccent : p.accent} stroke={2} /> : null}
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: n > 3 ? 54 : 62, color: last ? p.onAccent : p.text, letterSpacing: -1 }}>{node.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Center>
  );
};
