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
import { makeCancelSignal, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
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
const SR = 48000;

// 16-битный стерео WAV → Int16Array (ищем блок data: ffmpeg пишет перед ним LIST)
const readWav = (file) => {
  const b = fs.readFileSync(file);
  let p = 12;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "data") return new Int16Array(b.buffer.slice(b.byteOffset + p + 8, b.byteOffset + p + 8 + Math.min(size, b.length - p - 8)));
    p += 8 + size + (size % 2);
  }
  throw new Error(`В ${file} нет звука`);
};

const writeWav = (file, samples) => {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

// музыка × громкость × нарастание 0,2 с × затухание в конце + звуки sfx (те же правила, что в src/Tour/Tour.tsx)
const mixTourAudio = ({ musicWav, out, sec, inputProps, starts }) => {
  const music = readWav(musicWav);
  const n = Math.round(sec * SR);
  const mix = new Float32Array(n * 2);
  const vol = inputProps.musicVolume ?? 0.9;
  const fadeOut = inputProps.loop ? 0.2 : 0.8;
  const tail = inputProps.loop ? 0.6 : 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fin = Math.min(1, t / 0.2);
    const fout = t > sec - fadeOut ? tail + (1 - tail) * Math.max(0, (sec - t) / fadeOut) : 1;
    const g = vol * fin * fout;
    mix[i * 2] = ((music[i * 2] ?? 0) / 32768) * g;
    mix[i * 2 + 1] = ((music[i * 2 + 1] ?? 0) / 32768) * g;
  }
  for (const s of inputProps.sfx ?? []) {
    if (starts[s.clip] === undefined) continue;
    const fx = readWav(path.join("public", "sfx", `${s.sound}.wav`));
    const at = Math.round((starts[s.clip] + s.offset) * SR);
    const v = s.volume ?? 0.5;
    for (let j = 0; j < fx.length / 2; j++) {
      const i = at + j;
      if (i < 0 || i >= n) continue;
      mix[i * 2] += (fx[j * 2] / 32768) * v;
      mix[i * 2 + 1] += (fx[j * 2 + 1] / 32768) * v;
    }
  }
  const pcm = new Int16Array(n * 2);
  // мягкий ограничитель: громкость потом всё равно выравнивает finalize (−14 LUFS)
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.tanh(mix[i]) * 32767);
  writeWav(out, pcm);
};

// ffmpeg Remotion на ПК владельца изредка падает с 0xC0000005 — шаг просто повторяем
const retryCrash = async (step) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (e) {
      if (attempt >= 4 || !/3221225477/.test(String(e?.message))) throw e;
      console.log(`  ffmpeg упал (0xC0000005), повтор ${attempt}`);
    }
  }
};

// зависший после сбоя браузер рендера не даёт запустить следующий («Failed to launch the browser process»)
const killBrowsers = () => {
  if (process.platform !== "win32") return;
  try {
    execFileSync("taskkill", ["/IM", "chrome-headless-shell.exe", "/F"], { stdio: "ignore" });
  } catch {
    // процессов нет — ничего не делаем
  }
};

// composition/inputProps — для видео кусков (у Tour без звука), audioProps/starts — исходный план для сведения звука
const renderChunked = async ({ serveUrl, composition, inputProps, audioProps = inputProps, starts, retriable }) => {
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
        // кусок дольше 6 минут — зависание (так бывало после сбоя чтения кадра): отменяем и повторяем
        const { cancelSignal, cancel } = makeCancelSignal();
        const timer = setTimeout(cancel, 6 * 60 * 1000);
        try {
          await renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf: 18, muted: true, frameRange: range, outputLocation: part, concurrency: attempt > 3 ? 1 : 2, overwrite: true, cancelSignal, ...browserOptions() });
        } finally {
          clearTimeout(timer);
        }
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
  if (audioProps.layout === "tour") {
    // рендер звука через Remotion на ПК владельца зависал, а в его ffmpeg нет afade/amix — поэтому звук Tour сводится здесь:
    // ffmpeg только раскодирует музыку в WAV, громкость, нарастание/затухание (как в src/Tour/Tour.tsx) и звуки sfx — в JS
    const musicWav = path.join("out", `${slug}.music.wav`);
    await retryCrash(() => runFf([
      "-y", "-stream_loop", "-1", "-ss", String(audioProps.musicStart ?? 0), "-i", path.join("public", audioProps.musicFile),
      "-t", sec.toFixed(3), "-vn", "-af", "aresample=48000", "-c:a", "pcm_s16le", "-f", "wav", musicWav,
    ]));
    const mixed = path.join("out", `${slug}.mix.wav`);
    mixTourAudio({ musicWav, out: mixed, sec, inputProps: audioProps, starts: starts ?? composition.props.resolved.map((r) => r.start) });
    fs.rmSync(musicWav, { force: true });
    await retryCrash(() => runFf(["-y", "-i", mixed, "-c:a", "aac", "-b:a", "320k", audio]));
    fs.rmSync(mixed, { force: true });
  } else {
    await renderMedia({ serveUrl, composition, inputProps, codec: "aac", audioBitrate: "320k", outputLocation: audio, overwrite: true, ...browserOptions() });
  }
  const list = path.join("out", `${slug}.parts.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`).join("\n") + "\n");
  await retryCrash(() => runFf(["-y", "-f", "concat", "-safe", "0", "-i", list, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", tmp]));
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

  const retriable = (e) => /No frame found|frame|timeout|Target closed|Request closed|launch the browser|ERR_ABORTED|ERR_EMPTY_RESPONSE|cancel|3221225477/i.test(String(e?.message));
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
  // куски рендерятся без звука, а звук сводится отдельно — поэтому из композиции для кусков убираем музыку и звуки:
  // иначе Remotion в каждом куске скачивает и проверяет их ffprobe, а он на ПК владельца падает (0xC0000005)
  let parts = [];
  if (!done) {
    const silentProps = tour ? { ...inputProps, musicFile: "", sfx: [] } : inputProps;
    const silent = tour ? await selectComposition({ serveUrl, id: "Tour", inputProps: silentProps, ...browserOptions() }) : composition;
    parts = await renderChunked({ serveUrl, composition: silent, inputProps: silentProps, audioProps: inputProps, starts: composition.props.resolved?.map((r) => r.start), retriable });
  }

  console.log("Громкость −14 LUFS…");
  await retryCrash(() => finalize(tmp));
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
