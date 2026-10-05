// npm run transcribe -- reels/<slug>.mp4 <uz|ru>
// Распознаёт речь (whisper.cpp 1.7.6, модель large-v3-turbo, точные тайминги слов через DTW)
// → public/reels/<slug>.captions.json — слова с таймкодами.
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

// модели лежат в whisper.cpp/ (как раньше — 1,6 ГБ заново не качаем), программа — в отдельной папке версии
const WHISPER_DIR = path.resolve("whisper.cpp");
// 1.7.6: есть DTW-пресет large.v3.turbo (в 1.5.5 его нет — тайминги «размазывались») и готовая сборка под Windows
const VERSION = "1.7.6";
const BIN_DIR = path.resolve(`whisper.cpp-${VERSION}`);
const EXE = path.join(BIN_DIR, "build", "bin", process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");
const MODEL = process.env.WHISPER_MODEL ?? "large-v3-turbo";

const base = src.replace(/\.[^.]+$/, "");
const wav = path.resolve(`${base}.16k.tmp.wav`);
const out = `${base}.captions.json`;

console.log("Готовлю звук 16 кГц…");
// пересчёт фильтром: "-ar/-ac" роняют ffmpeg Remotion на Windows (0xC0000005)
await runFf(["-y", "-i", src, "-vn", "-af", "aresample=16000,aformat=sample_rates=16000:channel_layouts=mono", "-c:a", "pcm_s16le", wav]);

console.log(`whisper.cpp ${VERSION}…`);
// Remotion ищет программу в build/bin/, а в архиве для Windows она лежит в Release/ — переносим сами
const fixWindowsLayout = () => {
  const rel = path.join(BIN_DIR, "Release");
  if (process.platform === "win32" && !fs.existsSync(EXE) && fs.existsSync(path.join(rel, "whisper-cli.exe"))) {
    fs.mkdirSync(path.dirname(EXE), { recursive: true });
    fs.cpSync(rel, path.dirname(EXE), { recursive: true });
  }
};
fixWindowsLayout();
if (!fs.existsSync(EXE)) {
  // недоустановленная папка этой версии мешает установщику — убираем только её
  fs.rmSync(BIN_DIR, { recursive: true, force: true });
  await installWhisperCpp({ to: BIN_DIR, version: VERSION, printOutput: false });
  fixWindowsLayout();
}
if (!fs.existsSync(EXE)) {
  console.error(`Не найден ${EXE} после установки whisper.cpp ${VERSION}.`);
  process.exit(1);
}
fs.mkdirSync(WHISPER_DIR, { recursive: true });
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
  whisperPath: BIN_DIR,
  whisperCppVersion: VERSION,
  model: MODEL,
  modelFolder: WHISPER_DIR,
  // точные тайминги каждого слова (DTW); в 1.7.6 пресет large.v3.turbo есть
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
