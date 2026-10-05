// npm run music
// Синтезирует свою фоновую музыку (без чужих треков и лицензий) → public/music/montaj-calm.webm и montaj-pulse.webm.
// 96 BPM, ля минор: Am – F – C – G по 2 такта, 24 такта = 60 с, бесшовная петля (ролик зацикливает её сам).
//   calm  — тёплые аккорды, бас, мягкий перебор: для спокойных роликов, советов, разборов;
//   pulse — то же + аккуратные ударные: для динамичных роликов (боты, подборки, «до/после»).
// 48 кГц сразу — без пересчёта частоты (на Windows он роняет ffmpeg Remotion).
import fs from "node:fs";
import path from "node:path";
import { runFf } from "./lib/env.mjs";

const SR = 48000;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 24;
const LEN = BAR * BARS;
const N = Math.round(LEN * SR);
const OUT = path.join("public", "music");

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// аккорды: корень (бас) + три ноты пэда
const CHORDS = [
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [53, 57, 60] }, // F
  { root: 48, notes: [60, 64, 67] }, // C
  { root: 43, notes: [55, 59, 62] }, // G
];
const chordAt = (t) => CHORDS[Math.floor(t / (BAR * 2)) % CHORDS.length];

let seed = 7;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const render = (withDrums) => {
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const wetIn = new Float32Array(N);

  // пэд: аддитивная «пила» из 6 гармоник, по два расстроенных голоса на канал, мягкая атака на смене аккорда
  const chordLen = BAR * 2;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const c = chordAt(t);
    const tc = t % chordLen;
    const env = Math.min(1, tc / 0.5) * Math.min(1, (chordLen - tc) / 0.35 + 0.15);
    let l = 0;
    let r = 0;
    for (const m of c.notes) {
      const f = hz(m);
      for (let h = 1; h <= 6; h++) {
        const a = 1 / (h * h * 0.6 + h * 0.4);
        l += a * Math.sin(2 * Math.PI * f * h * 1.0016 * t);
        r += a * Math.sin(2 * Math.PI * f * h * 0.9984 * t + 0.7);
      }
    }
    const pad = 0.045 * env;
    L[i] += l * pad;
    R[i] += r * pad;
    wetIn[i] += (l + r) * pad * 0.5;
    // саб-бас на корне аккорда, слегка «дышит» по долям
    const tb = t % BEAT;
    const bassEnv = 0.75 + 0.25 * Math.exp(-tb * 5);
    const b = Math.tanh(1.4 * Math.sin(2 * Math.PI * hz(c.root) * t)) * 0.16 * bassEnv * Math.min(1, tc / 0.08);
    L[i] += b;
    R[i] += b;
  }

  // мягкий низкочастотный фильтр на пэд (убирает «пилу»)
  const lp = (buf, fc) => {
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      y += a * (buf[i] - y);
      buf[i] = y;
    }
  };
  lp(L, 2600);
  lp(R, 2600);

  // перебор: ноты аккорда вверх через октаву, восьмые (calm) или шестнадцатые (pulse), пинг-понг по каналам
  const step = withDrums ? BEAT / 4 : BEAT / 2;
  const steps = Math.floor(LEN / step);
  for (let k = 0; k < steps; k++) {
    const t0 = k * step;
    const c = chordAt(t0 + 0.001);
    const order = [0, 1, 2, 1];
    const m = c.notes[order[k % 4]] + 12 + (k % 8 >= 4 ? 7 : 0);
    const f = hz(m);
    const amp = (withDrums ? 0.05 : 0.065) * (k % 4 === 0 ? 1 : 0.75);
    const pan = k % 2 ? 0.7 : 0.3;
    const dur = Math.round(0.9 * SR);
    const s0 = Math.round(t0 * SR);
    for (let j = 0; j < dur && s0 + j < N; j++) {
      const tt = j / SR;
      const v = (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt)) * Math.exp(-tt * 7) * Math.min(1, tt / 0.004) * amp;
      L[s0 + j] += v * (1 - pan) * 1.4;
      R[s0 + j] += v * pan * 1.4;
      wetIn[s0 + j] += v * 0.8;
    }
  }

  if (withDrums) {
    for (let b = 0; b < BARS * 4; b++) {
      const t0 = b * BEAT;
      const s0 = Math.round(t0 * SR);
      // бочка на 1 и 3
      if (b % 2 === 0) {
        let ph = 0;
        for (let j = 0; j < 0.35 * SR && s0 + j < N; j++) {
          const tt = j / SR;
          ph += (2 * Math.PI * (42 + 70 * Math.exp(-tt * 28))) / SR;
          const v = Math.sin(ph) * Math.exp(-tt * 9) * 0.34;
          L[s0 + j] += v;
          R[s0 + j] += v;
        }
      }
      // мягкий хлопок на 2 и 4
      if (b % 2 === 1) {
        let y = 0;
        for (let j = 0; j < 0.22 * SR && s0 + j < N; j++) {
          const tt = j / SR;
          const n = rnd() * 2 - 1;
          y += 0.35 * (n - y);
          const v = (n - y) * Math.exp(-tt * 22) * 0.07;
          L[s0 + j] += v;
          R[s0 + j] += v;
          wetIn[s0 + j] += v * 0.6;
        }
      }
      // хэт на слабые восьмые
      const sh = Math.round((t0 + BEAT / 2) * SR);
      for (let j = 0; j < 0.05 * SR && sh + j < N; j++) {
        const tt = j / SR;
        const n = rnd() * 2 - 1;
        const v = n * Math.exp(-tt * 90) * 0.025;
        L[sh + j] += v * 0.8;
        R[sh + j] += v * 1.2;
      }
    }
  }

  // реверберация (Шрёдер): 4 гребенчатых + 2 всепропускающих, замкнута по кругу для бесшовной петли
  const reverb = (input) => {
    const out = new Float32Array(N);
    for (const [d, g] of [[1557, 0.8], [1617, 0.79], [1491, 0.81], [1422, 0.8]]) {
      const buf = new Float32Array(d);
      let k = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < N; i++) {
          const y = buf[k];
          buf[k] = input[i] + y * g;
          k = (k + 1) % d;
          if (pass === 1) out[i] += y * 0.25;
        }
      }
    }
    for (const [d, g] of [[225, 0.5], [556, 0.5]]) {
      const buf = new Float32Array(d);
      let k = 0;
      for (let i = 0; i < N; i++) {
        const x = out[i];
        const y = buf[k];
        buf[k] = x + y * g;
        out[i] = y - x * g;
        k = (k + 1) % d;
      }
    }
    return out;
  };
  const wet = reverb(wetIn);
  for (let i = 0; i < N; i++) {
    L[i] += wet[i] * 0.55;
    R[i] += wet[(i + 211) % N] * 0.55;
  }

  // одинаковая громкость у всех треков: RMS −18 dBFS, но пик не выше −1 dBFS
  let peak = 1e-9;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    sum += L[i] * L[i] + R[i] * R[i];
  }
  const rms = Math.sqrt(sum / (2 * N));
  const g = Math.min(Math.pow(10, -18 / 20) / rms, Math.pow(10, -1 / 20) / peak);
  const pcm = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
  }
  return pcm;
};

const wav = (pcm) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
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
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

fs.mkdirSync(OUT, { recursive: true });
console.log(`Музыка → ${OUT}/ (${BPM} BPM, ${LEN.toFixed(0)} с, петля)`);
for (const [name, drums] of [["montaj-calm", false], ["montaj-pulse", true]]) {
  const tmp = path.join(OUT, `${name}.tmp.wav`);
  fs.writeFileSync(tmp, wav(render(drums)));
  // Opus в WebM: открытый формат, играет в любом Chrome рендера (AAC есть не во всех сборках)
  await runFf(["-y", "-i", tmp, "-c:a", "libopus", "-b:a", "160k", "-f", "webm", path.join(OUT, `${name}.webm`)]);
  fs.rmSync(tmp);
  console.log(`  ${name}.webm`);
}
console.log("Готово");
