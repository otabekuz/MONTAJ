// npm run ingest -- "<путь к видео или звуку>" <slug>
// Видео → public/reels/<slug>.mp4: 1080×1920, 30 к/с, ключевой кадр каждую секунду, AAC 48 кГц.
// Видео из генераторов аватара и телефонов часто с «рваными» ключевыми кадрами — без перекодирования рендер падает.
// Звук (mp3/wav/m4a) копируется как есть → формат voice.
import fs from "node:fs";
import path from "node:path";
import { AUDIO_EXT, runFf } from "./lib/env.mjs";

const [input, slug] = process.argv.slice(2);
if (!input || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Использование: npm run ingest -- "<путь к файлу>" <slug латиницей-через-дефис>');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`Файл не найден: ${input}`);
  process.exit(1);
}

fs.mkdirSync(path.join("public", "reels", slug), { recursive: true });
fs.mkdirSync(path.join("reels", slug), { recursive: true });

if (AUDIO_EXT.test(input)) {
  const ext = path.extname(input).toLowerCase();
  const out = path.join("public", "reels", `${slug}${ext}`);
  fs.copyFileSync(input, out);
  console.log(`Звук → ${out}  (формат voice, videoFile: "reels/${slug}${ext}")`);
  console.log("Готово");
  process.exit(0);
}

const out = path.join("public", "reels", `${slug}.mp4`);
const tmp = path.join("public", "reels", `${slug}.tmp.mp4`);
console.log(`Перекодирую ${input} → ${out} …`);
try {
  await runFf([
    "-y", "-i", input,
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
    "-pix_fmt", "yuv420p",
    // пересчёт звука фильтром: "-ar 48000 -ac 2" роняет ffmpeg Remotion на Windows (0xC0000005) на звуке iPhone 44,1 кГц
    "-af", "aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    tmp,
  ]);
  fs.renameSync(tmp, out);
} catch (e) {
  fs.rmSync(tmp, { force: true });
  console.error(e.message);
  process.exit(1);
}
const info = await runFf(["-i", out], "ffprobe").catch((e) => e.message);
const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
if (dur) console.log(`Длина: ${(+dur[1] * 3600 + +dur[2] * 60 + +dur[3]).toFixed(1)} с`);
console.log(`videoFile: "reels/${slug}.mp4"`);
console.log("Готово");
