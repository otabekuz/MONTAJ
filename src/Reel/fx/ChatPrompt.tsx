import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { enter, exit } from "../motion";
import { Center, type FxProps, panelStyle } from "./common";
import { Icon } from "./icons";

// Окно чата: сообщение печатается (~34 знака/с), затем по строкам появляется ответ.
export const ChatPrompt: React.FC<FxProps<OverlayOf<"chat">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typeFrames = (o.prompt.length / 34) * fps;
  const shown = Math.floor(interpolate(f, [6, 6 + typeFrames], [0, o.prompt.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const answerStart = 6 + typeFrames + 1.3 * fps;
  const lines = o.answer ? o.answer.split("\n") : [];
  const inT = enter(f, 0, 12);
  const out = exit(f, total, 7);
  const width = Math.min(zone.w - 100, 940);
  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ ...panelStyle(p), width, padding: 40, transform: `translateY(${(1 - inT) * 60}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 34 }}>
          <Icon name="chat" size={40} color={p.accent} />
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 30, color: p.muted, letterSpacing: 2 }}>CHAT</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              maxWidth: "85%",
              background: p.accent,
              color: p.onAccent,
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.25,
              padding: "26px 34px",
              borderRadius: "34px 34px 8px 34px",
            }}
          >
            {o.prompt.slice(0, shown)}
            {shown < o.prompt.length ? <span style={{ opacity: Math.floor(f / 6) % 2 }}>|</span> : null}
          </div>
        </div>
        {lines.length > 0 && f > answerStart - 10 ? (
          <div
            style={{
              marginTop: 28,
              maxWidth: "88%",
              background: "rgba(255,255,255,0.06)",
              border: "1.5px solid rgba(255,255,255,0.08)",
              borderRadius: "34px 34px 34px 8px",
              padding: "26px 34px",
            }}
          >
            {lines.map((l, i) => {
              const t = enter(f, answerStart + i * 0.2 * fps, 10);
              return (
                <div key={i} style={{ fontFamily: FONT, fontSize: 40, lineHeight: 1.35, color: p.text, opacity: t, transform: `translateY(${(1 - t) * 14}px)` }}>
                  {l}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Center>
  );
};
