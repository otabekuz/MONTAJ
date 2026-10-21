// npm run build-reel -- <slug> [--chunks]
// Рендер reels/<slug>/edit.json (композиция Reel, а при "layout": "tour" — Tour) → громкость −14 LUFS → обложка.
// Результат: out/<slug>.mp4 и out/<slug>-cover.jpg. «Готово» печатается ТОЛЬКО при полном успехе;
// при сбое старый out/<slug>.mp4 удаляется, чтобы владельцу не ушла устаревшая версия.
// При ошибке чтения кадров видео сам повторяет рендер с 2 потоками, затем собирает ролик кусками по 4 с
// (повторяется только упавший кусок, звук рендерится отдельно).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { browserOptions, runFf } from "./lib/env.mjs";
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

const CHUNK = 120; // кадров в куске (4 с)

// зависший после сбоя браузер рендера не даёт запустить следующий («Failed to launch the browser process»)
const killBrowsers = () => {
  if (process.platform !== "win32") return;
  try {
    execFileSync("taskkill", ["/IM", "chrome-headless-shell.exe", "/F"], { stdio: "ignore" });
  } catch {
    // процессов нет — ничего не делаем
  }
};

const renderChunked = async ({ serveUrl, composition, inputProps, retriable }) => {
  const total = composition.durationInFrames;
  const count = Math.ceil(total / CHUNK);
  // кусок с прошлого запуска годится, если он новее плана монтажа
  const planTime = fs.statSync(editPath).mtimeMs;
  const parts = [];
  for (let k = 0; k < count; k++) {
    const range = [k * CHUNK, Math.min(total, (k + 1) * CHUNK) - 1];
    const part = path.join("out", `${slug}.part-${String(k).padStart(2, "0")}-of-${count}.mp4`);
    if (fs.existsSync(part) && fs.statSync(part).size > 0 && fs.statSync(part).mtimeMs > planTime) {
      parts.push(part);
      console.log(`  кусок ${k + 1}/${count} — с прошлого запуска`);
      continue;
    }
    for (let attempt = 1; ; attempt++) {
      try {
        await renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf: 18, muted: true, frameRange: range, outputLocation: part, concurrency: attempt > 3 ? 1 : 2, overwrite: true, ...browserOptions() });
        break;
      } catch (e) {
        fs.rmSync(part, { force: true });
        if (attempt >= 6 || !retriable(e)) throw e;
        console.log(`  кусок ${k + 1}: сбой (${String(e.message).split("\n")[0].slice(0, 80)}…), повтор ${attempt}`);
        killBrowsers();
      }
    }
    parts.push(part);
    console.log(`  кусок ${k + 1}/${count} готов`);
  }
  // .mp4: в урезанном ffmpeg Remotion нет муксера m4a
  const audio = path.join("out", `${slug}.audio.mp4`);
  const sec = total / composition.fps;
  if (inputProps.layout === "tour") {
    // в Tour звук — только музыка; та же кривая, что в src/Tour/Tour.tsx (0,2 с нарастание, 0,8 с затухание, громкость musicVolume);
    // рендер звука через Remotion на ПК владельца зависал
    const fadeOut = inputProps.loop ? 0.2 : 0.8;
    await runFf([
      "-y", "-stream_loop", "-1", "-ss", String(inputProps.musicStart ?? 0), "-i", path.join("public", inputProps.musicFile), "-t", sec.toFixed(3), "-vn",
      // в ffmpeg Remotion нет afade — нарастание и затухание формулой в volume
      "-af", `volume='${inputProps.musicVolume ?? 0.9}*min(1,t/0.2)*min(1,max(0,(${sec.toFixed(3)}-t)/${fadeOut}))':eval=frame,aresample=48000`,
      "-c:a", "aac", "-b:a", "320k", audio,
    ]);
  } else {
    await renderMedia({ serveUrl, composition, inputProps, codec: "aac", audioBitrate: "320k", outputLocation: audio, overwrite: true, ...browserOptions() });
  }
  const list = path.join("out", `${slug}.parts.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`).join("\n") + "\n");
  await runFf(["-y", "-f", "concat", "-safe", "0", "-i", list, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", tmp]);
  fs.rmSync(audio, { force: true });
  fs.rmSync(list, { force: true });
  // куски удаляются только после полного успеха (обложка тоже может упасть) — повторный запуск их подхватит
  return parts;
};

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
  const tour = inputProps.layout === "tour";
  const composition = await selectComposition({ serveUrl, id: tour ? "Tour" : "Reel", inputProps, ...browserOptions() });
  if (tour) {
    const missing = composition.props.resolved.findIndex((r) => r.fileDur === 0);
    if (missing >= 0) throw new Error(`Не найден клип public/${inputProps.clips[missing].file} — сначала npm run tour-ingest.`);
  } else if (!composition.props.hasVideo) {
    throw new Error(`Не найден исходник public/${inputProps.videoFile} — сначала npm run ingest.`);
  }
  console.log(`Ролик: ${(composition.durationInFrames / composition.fps).toFixed(1)} с`);

  const retriable = (e) => /No frame found|frame|timeout|Target closed|Request closed|launch the browser|3221225477/i.test(String(e?.message));
  // --chunks — сразу кусками (когда целиком заведомо не проходит)
  let done = false;
  for (const concurrency of process.argv.includes("--chunks") ? [] : [null, 2]) {
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
      if (!retriable(e)) throw e;
      console.log(`Сбой рендера (${String(e.message).split("\n")[0]}) — ${concurrency === null ? "повторяю с 2 потоками" : "собираю кусками"}…`);
    }
  }
  // Кусками: на ПК владельца (360 Total Security) чтение кадров Remotion падает случайно (0xC0000005, «No frame found»),
  // и один сбой перечёркивал весь рендер. Здесь повторяется только упавший кусок; звук рендерится отдельно и подкладывается при склейке.
  const parts = done ? [] : await renderChunked({ serveUrl, composition, inputProps, retriable });

  console.log("Громкость −14 LUFS…");
  await finalize(tmp);
  fs.renameSync(tmp, out);

  console.log("Обложка…");
  const coverSec = tour ? (inputProps.coverAt ?? 0.4) : inputProps.hookSeconds * 0.6;
  const frame = Math.min(composition.durationInFrames - 1, Math.round(coverSec * composition.fps));
  for (let attempt = 1; ; attempt++) {
    try {
      await renderStill({ serveUrl, composition, frame, output: cover, inputProps, imageFormat: "jpeg", jpegQuality: 92, ...browserOptions() });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`  обложка: сбой (${String(e.message).split("\n")[0].slice(0, 80)}), повтор ${attempt}`);
      killBrowsers();
    }
  }
  for (const f of parts) fs.rmSync(f, { force: true });

  console.log(`→ ${out}\n→ ${cover}`);
  console.log("Готово");
} catch (e) {
  fail(e);
}
