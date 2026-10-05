import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_IN, EASE_OUT, pop } from "../motion";
import type { FxProps } from "./common";
import { Icon } from "./icons";

// Метка-плашка сверху кадра (над головой, лицо не закрывает): 📍 улица, 🏢 тип дома, этажи.
// Выезжает сверху из размытия, текст печатается, по плашке пробегает блик. Спикер не размывается.
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Chip: React.FC<FxProps<OverlayOf<"chip">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const inT = interpolate(f, [0, 9], [0, 1], { ...clamp, easing: EASE_OUT });
  const outT = interpolate(f, [total - 6, total], [0, 1], { ...clamp, easing: EASE_IN });
  const ic = pop(f, fps, 3, 260);
  const shown = Math.floor(interpolate(f, [4, 4 + o.text.length * 1.1], [0, o.text.length], clamp));
  const shine = interpolate(f, [10, 30], [-30, 130], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width,
        top: (o.y ?? 0.13) * height,
        display: "flex",
        justifyContent: "center",
        opacity: inT * (1 - outT),
        transform: `translateY(${(1 - inT) * -50 - outT * 30}px)`,
        filter: inT < 1 || outT > 0 ? `blur(${(1 - inT) * 10 + outT * 10}px)` : undefined,
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "14px 34px 14px 14px",
          borderRadius: 999,
          background: "rgba(10,14,20,0.5)",
          backdropFilter: "blur(14px)",
          border: `1.5px solid ${p.accent}`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.35), 0 0 40px ${p.accentSoft}`,
        }}
      >
        <div style={{ width: 66, height: 66, borderRadius: 33, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${ic})` }}>
          <Icon name={o.icon} size={38} color={p.onAccent} stroke={2.3} />
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 42, color: "#fff", letterSpacing: -0.5, whiteSpace: "nowrap" }}>
          {o.text.slice(0, shown)}
          <span style={{ opacity: 0 }}>{o.text.slice(shown)}</span>
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${shine}%`, width: 90, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)", transform: "skewX(-20deg)" }} />
      </div>
    </div>
  );
};
