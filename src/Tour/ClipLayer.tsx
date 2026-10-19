import { Freeze, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { FPS } from "../Reel/layout";
import type { TourClip } from "./schema";
import type { SpeedMap } from "./timing";

// Один клип в момент `local` (секунда клипа в ролике). Время исходника берётся из кривой скорости,
// кадр «замораживается» через <Freeze> — так скорость может меняться плавно внутри клипа (speed ramp).
// На ускорении соседние кадры исходника смешиваются — получается естественный смаз движения.
// Remotion зажимает кадр в пределах длины ролика, поэтому время исходника «сжимается» через playbackRate:
// кадр = время × 30 / rate — так любой момент длинного клипа помещается в короткий ролик.

export type LayerFx = {
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  /** id SVG-фильтра направленного размытия (см. TourFilters) */
  blurFilter?: string;
  /** 0..1 — радиальный смаз от центра (пролёт) */
  zoomBlur?: number;
  brightness?: number;
};

export const ClipLayer: React.FC<{
  clip: TourClip;
  map: SpeedMap;
  local: number;
  fileDur: number;
  srcFps: number;
  motionBlur: boolean;
  fx?: LayerFx;
}> = ({ clip, map, local, fileDur, srcFps, motionBlur, fx = {} }) => {
  const { durationInFrames } = useVideoConfig();
  const last = fileDur > 0 ? fileDur - 1 / srcFps : Infinity;
  const clampT = (t: number) => Math.min(last, Math.max(0, t));
  const t = clampT(map.srcAt(local));
  // сколько кадров исходника проходит за один кадр ролика
  const step = map.speedAt(local) / FPS;
  const zoomCopies = fx.zoomBlur && fx.zoomBlur > 0.05 ? 4 : 1;
  // затвор 0,75 кадра; не больше 5 смешиваемых кадров
  const samples = motionBlur && zoomCopies === 1 ? Math.min(5, Math.max(1, Math.round(step * srcFps * 0.75))) : 1;
  const times =
    samples === 1
      ? [t]
      : Array.from({ length: samples }, (_, j) => clampT(t + (j / (samples - 1) - 0.5) * step * 0.75));

  // наезд за клип — к точке focus
  const progress = Math.min(1.2, Math.max(-0.2, local / Math.max(0.1, map.dur)));
  const push = 1 + (clip.push ?? 0.02) * progress;
  const fx0 = clip.focus?.x ?? 0.5;
  const fy0 = clip.focus?.y ?? 0.5;
  const scale = push * (fx.scale ?? 1);

  const filters = [
    fx.brightness && Math.abs(fx.brightness - 1) > 0.005 ? `brightness(${fx.brightness})` : "",
    fx.blurFilter ? `url(#${fx.blurFilter})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const maxT = Math.max(fileDur, clip.out + 2, ...times);
  const rate = Math.max(1, Math.ceil((maxT * FPS) / Math.max(1, durationInFrames - 2)));

  const layers: { t: number; zoom: number; opacity: number }[] = [];
  let k = 0;
  for (let z = 0; z < zoomCopies; z++) {
    for (const tt of times) {
      layers.push({ t: tt, zoom: 1 + z * 0.045 * (fx.zoomBlur ?? 0), opacity: 1 / (k + 1) });
      k++;
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        opacity: fx.opacity ?? 1,
        transform: `translate(${fx.x ?? 0}px, ${fx.y ?? 0}px)`,
        filter: filters || undefined,
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: `${fx0 * 100}% ${fy0 * 100}%` }}>
        {layers.map((l, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, opacity: l.opacity, transform: l.zoom !== 1 ? `scale(${l.zoom})` : undefined }}>
            <Freeze frame={(l.t * FPS) / rate}>
              <OffthreadVideo src={staticFile(clip.file)} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </Freeze>
          </div>
        ))}
      </div>
    </div>
  );
};
