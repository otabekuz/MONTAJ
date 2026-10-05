// npm run align -- reels/<slug>
// Подставляет точный текст из reels/<slug>/script.md (раздел «Текст для генерации аватара»
// или «Текст для записи») на тайминги Whisper → public/reels/<slug>.captions.json.
// Whisper плохо пишет узбекские слова (иногда кириллицей), но время слов знает точно.
// Расхождение до ~25% — норма; больше — в script.md не тот текст, что реально прозвучал.
import fs from "node:fs";
import path from "node:path";

const arg = process.argv[2];
if (!arg) {
  console.error("Использование: npm run align -- reels/<slug>");
  process.exit(1);
}
const slug = path.basename(arg.replace(/[\\/]+$/, ""));
const scriptPath = path.join("reels", slug, "script.md");
const whisperPath = path.join("public", "reels", `${slug}.whisper.json`);
const captionsPath = path.join("public", "reels", `${slug}.captions.json`);

if (!fs.existsSync(scriptPath)) {
  console.error(`Нет ${scriptPath}`);
  process.exit(1);
}
const rawPath = fs.existsSync(whisperPath) ? whisperPath : captionsPath;
if (!fs.existsSync(rawPath)) {
  console.error(`Нет субтитров Whisper (${whisperPath}). Сначала npm run transcribe.`);
  process.exit(1);
}

// --- текст сценария ---
const md = fs.readFileSync(scriptPath, "utf8");
const section = (title) => {
  const re = new RegExp(`^##\\s*${title}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "m");
  return re.exec(md)?.[1];
};
let text = section("Текст для генерации аватара") ?? section("Текст для озвучки") ?? section("Текст для записи");
if (!text) {
  console.error("В script.md не найден раздел «## Текст для генерации аватара» (или «## Текст для записи»).");
  process.exit(1);
}
text = text
  .replace(/```[a-z]*\n?/g, "")
  .replace(/\[[A-ZА-ЯЁ/ ]+\]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const scriptWords = text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w));

// --- нормализация: кириллица → латиница (узбекская), без знаков ---
const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "",
  ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};
const norm = (w) =>
  w
    .toLowerCase()
    .split("")
    .map((c) => CYR[c] ?? c)
    .join("")
    .replace(/[ʻʼ‘’'`]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

const lev = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const sim = (a, b) => {
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
};

// --- выравнивание (Needleman–Wunsch по словам) ---
const whisper = JSON.parse(fs.readFileSync(rawPath, "utf8")).filter((c) => c.text.trim());
const A = scriptWords.map(norm);
const B = whisper.map((c) => norm(c.text));
const n = A.length;
const m = B.length;
const GAP = -0.45;
const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
const T = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 диаг, 2 вверх (пропуск слова сценария), 3 влево
for (let i = 1; i <= n; i++) {
  S[i][0] = i * GAP;
  T[i][0] = 2;
}
for (let j = 1; j <= m; j++) {
  S[0][j] = j * GAP;
  T[0][j] = 3;
}
for (let i = 1; i <= n; i++)
  for (let j = 1; j <= m; j++) {
    const d = S[i - 1][j - 1] + (sim(A[i - 1], B[j - 1]) * 2 - 0.7);
    const u = S[i - 1][j] + GAP;
    const l = S[i][j - 1] + GAP;
    if (d >= u && d >= l) {
      S[i][j] = d;
      T[i][j] = 1;
    } else if (u >= l) {
      S[i][j] = u;
      T[i][j] = 2;
    } else {
      S[i][j] = l;
      T[i][j] = 3;
    }
  }
const anchor = new Array(n).fill(null);
for (let i = n, j = m; i > 0 || j > 0; ) {
  const t = T[i][j];
  if (t === 1) {
    if (sim(A[i - 1], B[j - 1]) >= 0.34) anchor[i - 1] = { startMs: whisper[j - 1].startMs, endMs: whisper[j - 1].endMs, j: j - 1 };
    i--;
    j--;
  } else if (t === 2) i--;
  else j--;
}

// Whisper иногда режет одно слово на части («sotil» + «mayapti mi»): если между двумя соседними
// словами сценария остались лишние слова Whisper, отдаём их время следующему слову.
for (let k = 1; k < n; k++) {
  const a = anchor[k - 1];
  const b = anchor[k];
  if (a && b && b.j - a.j > 1) b.startMs = whisper[a.j + 1].startMs;
}
if (anchor[0] && anchor[0].j > 0) anchor[0].startMs = whisper[0].startMs;

// --- слова без пары: делим время между соседними опорами по длине слов ---
const firstMs = whisper[0]?.startMs ?? 0;
const lastMs = whisper[whisper.length - 1]?.endMs ?? 1000;
const out = scriptWords.map((w) => ({ text: w, startMs: 0, endMs: 0, timestampMs: null, confidence: null }));
let i = 0;
while (i < n) {
  if (anchor[i]) {
    out[i].startMs = anchor[i].startMs;
    out[i].endMs = anchor[i].endMs;
    i++;
    continue;
  }
  let j = i;
  while (j < n && !anchor[j]) j++;
  const from = i > 0 ? out[i - 1].endMs : firstMs;
  const to = j < n ? anchor[j].startMs : lastMs;
  const lens = scriptWords.slice(i, j).map((w) => Math.max(2, norm(w).length));
  const total = lens.reduce((a, b) => a + b, 0);
  let t = from;
  for (let k = i; k < j; k++) {
    const d = (Math.max(0, to - from) * lens[k - i]) / total;
    out[k].startMs = Math.round(t);
    out[k].endMs = Math.round(t + d);
    t += d;
  }
  i = j;
}
// монотонность
for (let k = 1; k < n; k++) {
  if (out[k].startMs < out[k - 1].startMs) out[k].startMs = out[k - 1].startMs;
  if (out[k].endMs < out[k].startMs) out[k].endMs = out[k].startMs + 60;
}

if (!fs.existsSync(whisperPath)) fs.copyFileSync(captionsPath, whisperPath);
fs.writeFileSync(captionsPath, JSON.stringify(out, null, 1));
const matched = anchor.filter(Boolean).length;
const miss = Math.round((1 - matched / Math.max(1, n)) * 100);
console.log(`Сценарий: ${n} слов, Whisper: ${m} слов, совпало ${matched} → расхождение ${miss}%`);
if (miss > 25) console.log("⚠ Расхождение больше 25%: впишите в script.md фактически произнесённый текст и повторите.");
console.log(`→ ${captionsPath}`);
console.log("Готово");
