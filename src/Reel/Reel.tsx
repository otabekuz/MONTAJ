import { useMemo } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraAt, phraseStarts, shakeFrames } from "./camera";
import { buildPages, Captions, normWord } from "./Captions";
import { buildTimeline } from "./cuts";
import "./fonts";
import { ProgressBar } from "./fx/ProgressBar";
import { Cta, Hook } from "./HookCta";
import { type Box, H, SPLIT_TOP, W, zonesFor } from "./layout";
import { HEAVY, Overlays } from "./Overlays";
import type { ReelProps } from "./schema";
import { SoundLayer } from "./Sound";
import { Speaker, VoiceTrack } from "./Speaker";
import { Stage } from "./Stage";
import { getPalette } from "./theme";
import { gfxMotion, type TItem, TransitionsLayer } from "./Transitions";

const FULL: Box = { x: 0, y: 0, w: W, h: H };

export const Reel: React.FC<ReelProps> = (props) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = getPalette(props.palette);
  const lang = props.lang ?? "uz";
  const { layout } = props;
  const captions = useMemo(() => props.captions ?? [], [props.captions]);
  const tl = useMemo(
    () => buildTimeline(props.segments ?? [{ from: 0, to: props.fallbackSeconds }], props.speed, fps),
    [props.segments, props.fallbackSeconds, props.speed, fps],
  );
  const zones = zonesFor(layout);
  const highlight = useMemo(() => new Set(props.highlightWords.map(normWord)), [props.highlightWords]);
  const pages = useMemo(() => buildPages(captions, tl), [captions, tl]);
  const phrases = useMemo(() => phraseStarts(captions, tl), [captions, tl]);
  const shakes = useMemo(() => shakeFrames(props.overlays, tl), [props.overlays, tl]);

  const hookFrames = Math.max(1, tl.toFrame(props.hookSeconds));
  const ctaFrames = props.cta ? Math.round(props.ctaSeconds * fps) : 0;
  const ctaFrom = props.cta ? durationInFrames - ctaFrames : null;

  const titems: TItem[] = props.transitions.map((t) => ({ frame: tl.toFrame(t.at), type: t.type }));
  const motion = gfxMotion(f, titems);
  const gfxStyle: React.CSSProperties = {
    transform: motion.x ? `translateX(${motion.x}px)` : undefined,
    filter: motion.blur > 0.5 ? `blur(${motion.blur}px)` : undefined,
  };

  // full: пока на экране «тяжёлая» графика, спикер уходит в размытие и затемнение
  let heavy = 0;
  if (layout === "full") {
    for (const o of props.overlays) {
      if (!HEAVY.has(o.type)) continue;
      const { from, frames } = tl.span(o.at, o.dur);
      const k = interpolate(f, [from - 2, from + 6, from + frames - 6, from + frames + 2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      heavy = Math.max(heavy, k);
    }
  }

  const cam =
    layout === "voice"
      ? { scale: 1, x: 0, y: 0 }
      : cameraAt(f, { autoFraming: props.autoFraming, phrases, zooms: props.zooms, shakes, tl });

  // во время slam весь кадр залит акцентом — субтитры там не читаются, слово-удар говорит само
  const slamWindows = props.overlays
    .filter((o) => o.type === "slam")
    .map((o) => tl.span(o.at, o.dur))
    .map(({ from, frames }) => [from, from + frames] as const);

  const beatWindows: [number, number][] = props.beats.map((b) => {
    const end = tl.toFrame(b);
    return [end - Math.round((0.7 * fps) / props.speed), end];
  });

  return (
    <AbsoluteFill style={{ background: p.bg, overflow: "hidden" }}>
      {layout === "voice" ? <Stage zone={FULL} p={p} /> : null}
      {layout === "split" ? <Stage zone={{ x: 0, y: 0, w: W, h: SPLIT_TOP }} p={p} /> : null}
      {layout !== "voice" && zones.speaker ? (
        <Speaker file={props.videoFile} hasVideo={!!props.hasVideo} tl={tl} box={zones.speaker} layout={layout} p={p} blur={heavy * 22} cam={cam} />
      ) : null}
      {layout === "split" ? (
        <div style={{ position: "absolute", left: 0, top: SPLIT_TOP, width: W, height: 180, background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)" }} />
      ) : null}
      {layout === "full" ? (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,${0.25 + heavy * 0.3}) 0%, rgba(0,0,0,${heavy * 0.35}) 50%, rgba(0,0,0,0.35) 100%)` }} />
      ) : null}

      <Overlays overlays={props.overlays} tl={tl} zone={zones.gfx} layout={layout} lang={lang} p={p} gfxStyle={gfxStyle} />
      <TransitionsLayer items={titems} zone={layout === "split" ? { x: 0, y: 0, w: W, h: SPLIT_TOP } : FULL} p={p} />

      <Sequence durationInFrames={hookFrames} layout="none" name="hook">
        <Hook text={props.hook} total={hookFrames} zone={zones.gfx} layout={layout} highlight={highlight} p={p} />
      </Sequence>

      <Captions
        pages={pages}
        highlight={highlight}
        p={p}
        y={zones.captionY}
        hidden={(fr) => fr < hookFrames || (ctaFrom !== null && fr >= ctaFrom) || slamWindows.some(([a, b]) => fr >= a && fr < b)}
      />

      {ctaFrom !== null ? (
        <Sequence from={ctaFrom} durationInFrames={ctaFrames} layout="none" name="cta">
          <Cta text={props.cta} total={ctaFrames} y={layout === "split" ? SPLIT_TOP / 2 : 960} p={p} />
        </Sequence>
      ) : null}

      <ProgressBar p={p} />

      {layout === "voice" && props.hasVideo ? <VoiceTrack file={props.videoFile} tl={tl} /> : null}
      <SoundLayer
        overlays={props.overlays}
        transitions={titems}
        cues={props.cues}
        tl={tl}
        sfx={props.sfx}
        musicFile={props.musicFile}
        beatWindows={beatWindows}
        ctaFrom={ctaFrom}
      />
    </AbsoluteFill>
  );
};
