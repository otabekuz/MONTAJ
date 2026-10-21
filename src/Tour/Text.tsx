import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { H, W } from "../Reel/layout";
import { EASE_IN, EASE_OUT } from "../Reel/motion";
import { FONT, type Palette } from "../Reel/theme";
import type { ResolvedClip, TourClip, TourProps, TourTag } from "./schema";
import type { SpeedMap } from "./timing";

// Текст в обзоре — тихий: тонкий шрифт, без плашек, не спорит с интерьером.
// Безопасные зоны Reels: сверху ~220 px, снизу ~360 px, справа ~140 px.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SHADOW = "0 2px 18px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)";

const appear = (t: number, dur: number, inLen = 0.55, outLen = 0.35) => {
  const i = interpolate(t, [0, inLen], [0, 1], { ...clamp, easing: EASE_OUT });
  const o = interpolate(t, [dur - outLen, dur], [1, 0], { ...clamp, easing: EASE_IN });
  return { i, o };
};

const Label: React.FC<{ text: string; sub?: string; t: number; dur: number; top: number; p: Palette }> = ({ text, sub, t, dur, top, p }) => {
  const { i, o } = appear(t, dur);
  return (
    <div style={{ position: "absolute", left: 72, top, right: 160, opacity: o, transform: `translateY(${(1 - i) * 18}px)` }}>
      <div style={{ width: 64 * i, height: 2, background: p.accent, marginBottom: 18, borderRadius: 2 }} />
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 300,
          fontSize: 60,
          lineHeight: 1.05,
          color: "#fff",
          letterSpacing: `${0.02 + (1 - i) * 0.12}em`,
          textShadow: SHADOW,
          clipPath: `inset(0 ${(1 - i) * 100}% 0 0)`,
        }}
      >
        {text}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 26,
            marginTop: 12,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            textShadow: SHADOW,
            opacity: interpolate(t, [0.2, 0.7], [0, 1], clamp),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

export const Tags: React.FC<{ tags: TourTag[]; clips: TourClip[]; maps: SpeedMap[]; resolved: ResolvedClip[]; p: Palette }> = ({ tags, maps, resolved, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = f / fps;
  return (
    <>
      {tags.map((tag, k) => {
        if (!maps[tag.clip]) return null;
        const start = resolved[tag.clip].start + maps[tag.clip].toLocal(tag.at);
        const t = o - start;
        if (t < 0 || t > tag.dur) return null;
        return <Label key={k} text={tag.text} sub={tag.sub} t={t} dur={tag.dur} top={tag.pos === "top" ? 250 : H - 560} p={p} />;
      })}
    </>
  );
};

export const Hook: React.FC<{ hook: NonNullable<TourProps["hook"]>; p: Palette }> = ({ hook, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  if (t > hook.dur) return null;
  const { i, o } = appear(t, hook.dur, 0.7, 0.4);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 760, opacity: o }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.42), transparent)" }} />
      <div style={{ position: "absolute", top: 330, left: 60, right: 60, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 300,
            fontSize: 84,
            lineHeight: 1.04,
            color: "#fff",
            letterSpacing: `${0.03 + (1 - i) * 0.25}em`,
            textShadow: SHADOW,
          }}
        >
          {hook.text}
        </div>
        {hook.sub ? (
          <div
            style={{
              marginTop: 22,
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 28,
              color: p.accent,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              textShadow: SHADOW,
              opacity: interpolate(t, [0.35, 0.9], [0, 1], clamp),
            }}
          >
            {hook.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const EndCard: React.FC<{ card: NonNullable<TourProps["endCard"]>; end: number; p: Palette }> = ({ card, end, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps - (end - card.dur);
  if (t < 0 || t > card.dur) return null;
  const { i, o } = appear(t, card.dur, 0.6, 0.3);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 980, background: `linear-gradient(0deg, rgba(0,0,0,${0.7 * i}) 50%, transparent)` }} />
      <div style={{ position: "absolute", left: 72, right: 160, bottom: 420, transform: `translateY(${(1 - i) * 24}px)` }}>
        <div style={{ width: 72 * i, height: 2, background: p.accent, marginBottom: 22, borderRadius: 2 }} />
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 64, lineHeight: 1.05, color: "#fff", textShadow: SHADOW }}>{card.title}</div>
        {card.lines.map((line, k) => (
          <div
            key={k}
            style={{
              fontFamily: FONT,
              fontWeight: 300,
              fontSize: 38,
              marginTop: 14,
              color: "rgba(255,255,255,0.92)",
              textShadow: SHADOW,
              opacity: interpolate(t, [0.25 + k * 0.15, 0.7 + k * 0.15], [0, 1], clamp),
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
