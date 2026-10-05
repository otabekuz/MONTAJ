// npm run matte -- <slug>
// Вырезает человека из public/reels/<slug>.mp4 → public/reels/<slug>.person.webm (прозрачный фон).
// Нужен для слов-гигантов «за спиной» (subjectFile в edit.json). Модель MediaPipe (~16 МБ) качается один раз.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { browserOptions, runFf } from "./lib/env.mjs";

const slug = process.argv[2];
const src = path.join("public", "reels", `${slug}.mp4`);
if (!slug || !fs.existsSync(src)) {
  console.error("Использование: npm run matte -- <slug>  (нужен public/reels/<slug>.mp4 — сначала npm run ingest)");
  process.exit(1);
}

const MODEL = path.join("public", "models", "selfie_multiclass_256x256.tflite");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
if (!fs.existsSync(MODEL) || fs.statSync(MODEL).size < 1_000_000) {
  console.log("Модель вырезки (MediaPipe)…");
  fs.mkdirSync(path.dirname(MODEL), { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`Не скачалась модель: ${res.status} ${MODEL_URL}`);
    process.exit(1);
  }
  fs.writeFileSync(MODEL, Buffer.from(await res.arrayBuffer()));
}
const WASM = path.join("public", "mediapipe", "wasm");
if (!fs.existsSync(WASM)) fs.cpSync(path.join("node_modules", "@mediapipe", "tasks-vision", "wasm"), WASM, { recursive: true });

const framesDir = path.join("public", "reels", slug, "frames");
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
console.log("Кадры исходника…");
await runFf(["-y", "-i", src, "-q:v", "2", path.join(framesDir, "%05d.jpg")]);
const frames = fs.readdirSync(framesDir).filter((f) => f.endsWith(".jpg")).length;

const out = path.join("public", "reels", `${slug}.person.webm`);
const tmp = path.join("public", "reels", `${slug}.person.tmp.webm`);
try {
  console.log(`Вырезка человека: ${frames} кадров…`);
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  const inputProps = { slug, width: 1080, height: 1920, frames };
  const composition = await selectComposition({ serveUrl, id: "Matte", inputProps, ...browserOptions() });
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "vp8",
    imageFormat: "png",
    pixelFormat: "yuva420p",
    crf: 10,
    outputLocation: tmp,
    overwrite: true,
    muted: true,
    timeoutInMilliseconds: 120000,
    ...browserOptions(),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        last = pct;
        console.log(`  ${pct}%`);
      }
    },
  });
  fs.renameSync(tmp, out);
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error(`СБОЙ: ${e.message}`);
  process.exit(1);
} finally {
  fs.rmSync(framesDir, { recursive: true, force: true });
}
console.log(`→ ${out}  (в edit.json: "subjectFile": "reels/${slug}.person.webm")`);
console.log("Готово");
