import type { Caption } from "@remotion/captions";
import { parseMedia } from "@remotion/media-parser";
import { type CalculateMetadataFunction, staticFile } from "remotion";
import { buildTimeline, computeSegments } from "./cuts";
import { FPS } from "./layout";
import type { ReelProps } from "./schema";

// Перед рендером: узнаём длину исходника, грузим субтитры, режем паузы и считаем длину ролика.
export const calculateReelMetadata: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  let durationSec = props.fallbackSeconds;
  let hasVideo = false;
  if (props.videoFile) {
    try {
      const { durationInSeconds } = await parseMedia({
        src: staticFile(props.videoFile),
        fields: { durationInSeconds: true },
        acknowledgeRemotionLicense: true,
      });
      if (durationInSeconds) {
        durationSec = durationInSeconds;
        hasVideo = true;
      }
    } catch {
      // файла ещё нет — работаем по fallbackSeconds
    }
  }

  let captions: Caption[] = props.captions ?? [];
  if (!captions.length && props.captionsFile) {
    try {
      const res = await fetch(staticFile(props.captionsFile));
      if (res.ok) captions = (await res.json()) as Caption[];
    } catch {
      captions = [];
    }
  }

  const segments = computeSegments(captions, durationSec, props.cutPauses, props.beats);
  const tl = buildTimeline(segments, props.speed, FPS);
  // после концовки — короткий хвост, чтобы плашка не обрывалась на последнем слове
  const tail = props.cta ? 0.4 : 0.2;
  const durationInFrames = Math.max(FPS, Math.ceil((tl.bodySeconds + tail) * FPS));

  return {
    durationInFrames,
    fps: FPS,
    props: { ...props, captions, hasVideo, segments },
  };
};
