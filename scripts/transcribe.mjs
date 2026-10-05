// npm run transcribe -- reels/<slug>.mp4 <uz|ru>
// Распознаёт речь (whisper.cpp, модель large-v3-turbo) → public/reels/<slug>.captions.json — слова с таймкодами.
// Первый запуск ставит whisper.cpp и качает модель (~1,6 ГБ) — запускать в фоне, несколько минут.
// Узбекский Whisper пишет с ошибками — после этого всегда `npm run align`: текст берём из сценария, время — от Whisper.
import fs from "node:fs";
import path from "node:path";
import whisperCpp from "@remotion/install-whisper-cpp";
import { runFf } from "./lib/env.mjs";

const { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } = whisperCpp;

const [file, lang = "uz"] = process.argv.slice(2);
if (!file || !["uz", "ru"].includes(lang)) {
  console.error("Использование: npm run transcribe -- reels/<slug>.mp4 <uz|ru>");
  process.exit(1);
}
const src = path.join("public", file);
if (!fs.existsSync(src)) {
  console.error(`Нет файла ${src}. Сначала npm run ingest.`);
  process.exit(1);
}

const WHISPER_DIR = path.resolve("whisper.cpp");
const VERSION = "1.5.5";
const MODEL = process.env.WHISPER_MODEL ?? "large-v3-turbo";

const base = src.replace(/\.[^.]+$/, "");
const wav = path.resolve(`${base}.16k.tmp.wav`);
const out = `${base}.captions.json`;

console.log("Готовлю звук 16 кГц…");
await runFf(["-y", "-i", src, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);

console.log("whisper.cpp…");
await installWhisperCpp({ to: WHISPER_DIR, version: VERSION, printOutput: false });
console.log(`Модель ${MODEL}…`);
// оборванная загрузка или ответ прокси вместо модели — удалить, иначе whisper падает с «bad magic»
const modelPath = path.join(WHISPER_DIR, `ggml-${MODEL}.bin`);
const tooSmall = () => fs.existsSync(modelPath) && fs.statSync(modelPath).size < 10_000_000;
if (tooSmall()) fs.rmSync(modelPath);
await downloadWhisperModel({ model: MODEL, folder: WHISPER_DIR, printOutput: false });
if (tooSmall()) {
  const head = fs.readFileSync(modelPath, "utf8").slice(0, 200);
  fs.rmSync(modelPath);
  console.error(`Модель не скачалась (нет доступа к huggingface.co?): ${head}`);
  process.exit(1);
}

console.log(`Распознаю (${lang})…`);
let last = -1;
const result = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: VERSION,
  model: MODEL,
  tokenLevelTimestamps: true,
  language: lang,
  onProgress: (p) => {
    const pct = Math.floor(p * 10) * 10;
    if (pct !== last) {
      last = pct;
      process.stdout.write(`  ${pct}%\n`);
    }
  },
});
fs.rmSync(wav, { force: true });

const { captions } = toCaptions({ whisperCppOutput: result });
const words = captions
  .map((c) => ({ ...c, text: c.text.trim() }))
  .filter((c) => c.text && !/^\[.*\]$/.test(c.text));
fs.writeFileSync(out, JSON.stringify(words, null, 1));
// сырой результат Whisper — для повторного align
fs.writeFileSync(`${base}.whisper.json`, JSON.stringify(words, null, 1));
console.log(`${words.length} слов → ${out}`);
console.log("Готово");
