// npm run sfx — синтезирует звуки ролика в public/sfx/*.wav.
// Свои звуки, без скачивания и чужих лицензий: удар, нарастание, блеск, глитч, pop, tick.
// Whoosh намеренно нет — владелец скилла убрал его как дешёвый.
import fs from "node:fs";
import path from "node:path";

// 48 кГц, как у ролика: пересчёт частоты в ffmpeg Remotion на Windows падает (0xC0000005)
const SR = 48000;
const OUT = path.join(process.cwd(), "public", "sfx");

let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

const make = (seconds, fn) => {
  const n = Math.round(seconds * SR);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = fn(i / SR, i);
  return buf;
};

/** простой однополюсный фильтр нижних частот */
const lowpass = (buf, cutoffAt) => {
  const out = new Float32Array(buf.length);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const fc = cutoffAt(i / SR);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += a * (buf[i] - y);
    out[i] = y;
  }
  return out;
};
const highpass = (buf, fc) => {
  const lp = lowpass(buf, () => fc);
  return buf.map((v, i) => v - lp[i]);
};

const normalize = (buf, peakDb = -3) => {
  const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  const g = Math.pow(10, peakDb / 20) / peak;
  return buf.map((v) => v * g);
};

const fadeEdges = (buf, inS = 0.002, outS = 0.02) => {
  const a = Math.round(inS * SR);
  const b = Math.round(outS * SR);
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
};

const writeWav = (name, mono) => {
  const n = mono.length;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, mono[i]));
    const s = Math.round(v * 32767);
    data.writeInt16LE(s, i * 4);
    data.writeInt16LE(s, i * 4 + 2);
  }
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
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`  ${name}.wav  ${(n / SR).toFixed(2)} с`);
};

const sounds = {
  // pop: короткий «бульк» с падением высоты
  pop: () => {
    let ph = 0;
    return make(0.12, (t) => {
      const f = 380 + 700 * Math.exp(-t * 45);
      ph += (2 * Math.PI * f) / SR;
      return Math.sin(ph) * Math.exp(-t * 38);
    });
  },
  // tick: сухой щелчок
  tick: () => {
    const b = make(0.05, (t) => (Math.sin(2 * Math.PI * 2400 * t) * 0.6 + noise() * 0.5) * Math.exp(-t * 160));
    return highpass(b, 900);
  },
  // impact: низкий удар + щелчок атаки + хвост
  impact: () => {
    let ph = 0;
    const body = make(1.2, (t) => {
      const f = 34 + 60 * Math.exp(-t * 9);
      ph += (2 * Math.PI * f) / SR;
      return Math.sin(ph) * Math.exp(-t * 3.2);
    });
    const crackRaw = make(1.2, (t) => noise() * Math.exp(-t * 30));
    const crack = lowpass(crackRaw, (t) => 2600 * Math.exp(-t * 6) + 200);
    return body.map((v, i) => v * 1.0 + crack[i] * 0.55);
  },
  // riser: нарастание 1,6 с, упирается в момент и обрывается
  riser: () => {
    const len = 1.6;
    const raw = make(len, () => noise());
    const filt = lowpass(raw, (t) => 300 + 6000 * Math.pow(t / len, 2.2));
    let ph = 0;
    return fadeEdges(
      filt.map((v, i) => {
        const t = i / SR;
        const f = 180 + 900 * Math.pow(t / len, 1.8);
        ph += (2 * Math.PI * f) / SR;
        const amp = Math.pow(t / len, 1.6);
        return (v * 0.9 + Math.sin(ph) * 0.25) * amp;
      }),
      0.01,
      0.015,
    );
  },
  // shine: светлый блеск из трёх высоких нот
  shine: () => {
    const notes = [2093, 2637, 3136, 4186];
    return make(1.1, (t) => {
      let v = 0;
      notes.forEach((f, k) => {
        const on = k * 0.045;
        if (t < on) return;
        const tt = t - on;
        v += Math.sin(2 * Math.PI * f * tt * (1 + 0.002 * Math.sin(2 * Math.PI * 6 * tt))) * Math.exp(-tt * 4.5) * (1 - k * 0.15);
      });
      return v;
    });
  },
  // glitch: рваные цифровые всплески
  glitch: () => {
    const chunks = [];
    let t0 = 0;
    while (t0 < 0.32) {
      const len = 0.015 + rnd() * 0.04;
      const kind = rnd();
      const f = 200 + rnd() * 1800;
      chunks.push({ t0, len, kind, f });
      t0 += len + rnd() * 0.02;
    }
    return make(0.36, (t) => {
      const c = chunks.find((x) => t >= x.t0 && t < x.t0 + x.len);
      if (!c) return 0;
      const local = t - c.t0;
      const sq = Math.sign(Math.sin(2 * Math.PI * c.f * local));
      const crushed = Math.round(noise() * 4) / 4;
      return (c.kind > 0.5 ? sq * 0.6 : crushed) * (1 - t / 0.4);
    });
  },
};

fs.mkdirSync(OUT, { recursive: true });
console.log("Звуки → public/sfx/");
for (const [name, fn] of Object.entries(sounds)) {
  writeWav(name, normalize(fadeEdges(fn())));
}
console.log("Готово");
