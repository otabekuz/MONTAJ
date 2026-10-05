// npm run build-reel -- <slug>
// Рендер reels/<slug>/edit.json → громкость −14 LUFS → обложка.
// Результат: out/<slug>.mp4 и out/<slug>-cover.jpg. «Готово» печатается ТОЛЬКО при полном успехе;
// при сбое старый out/<slug>.mp4 удаляется, чтобы владельцу не ушла устаревшая версия.
// При ошибке чтения кадров видео сам повторяет рендер с 2, затем с 1 потоком.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { browserOptions } from "./lib/env.mjs";
import { finalize } from "./finalize.mjs";

const slug = process.argv[2];
const editPath = path.join("reels", slug ?? "", "edit.json");
if (!slug || !fs.existsSync(editPath)) {
  console.error(`Использование: npm run build-reel -- <slug>  (нужен ${editPath})`);
  process.exit(1);
}

const out = path.join("out", `${slug}.mp4`);
const tmp = path.join("out", `${slug}.render.tmp.mp4`);
const cover = path.join("out", `${slug}-cover.jpg`);
fs.mkdirSync("out", { recursive: true });
fs.rmSync(out, { force: true });
fs.rmSync(cover, { force: true });

const fail = (e) => {
  fs.rmSync(tmp, { force: true });
  fs.rmSync(out, { force: true });
  console.error(`\nСБОЙ: ${e?.message ?? e}`);
  console.error("Ролик НЕ собран — не отправлять.");
  process.exit(1);
};

try {
  const inputProps = JSON.parse(fs.readFileSync(editPath, "utf8"));
  console.log("Сборка проекта…");
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "Reel", inputProps, ...browserOptions() });
  if (!composition.props.hasVideo) {
    throw new Error(`Не найден исходник public/${inputProps.videoFile} — сначала npm run ingest.`);
  }
  console.log(`Ролик: ${(composition.durationInFrames / composition.fps).toFixed(1)} с`);

  let done = false;
  for (const concurrency of [null, 2, 1]) {
    try {
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: "h264",
        crf: 18,
        audioBitrate: "320k",
        outputLocation: tmp,
        concurrency,
        overwrite: true,
        ...browserOptions(),
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) {
            last = pct;
            console.log(`  рендер ${pct}%`);
          }
        },
      });
      done = true;
      break;
    } catch (e) {
      if (concurrency === 1 || !/No frame found|frame|timeout|Target closed|3221225477/i.test(String(e?.message))) throw e;
      console.log(`Сбой рендера (${String(e.message).split("\n")[0]}) — повторяю с ${concurrency === null ? 2 : 1} потоками…`);
    }
  }
  if (!done) throw new Error("рендер не завершился");

  console.log("Громкость −14 LUFS…");
  await finalize(tmp);
  fs.renameSync(tmp, out);

  console.log("Обложка…");
  const frame = Math.min(composition.durationInFrames - 1, Math.round(inputProps.hookSeconds * 0.6 * composition.fps));
  await renderStill({ serveUrl, composition, frame, output: cover, inputProps, imageFormat: "jpeg", jpegQuality: 92, ...browserOptions() });

  console.log(`→ ${out}\n→ ${cover}`);
  console.log("Готово");
} catch (e) {
  fail(e);
}
