import { Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Timeline } from "./cuts";
import type { Box } from "./layout";
import type { Palette } from "./theme";

/** Куски исходника, разложенные по ролику: вырезка пауз + ускорение */
export const useSegmentFrames = (tl: Timeline) =>
  tl.segments.map((s) => {
    const from = Math.round(s.outFrom * tl.fps);
    const end = Math.round((s.outFrom + (s.to - s.from) / tl.speed) * tl.fps);
    return { from, frames: Math.max(1, end - from), trim: Math.round(s.from * tl.fps) };
  });

// Спикер. В split берём кадр выше, чтобы над головой оставался воздух для субтитров.
export const Speaker: React.FC<{
  file: string;
  hasVideo: boolean;
  tl: Timeline;
  box: Box;
  layout: "full" | "split";
  p: Palette;
  blur: number;
  cam: { scale: number; x: number; y: number };
  /** вырезанный человек (прозрачное видео) — рисуется поверх `middle` */
  subjectFile?: string;
  /** слой между видео и человеком: слова-гиганты «за спиной» */
  middle?: React.ReactNode;
  /** лёгкая цветокоррекция */
  grade?: boolean;
}> = ({ file, hasVideo, tl, box, layout, p, blur, cam, subjectFile, middle, grade }) => {
  const segs = useSegmentFrames(tl);
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: layout === "split" ? "50% 25%" : "50% 50%",
  };
  const camStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
    transformOrigin: "50% 35%",
    filter:
      [blur > 0 ? `blur(${blur}px) brightness(${1 - blur / 60})` : "", grade ? "contrast(1.08) saturate(1.12) brightness(1.02)" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", background: "#000" }}>
      <div style={camStyle}>
        {hasVideo ? (
          segs.map((s, i) => (
            <Sequence key={i} from={s.from} durationInFrames={s.frames} layout="none">
              <OffthreadVideo src={staticFile(file)} trimBefore={s.trim} playbackRate={tl.speed} style={style} />
            </Sequence>
          ))
        ) : (
          <Placeholder p={p} />
        )}
      </div>
      {middle}
      {hasVideo && subjectFile && middle ? (
        <div style={camStyle}>
          {segs.map((s, i) => (
            <Sequence key={i} from={s.from} durationInFrames={s.frames} layout="none">
              <OffthreadVideo src={staticFile(subjectFile)} transparent muted trimBefore={s.trim} playbackRate={tl.speed} style={style} />
            </Sequence>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** Голос для формата voice — те же куски, только звук */
export const VoiceTrack: React.FC<{ file: string; tl: Timeline }> = ({ file, tl }) => {
  const segs = useSegmentFrames(tl);
  return (
    <>
      {segs.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.frames} layout="none">
          <Audio src={staticFile(file)} trimBefore={s.trim} playbackRate={tl.speed} />
        </Sequence>
      ))}
    </>
  );
};

/** Заглушка вместо спикера, пока видео нет (демо, проверка графики) */
const Placeholder: React.FC<{ p: Palette }> = ({ p }) => {
  const f = useCurrentFrame();
  const breathe = Math.sin(f / 40) * 6;
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, #5b5148 0%, #2b2622 45%, #121010 100%)` }}>
      <div style={{ position: "absolute", left: "8%", top: "12%", width: "26%", height: "40%", background: "rgba(255,240,220,0.08)", borderRadius: 12, filter: "blur(18px)" }} />
      <div style={{ position: "absolute", right: "6%", top: "18%", width: "20%", height: "50%", background: "rgba(255,240,220,0.06)", borderRadius: 12, filter: "blur(22px)" }} />
      <svg viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="ph" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a7a6c" />
            <stop offset="1" stopColor="#3d342e" />
          </linearGradient>
        </defs>
        <g transform={`translate(0 ${breathe})`}>
          <ellipse cx={540} cy={820} rx={175} ry={215} fill="url(#ph)" />
          <path d="M150 1920 C 170 1360, 330 1150, 540 1130 C 750 1150, 910 1360, 930 1920 Z" fill={p.panel} />
        </g>
      </svg>
    </div>
  );
};
