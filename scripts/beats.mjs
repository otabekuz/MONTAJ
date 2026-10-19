// npm run beats -- <музыка в public/>
// Находит темп и удары трека → public/<путь>.beats.json: { bpm, offset, beats[], bars[] }.
// bars — сильные доли (начало такта): на них лучше всего ставить главные склейки обзора.
// В плане Tour: "beatsFile": "<путь>.beats.json" (или просто "bpm" для своей музыки — montaj-* идут 96 BPM с 0 с).
import fs from "node:fs";
import path from "node:path";
import { runFf } from "./lib/env.mjs";

const rel = process.argv[2];
const file = rel && (fs.existsSync(rel) ? rel : path.join("public", rel));
if (!rel || !fs.existsSync(file)) {
  console.error("Использование: npm run beats -- music/трек.mp3   (файл в public/)");
  process.exit(1);
}

const SR = 22050;
const HOP = 256;
const tmp = path.join("out", `.beats-${process.pid}.wav`);
fs.mkdirSync("out", { recursive: true });
// частота — фильтром aresample: ключ -ar роняет ffmpeg Remotion на Windows
await runFf(["-v", "error", "-y", "-i", file, "-vn", "-af", `aresample=${SR},aformat=sample_fmts=s16:channel_layouts=mono`, "-c:a", "pcm_s16le", tmp]);
const wav = fs.readFileSync(tmp);
fs.rmSync(tmp);
const dataAt = wav.indexOf("data") + 8;
const n = Math.floor((wav.length - dataAt) / 2);
const x = new Float32Array(n);
for (let i = 0; i < n; i++) x[i] = wav.readInt16LE(dataAt + i * 2) / 32768;

// энергия по полосам: низ (бочка) и верх (хэты, щелчки); огибающая начала звуков — рост логарифма энергии
const lp = (fc) => {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  const y = new Float32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) y[i] = s += a * (x[i] - s);
  return y;
};
const low = lp(150);
const mid = lp(2500);
const frames = Math.floor(n / HOP);
const band = (fn) => {
  const e = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    let s = 0;
    for (let i = k * HOP; i < (k + 1) * HOP; i++) {
      const v = fn(i);
      s += v * v;
    }
    e[k] = Math.log(1e-6 + s);
  }
  return e;
};
const eLow = band((i) => low[i]);
const eHigh = band((i) => x[i] - mid[i]);
const eAll = band((i) => x[i]);
const env = new Float32Array(frames);
for (let k = 1; k < frames; k++) {
  env[k] = 1.5 * Math.max(0, eLow[k] - eLow[k - 1]) + Math.max(0, eHigh[k] - eHigh[k - 1]) + 0.5 * Math.max(0, eAll[k] - eAll[k - 1]);
}
const mean = env.reduce((s, v) => s + v, 0) / frames;
for (let k = 0; k < frames; k++) env[k] = Math.max(0, env[k] - mean);

// темп: автокорреляция огибающей, 70–180 BPM, с мягким предпочтением 90–130 (обычный темп для обзоров)
const fps = SR / HOP;
let best = { bpm: 0, score: -1 };
for (let bpm = 70; bpm <= 180; bpm += 0.25) {
  const lag = (60 / bpm) * fps;
  let s = 0;
  for (let k = 0; k + lag * 4 < frames; k++) {
    const l1 = env[Math.round(k + lag)];
    const l2 = env[Math.round(k + 2 * lag)];
    s += env[k] * (l1 + 0.5 * l2);
  }
  const pref = Math.exp(-Math.pow(Math.log2(bpm / 110), 2) * 2);
  s *= 0.7 + 0.3 * pref;
  if (s > best.score) best = { bpm, score: s };
}
const period = (60 / best.bpm) * fps;
// фаза: сдвиг сетки, на который приходится больше всего начал звуков
let phase = { off: 0, score: -1 };
for (let off = 0; off < period; off += 0.25) {
  let s = 0;
  for (let t = off; t < frames; t += period) s += env[Math.round(t)] ?? 0;
  if (s > phase.score) phase = { off, score: s };
}
// уточнить сетку: каждый удар притягиваем к ближайшему пику (±30 мс), затем прямая по всем ударам —
// музыка ровная, поэтому в результат идёт ровная сетка без «дрожания» отдельных ударов
const snapped = [];
for (let t = phase.off; t < frames; t += period) {
  const r = Math.round(0.03 * fps);
  let bk = Math.round(t);
  for (let k = Math.max(0, bk - r); k <= Math.min(frames - 1, bk + r); k++) if (env[k] > env[bk]) bk = k;
  snapped.push(bk / fps);
}
const m = snapped.length;
const sx = (m * (m - 1)) / 2;
const sxx = ((m - 1) * m * (2 * m - 1)) / 6;
const sy = snapped.reduce((s, v) => s + v, 0);
const sxy = snapped.reduce((s, v, i) => s + i * v, 0);
const step = m > 1 ? (m * sxy - sx * sy) / (m * sxx - sx * sx) : 60 / best.bpm;
let first = (sy - step * sx) / m;
while (first - step >= -0.02) first -= step;
const duration = n / SR;
const beats = [];
for (let t = Math.max(0, first); t < duration; t += step) beats.push(+t.toFixed(3));
best.bpm = +(60 / step).toFixed(2);
// начало такта: из 4 вариантов — тот, где бочка сильнее
let barPhase = 0;
let barScore = -Infinity;
for (let ph = 0; ph < 4; ph++) {
  let s = 0;
  for (let i = ph; i < beats.length; i += 4) s += eLow[Math.round(beats[i] * fps)] ?? 0;
  if (s > barScore) {
    barScore = s;
    barPhase = ph;
  }
}
const bars = beats.filter((_, i) => i % 4 === barPhase);
const out = file.replace(/\.[^.]+$/, ".beats.json");
fs.writeFileSync(out, JSON.stringify({ bpm: best.bpm, offset: beats[0] ?? 0, beats, bars }, null, 1) + "\n");
console.log(`Темп: ${best.bpm} BPM, удар каждые ${(60 / best.bpm).toFixed(3)} с, первый — ${beats[0]?.toFixed(2)} с, тактов: ${bars.length}`);
console.log(`→ ${out}  (в плане: "beatsFile": "${path.relative("public", out).split(path.sep).join("/")}")`);
console.log("Готово");
