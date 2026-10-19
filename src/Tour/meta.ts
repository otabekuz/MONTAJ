import { parseMedia } from "@remotion/media-parser";
import { type CalculateMetadataFunction, staticFile } from "remotion";
import { FPS } from "../Reel/layout";
import type { TourProps } from "./schema";
import { beatGrid, layoutClips } from "./timing";

// Перед рендером: длина и частота кадров каждого клипа, сетка ударов, раскладка клипов по биту.
export const calculateTourMetadata: CalculateMetadataFunction<TourProps> = async ({ props }) => {
  const files = await Promise.all(
    props.clips.map(async (c) => {
      try {
        const m = await parseMedia({
          src: staticFile(c.file),
          fields: { durationInSeconds: true, fps: true },
          acknowledgeRemotionLicense: true,
        });
        return { fileDur: m.durationInSeconds ?? 0, fps: m.fps ?? 30 };
      } catch {
        return { fileDur: 0, fps: 30 };
      }
    }),
  );

  let trackBeats: number[] | undefined;
  if (props.beatsFile) {
    try {
      const res = await fetch(staticFile(props.beatsFile));
      if (res.ok) trackBeats = ((await res.json()) as { beats: number[] }).beats;
    } catch {
      trackBeats = undefined;
    }
  }
  const beats = beatGrid({
    bpm: props.bpm,
    beatOffset: props.beatOffset,
    musicStart: props.musicStart,
    beats: trackBeats,
    until: 600,
  });

  const loop = props.loop ?? false;
  const resolved = layoutClips(props.clips, loop, props.beatSync ? beats : [], props.beatEvery ?? 1, files);
  const last = resolved[resolved.length - 1];
  const total = last.start + last.dur;

  return {
    durationInFrames: Math.max(FPS, Math.round(total * FPS)),
    fps: FPS,
    props: { ...props, resolved, beats },
  };
};
