import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";

// Вырезка человека из кадра (для слов «за спиной»). Рендерится скриптом `npm run matte` в прозрачное
// видео public/reels/<slug>.person.webm: человек на прозрачном фоне, кадр в кадр с исходником.
// Кадры исходника заранее выложены в public/reels/<slug>/frames/00001.jpg… (скрипт делает это сам).
// Модель — MediaPipe selfie multiclass (волосы, лицо, тело, одежда), работает в браузере рендера, без интернета.

export type MatteProps = { slug: string; width: number; height: number; frames: number };

let segmenterPromise: Promise<ImageSegmenter> | null = null;
const getSegmenter = () => {
  segmenterPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(staticFile("mediapipe/wasm"));
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: staticFile("models/selfie_multiclass_256x256.tflite"), delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })();
  return segmenterPromise;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не загрузился кадр ${src}`));
    img.src = src;
  });

// мягкая граница: ниже 0.35 — фон, выше 0.65 — человек
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, (x - 0.35) / 0.3));
  return t * t * (3 - 2 * t);
};

/**
 * Оставляет в маске только самый крупный силуэт (спикера): прохожие на заднем плане
 * иначе вылезают поверх слов «за спиной». На входе — вероятность ФОНА, на выходе тоже.
 */
const keepMainPerson = (bgProb: Float32Array, w: number, h: number) => {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || bgProb[i] > 0.5) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop() as number;
      size++;
      const x = k % w;
      const y = (k - x) / w;
      const nb = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const n of nb) {
        if (n >= 0 && label[n] === -1 && bgProb[n] <= 0.5) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return bgProb;
  const main = sizes.indexOf(Math.max(...sizes));
  const out = new Float32Array(bgProb);
  for (let i = 0; i < w * h; i++) if (label[i] !== -1 && label[i] !== main) out[i] = 1;
  return out;
};

export const Matte: React.FC<MatteProps> = ({ slug, width, height }) => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender(`Маска кадра ${frame}`));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [seg, img] = await Promise.all([
        getSegmenter(),
        loadImage(staticFile(`reels/${slug}/frames/${String(frame + 1).padStart(5, "0")}.jpg`)),
      ]);
      if (cancelled || !canvas.current) return;
      const ctx = canvas.current.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Нет 2D-контекста");
      ctx.drawImage(img, 0, 0, width, height);
      const result = seg.segment(canvas.current);
      const bg = result.confidenceMasks?.[0];
      if (!bg) throw new Error("Модель не вернула маску");
      const mask = keepMainPerson(bg.getAsFloat32Array(), bg.width, bg.height);
      const mw = bg.width;
      const mh = bg.height;
      const pixels = ctx.getImageData(0, 0, width, height);
      const d = pixels.data;
      for (let y = 0; y < height; y++) {
        // билинейная выборка маски 256×256 под размер кадра
        const fy = (y / height) * mh - 0.5;
        const y0 = Math.max(0, Math.floor(fy));
        const y1 = Math.min(mh - 1, y0 + 1);
        const ty = Math.min(1, Math.max(0, fy - y0));
        for (let x = 0; x < width; x++) {
          const fx = (x / width) * mw - 0.5;
          const x0 = Math.max(0, Math.floor(fx));
          const x1 = Math.min(mw - 1, x0 + 1);
          const tx = Math.min(1, Math.max(0, fx - x0));
          const b =
            mask[y0 * mw + x0] * (1 - tx) * (1 - ty) +
            mask[y0 * mw + x1] * tx * (1 - ty) +
            mask[y1 * mw + x0] * (1 - tx) * ty +
            mask[y1 * mw + x1] * tx * ty;
          d[(y * width + x) * 4 + 3] = Math.round(smooth(1 - b) * 255);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      result.close();
      continueRender(handle);
    })().catch((e) => cancelRender(e));
    return () => {
      cancelled = true;
    };
  }, [frame, handle, height, slug, width]);

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <canvas ref={canvas} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
