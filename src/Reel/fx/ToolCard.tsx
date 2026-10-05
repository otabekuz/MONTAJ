import { useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { exit, pop } from "../motion";
import { Center, type FxProps, panelStyle } from "./common";
import { Icon } from "./icons";

// Карточка сервиса: иконка в круге + название, выпрыгивает пружиной.
export const ToolCard: React.FC<FxProps<OverlayOf<"tool">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(f, fps);
  const out = exit(f, total, 7);
  const shine = ((f - 8) / 24) * 140 - 20;
  return (
    <Center style={{ opacity: out }}>
      <div
        style={{
          ...panelStyle(p),
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 40,
          padding: "44px 64px 44px 44px",
          transform: `translateY(${(1 - s) * 120}px) scale(${0.8 + 0.2 * s})`,
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 40,
            background: p.accentSoft,
            border: `2px solid ${p.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={o.icon} size={86} color={p.accent} />
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 92, color: p.text, letterSpacing: -2 }}>
          {o.name}
        </div>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${shine}%`,
            width: 120,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
            transform: "skewX(-20deg)",
          }}
        />
      </div>
    </Center>
  );
};
