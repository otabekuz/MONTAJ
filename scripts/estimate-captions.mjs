// npm run estimate-captions -- reels/<slug>
// Субтитры БЕЗ распознавания речи: точный текст из reels/<slug>/script.md раскладывается по паузам в голосе.
// Паузы (ffmpeg silencedetect) сопоставляются со знаками препинания, между ними слова делят время по длине.
// Точность — около 0,1–0,3 с на слово: хватает для ровного синтеза речи (ElevenLabs, аватар).
// Когда доступен Whisper — лучше `npm run transcribe` + `npm run align`.
import fs from "node:fs";
import path from "node:path";
import { runFf } from "./lib/env.mjs";

const arg = process.argv[2];
if (!arg) {
  console.error("Использование: npm run estimate-captions -- reels/<slug>");
  process.exit(1);
}
const slug = path.basename(arg.replace(/[\\/]+$/, ""));
const scriptPath = path.join("reels", slug, "script.md");
const media = ["mp3", "wav", "m4a", "mp4"].map((e) => path.join("public", "reels", `${slug}.${e}`)).find((p) => fs.existsSync(p));
if (!fs.existsSync(scriptPath) || !media) {
  console.error(`Нужны ${scriptPath} и public/reels/${slug}.(mp3|wav|m4a|mp4)`);
  process.exit(1);
}

// --- текст ---
const md = fs.readFileSync(scriptPath, "utf8");
const m = /^##\s*Текст для (?:генерации аватара|озвучки|записи)[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(md);
if (!m) {
  console.error("В script.md нет раздела «## Текст для генерации аватара».");
  process.exit(1);
}
const words = m[1]
  .replace(/```[a-z]*\n?/g, "")
  .replace(/\[[A-ZА-ЯЁ/ ]+\]/g, " ")
  .replace(/(\d)\s+(\d{3})\b/g, "$1 $2") // «2 100» — одно слово
  .replace(/\s+([—–-])(?=\s)/g, "$1") // отдельное тире «месте — с» → пауза после «месте—»
  .split(/\s+/)
  .filter((w) => /[\p{L}\p{N}]/u.test(w));
const n = words.length;
const weight = (w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5;
const punct = (w) => (/[.!?…»]$/.test(w) ? 3 : /[:;—–]$/.test(w) ? 2 : /,$/.test(w) ? 1 : 0);

// --- паузы ---
const out = await runFf(["-hide_banner", "-i", media, "-vn", "-af", "silencedetect=noise=-35dB:d=0.18", "-c:a", "pcm_s16le", "-f", "null", "-"]);
const dur = (() => {
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  return d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0;
})();
const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((x) => +x[1]);
const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((x) => +x[1]);
let silences = starts.map((s, i) => ({ s, e: ends[i] ?? dur }));
const speechStart = silences.length && silences[0].s < 0.05 ? silences[0].e : 0;
let speechEnd = dur;
if (silences.length && silences[silences.length - 1].e >= dur - 0.05) speechEnd = silences[silences.length - 1].s;
silences = silences.filter((x) => x.s > speechStart + 0.05 && x.e < speechEnd - 0.05);

// --- ожидаемое время конца каждого слова при ровном темпе (по «чистому» времени речи) ---
const speechTotal = speechEnd - speechStart - silences.reduce((a, x) => a + x.e - x.s, 0);
const totalW = words.reduce((a, w) => a + weight(w), 0);
const speechClock = (t) => t - speechStart - silences.filter((x) => x.e <= t).reduce((a, x) => a + x.e - x.s, 0);
let acc = 0;
const expectedEnd = words.map((w) => (acc += weight(w)) / totalW * speechTotal);

// --- динамика: каждой паузе — граница после слова i (монотонно) ---
const P = silences.length;
const INF = 1e9;
const cost = (k, i) => {
  const p = punct(words[i]);
  const drift = Math.abs(expectedEnd[i] - speechClock(silences[k].s)) / 1.5;
  return drift + (p === 0 ? 2.5 : p === 1 ? 0.4 : 0);
};
// D[k][i] — лучшая стоимость, если пауза k стоит после слова i
const D = Array.from({ length: P }, () => new Float64Array(n).fill(INF));
const back = Array.from({ length: P }, () => new Int32Array(n).fill(-1));
for (let i = 0; i < n - 1; i++) D[0][i] = cost(0, i);
for (let k = 1; k < P; k++) {
  let best = INF;
  let bestI = -1;
  for (let i = 1; i < n - 1; i++) {
    if (D[k - 1][i - 1] < best) {
      best = D[k - 1][i - 1];
      bestI = i - 1;
    }
    if (best < INF) {
      D[k][i] = best + cost(k, i);
      back[k][i] = bestI;
    }
  }
}
let endI = 0;
for (let i = 0; i < n; i++) if (D[P - 1]?.[i] < D[P - 1]?.[endI]) endI = i;
const anchorAfter = new Array(P);
for (let k = P - 1, i = endI; k >= 0; k--) {
  anchorAfter[k] = i;
  i = back[k][i];
}

// --- раскладка слов между паузами ---
const groups = [];
let from = 0;
let t0 = speechStart;
for (let k = 0; k <= P; k++) {
  const to = k < P ? anchorAfter[k] : n - 1;
  const t1 = k < P ? silences[k].s : speechEnd;
  groups.push({ from, to, t0, t1 });
  from = to + 1;
  t0 = k < P ? silences[k].e : speechEnd;
}
const captions = [];
for (const g of groups) {
  const ws = words.slice(g.from, g.to + 1);
  const tot = ws.reduce((a, w) => a + weight(w), 0);
  let t = g.t0;
  ws.forEach((w) => {
    const d = ((g.t1 - g.t0) * weight(w)) / tot;
    captions.push({ text: w.replace(/\u00A0/g, " ").replace(/[—–]$/, ""), startMs: Math.round(t * 1000), endMs: Math.round((t + d) * 1000), timestampMs: null, confidence: null });
    t += d;
  });
}

const target = path.join("public", "reels", `${slug}.captions.json`);
fs.writeFileSync(target, JSON.stringify(captions, null, 1));
console.log(`Слов: ${n}, пауз: ${P}, речь ${speechStart.toFixed(2)}–${speechEnd.toFixed(2)} с`);
groups.forEach((g) =>
  console.log(`  ${g.t0.toFixed(2)}–${g.t1.toFixed(2)}  ${words.slice(g.from, g.to + 1).join(" ")}`),
);
console.log(`→ ${target}`);
console.log("Готово");
