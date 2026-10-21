import { useCurrentFrame, useVideoConfig } from "remotion";
import { Ruler, Surface } from "../../Tour/Marks";
import type { OverlayOf } from "../schema";
import type { FxProps } from "./common";

// Графика «в пространстве» в ролике с ведущим: те же надпись на поверхности и рулетка, что в обзоре (src/Tour/Marks.tsx).
// Ключи углов — в секундах исходника; переводим их во время от начала элемента (с учётом вырезки пауз и ускорения).

export const SurfaceFx: React.FC<FxProps<OverlayOf<"surface">>> = ({ o, total, p, local }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const keys = o.keys.map((k) => ({ ...k, t: local(k.t) / fps }));
  return <Surface s={{ ...o, clip: 0, at: 0, dur: total / fps, keys }} t={f / fps} src={f / fps} p={p} />;
};

export const RulerFx: React.FC<FxProps<OverlayOf<"ruler">>> = ({ o, total, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Ruler r={{ ...o, clip: 0, at: 0, dur: total / fps }} t={f / fps} p={p} />;
};
