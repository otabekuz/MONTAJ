// npm run tour-scan -- <slug | файл.mp4> [ещё файлы…]
// Разбор снятого материала перед монтажом обзора: по каждой 0,5 с — движение камеры, тряска, резкость,
// пересвет и темнота; итог — неудачные места, хорошие куски и естественные точки для склеек.
// Результат на каждый клип: out/scan/<имя>.txt (отчёт) и out/scan/<имя>.png (кадры каждые 0,5 с с временем).
// slug — все клипы из reels/<slug>/clips.json (после npm run tour-ingest).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { runFf } from "./lib/env.mjs";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Использование: npm run tour-scan -- <slug | файл.mp4> […]");
  process.exit(1);
}
const targets = args.flatMap((a) => {
  const list = path.join("reels", a, "clips.json");
  if (fs.existsSync(list)) return JSON.parse(fs.readFileSync(list, "utf8")).map((c) => ({ file: path.join("public", c.file), name: `${a}-${path.basename(c.file, ".mp4")}`, source: c.source }));
  if (fs.existsSync(a)) return [{ file: a, name: path.basename(a).replace(/\.[^.]+$/, ""), source: path.basename(a) }];
  console.error(`Не найдено: ${a}`);
  process.exit(1);
});

const AW = 90; // кадр анализа 90×160
const AH = 160;
const RATE = 10; // кадров анализа в секунду
const TW = 135; // миниатюра 135×240
const TH = 240;
const OUT = path.join("out", "scan");
fs.mkdirSync(OUT, { recursive: true });

// у ffmpeg Remotion нет фильтра fps и формата rawvideo: частота — через -r, кадры — через image2pipe
const gray = async (file, w, h, rate, pix = "gray") => {
  const tmp = path.join(OUT, `.raw-${process.pid}-${w}.bin`);
  await runFf(["-v", "error", "-y", "-i", file, "-an", "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, "-r", String(rate), "-pix_fmt", pix, "-c:v", "rawvideo", "-f", "image2pipe", tmp]);
  const buf = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  const size = w * h * (pix === "rgb24" ? 3 : 1);
  return Array.from({ length: Math.floor(buf.length / size) }, (_, i) => buf.subarray(i * size, (i + 1) * size));
};

// сдвиг кадра b относительно a (поиск по блокам ±R пикселей) и остаток после сдвига
const shift = (a, b, R = 7) => {
  let best = { dx: 0, dy: 0, err: Infinity };
  const m = R + 4;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      let s = 0;
      for (let y = m; y < AH - m; y += 2) {
        const ra = y * AW;
        const rb = (y + dy) * AW + dx;
        for (let x = m; x < AW - m; x += 2) s += Math.abs(a[ra + x] - b[rb + x]);
      }
      if (s < best.err) best = { dx, dy, err: s };
    }
  }
  const n = ((AH - 2 * m) / 2) * ((AW - 2 * m) / 2);
  return { dx: best.dx, dy: best.dy, resid: best.err / n };
};

const stats = (g) => {
  let sum = 0;
  let hi = 0;
  let lo = 0;
  let lap = 0;
  for (let i = 0; i < g.length; i++) {
    sum += g[i];
    if (g[i] >= 248) hi++;
    if (g[i] <= 10) lo++;
  }
  for (let y = 1; y < AH - 1; y++) {
    for (let x = 1; x < AW - 1; x++) {
      const i = y * AW + x;
      const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - AW] - g[i + AW];
      lap += l * l;
    }
  }
  return { mean: sum / g.length, hi: hi / g.length, lo: lo / g.length, sharp: lap / ((AW - 2) * (AH - 2)) };
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const fmt = (t) => `${t.toFixed(1)}с`;

// --- PNG и цифры для подписей миниатюр ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();
const png = (w, h, rgb) => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(CRC(td));
    return Buffer.concat([len, td, crc]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
const FONT = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  ".": "000000000000010", "!": "010010010000010",
};
const text = (img, W, x0, y0, s, color, k = 3) => {
  let x = x0;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] !== "1") continue;
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
          const i = ((y0 + r * k + yy) * W + x + c * k + xx) * 3;
          img[i] = color[0];
          img[i + 1] = color[1];
          img[i + 2] = color[2];
        }
      }
    }
    x += 4 * k;
  }
};

for (const { file, name, source } of targets) {
  process.stdout.write(`${source} … `);
  const frames = await gray(file, AW, AH, RATE);
  const n = frames.length;
  const st = frames.map(stats);
  const mv = [{ dx: 0, dy: 0, resid: 0 }];
  for (let i = 1; i < n; i++) mv.push(shift(frames[i - 1], frames[i]));
  // скорость движения (в пикселях полного кадра 1080 в секунду) и тряска — дёрганье относительно сглаженного движения
  const k = 1080 / AW;
  const speed = mv.map((m) => Math.hypot(m.dx, m.dy) * k * RATE + m.resid * 40);
  const sm = (arr, r) => arr.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(arr.length - 1, i + r); j++) {
      s += arr[j];
      c++;
    }
    return s / c;
  });
  const sdx = sm(mv.map((m) => m.dx), 3);
  const sdy = sm(mv.map((m) => m.dy), 3);
  const jitter = mv.map((m, i) => Math.hypot(m.dx - sdx[i], m.dy - sdy[i]) * k);
  const sharpMed = median(st.map((s) => s.sharp));

  // по полсекунды
  const rows = [];
  for (let t0 = 0; t0 * RATE < n; t0 += 0.5) {
    const a = Math.round(t0 * RATE);
    const b = Math.min(n, a + RATE / 2);
    const slice = (arr) => arr.slice(a, b);
    const avg = (arr) => arr.reduce((s, x) => s + x, 0) / Math.max(1, arr.length);
    rows.push({
      t: t0,
      speed: avg(slice(speed)),
      jitter: avg(slice(jitter)),
      sharp: avg(slice(st).map((s) => s.sharp)) / (sharpMed || 1),
      mean: avg(slice(st).map((s) => s.mean)),
      hi: avg(slice(st).map((s) => s.hi)),
      lo: avg(slice(st).map((s) => s.lo)),
      dx: avg(slice(mv).map((m) => m.dx)),
    });
  }
  const dur = n / RATE;
  const speedMed = median(rows.map((r) => r.speed));

  // флаги и диапазоны
  const flag = (r) => {
    const f = [];
    // тряска — дёрганье поверх плавного движения; на быстрых поворотах допускаем больше
    if (r.jitter > 14 + 0.02 * r.speed && r.speed < Math.max(400, speedMed * 3)) f.push("тряска");
    if (r.sharp < 0.45 && r.speed < speedMed * 2) f.push("нерезко");
    if (r.hi > 0.12) f.push("пересвет");
    if (r.mean < 55) f.push("темно");
    if (r.speed < Math.min(60, speedMed * 0.15)) f.push("стоит");
    if (r.speed > Math.max(400, speedMed * 3)) f.push("рывок");
    return f;
  };
  const ranges = (label) => {
    const out = [];
    let s = null;
    rows.forEach((r, i) => {
      const on = flag(r).includes(label);
      if (on && s === null) s = r.t;
      if ((!on || i === rows.length - 1) && s !== null) {
        out.push([s, on ? r.t + 0.5 : r.t]);
        s = null;
      }
    });
    return out;
  };
  const ok = rows.map((r) => !flag(r).some((x) => ["тряска", "нерезко", "пересвет", "темно"].includes(x)));
  const good = [];
  let gs = null;
  ok.forEach((v, i) => {
    if (v && gs === null) gs = rows[i].t;
    if ((!v || i === ok.length - 1) && gs !== null) {
      const end = v ? rows[i].t + 0.5 : rows[i].t;
      if (end - gs >= 1.5) good.push([gs, end]);
      gs = null;
    }
  });

  const lines = [];
  lines.push(`Разбор: ${source}  (${dur.toFixed(1)} с)`);
  lines.push(`Обычная скорость проводки в этом клипе: ${speedMed.toFixed(0)} (столбец «скорость» сравнивать с ней)`);
  const say = (label, text) => {
    const r = ranges(label);
    if (r.length) lines.push(`${text}: ${r.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(", ")}`);
  };
  say("тряска", "⚠ Тряска (в монтаж не брать или ускорять ≥2×)");
  say("нерезко", "⚠ Нерезко / смаз (фокус, грязный объектив, мало света)");
  say("пересвет", "⚠ Пересвет (окна «выбиты» — зафиксировать экспозицию долгим нажатием и убавить на шаг)");
  say("темно", "⚠ Темно (включить весь свет, открыть шторы)");
  say("стоит", "· Камера стоит на месте (годится для детали 1–2 с, дольше — скучно)");
  say("рывок", "↯ Резкие повороты — естественные точки для склейки whip");
  lines.push(`✓ Хорошие куски для монтажа: ${good.length ? good.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(", ") : "нет длиннее 1,5 с"}`);
  lines.push("");
  lines.push("  время  скорость  тряска  резкость  яркость  пересвет  отметки");
  for (const r of rows) {
    lines.push(
      `${fmt(r.t).padStart(7)} ${r.speed.toFixed(0).padStart(8)} ${r.jitter.toFixed(1).padStart(7)} ${r.sharp.toFixed(2).padStart(9)} ${r.mean.toFixed(0).padStart(8)} ${(r.hi * 100).toFixed(0).padStart(8)}%  ${flag(r).join(", ")}`,
    );
  }
  fs.writeFileSync(path.join(OUT, `${name}.txt`), lines.join("\n") + "\n");

  // контактный лист: кадр каждые 0,5 с (не больше 96), 8 в ряд, время и «!» на проблемных
  const step = Math.max(0.5, Math.ceil((dur / 96) * 2) / 2);
  const thumbs = await gray(file, TW, TH, 1 / step, "rgb24");
  const cols = 8;
  const rws = Math.ceil(thumbs.length / cols);
  const IW = cols * TW;
  const IH = rws * TH;
  const img = Buffer.alloc(IW * IH * 3);
  thumbs.forEach((th, i) => {
    const ox = (i % cols) * TW;
    const oy = Math.floor(i / cols) * TH;
    for (let y = 0; y < TH; y++) th.copy(img, ((oy + y) * IW + ox) * 3, y * TW * 3, (y + 1) * TW * 3);
    const t = i * step;
    const r = rows[Math.min(rows.length - 1, Math.round(t / 0.5))];
    const bad = r && !ok[rows.indexOf(r)];
    for (let y = 0; y < 21; y++) for (let x = 0; x < TW; x++) {
      const j = ((oy + y) * IW + ox + x) * 3;
      img[j] = bad ? 150 : 0;
      img[j + 1] = 0;
      img[j + 2] = 0;
    }
    text(img, IW, ox + 4, oy + 3, `${t.toFixed(1)}${bad ? "!" : ""}`, [255, 230, 80]);
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), png(IW, IH, img));
  console.log(`→ ${path.join(OUT, `${name}.txt`)}, .png`);
  console.log(lines.slice(1, lines.indexOf("")).map((l) => `   ${l}`).join("\n"));
}
console.log("Готово");
