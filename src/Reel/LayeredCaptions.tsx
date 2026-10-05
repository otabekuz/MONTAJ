import type { Caption } from "@remotion/captions";
import { interpolate, useCurrentFrame } from "remotion";
import { normWord } from "./Captions";
import type { Timeline } from "./cuts";
import { EASE_IN, EASE_OUT } from "./motion";
import { FONT, type Palette } from "./theme";
import { W } from "./layout";

// Система субтитров layered (по образцу ролика риелтора), уровни 2 и 3 — спереди, поверх человека:
//   уровень 2 — «две строки»: сверху тонко и мелко, снизу жирно и крупно главное слово (в фразе есть слово из highlightWords);
//   уровень 3 — «шёпот»: 1–3 слова тонким шрифтом, мелко, слегка прозрачно (всё остальное, ~70% ролика).
// Слова, которые в этот момент показаны гигантом за спиной, спереди не дублируются.
// Появление — из размытия с подъёмом, уход — в размытие.

type Word = { text: string; from: number; to: number; hl: boolean };
type Page = { words: Word[]; from: number; to: number };

const MAX_WORDS = 3;
const MAX_CHARS = 18;
const clean = (s: string) => s.replace(/[.,!?;:…]+$/u, "");
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const buildLayeredPages = (
  captions: Caption[],
  tl: Timeline,
  highlight: Set<string>,
  giantAt: (frame: number, word: string) => boolean,
): Page[] => {
  const words: Word[] = captions
    .filter((c) => c.text.trim())
    .map((c) => ({ text: c.text.trim(), from: tl.toFrame(c.startMs / 1000), to: tl.toFrame(c.endMs / 1000), hl: highlight.has(normWord(c.text)) }))
    .filter((w) => !giantAt(w.from, w.text));
  const pages: Page[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) pages.push({ words: cur, from: cur[0].from, to: cur[cur.length - 1].to });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const gap = prev ? w.from - prev.to : 0;
    const prevEnds = prev ? /[.!?…,;:—]$/.test(prev.text) : false;
    // главное слово закрывает фразу: после него — новая страница
    const prevHl = prev ? prev.hl && cur.includes(prev) : false;
    if (cur.length && (cur.length >= MAX_WORDS || chars > MAX_CHARS || gap > 9 || prevEnds || prevHl)) flush();
    cur.push(w);
  });
  flush();
  return pages.map((pg, i) => ({ ...pg, to: Math.min(pages[i + 1]?.from ?? Infinity, pg.to + 14) }));
};

export const LayeredCaptions: React.FC<{
  pages: Page[];
  p: Palette;
  y: number;
  hidden: (frame: number) => boolean;
}> = ({ pages, p, y, hidden }) => {
  const f = useCurrentFrame();
  if (hidden(f)) return null;
  const page = pages.find((pg) => f >= pg.from - 2 && f < pg.to);
  if (!page) return null;

  const hlIndex = page.words.findIndex((w) => w.hl);
  const tier2 = hlIndex >= 0;
  const top = tier2 ? page.words.slice(0, hlIndex) : [];
  const bottom = tier2 ? page.words.slice(hlIndex) : page.words;

  const inT = interpolate(f, [page.from - 2, page.from + 5], [0, 1], { ...clamp, easing: EASE_OUT });
  const outT = interpolate(f, [page.to - 5, page.to], [0, 1], { ...clamp, easing: EASE_IN });
  const vis = inT * (1 - outT);
  const blur = (1 - inT) * 14 + outT * 12;

  const bottomText = bottom.map((w) => clean(w.text)).join(" ");
  const bigSize = Math.max(64, Math.min(118, (W - 140) / (bottomText.length * 0.56)));
  const thinSize = tier2 ? 56 : Math.max(50, Math.min(66, (W - 140) / (bottomText.length * 0.5)));

  const word = (w: Word, size: number, weight: number, key: number, alpha: number) => {
    const t = interpolate(f, [w.from - 2, w.from + 4], [0, 1], { ...clamp, easing: EASE_OUT });
    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          margin: `0 ${size * 0.12}px`,
          fontFamily: FONT,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 0.92,
          letterSpacing: -size * (weight > 500 ? 0.04 : 0.02),
          color: `rgba(255,255,255,${alpha})`,
          opacity: 0.25 + 0.75 * t,
          // тонкий шрифт часто стоит на светлой одежде — тень плотнее, чтобы читался
          textShadow:
            weight > 500
              ? `0 6px 26px rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.35), 0 0 40px ${p.accentSoft}`
              : "0 2px 10px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.55), 0 0 22px rgba(0,0,0,0.35)",
        }}
      >
        {clean(w.text)}
      </span>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity: vis,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        transform: `translateY(-50%) translateY(${(1 - inT) * 16 - outT * 8}px)`,
      }}
    >
      {tier2 ? (
        <>
          {top.length ? <div style={{ marginBottom: -4 }}>{top.map((w, i) => word(w, thinSize, 300, i, 0.95))}</div> : null}
          <div>{bottom.map((w, i) => word(w, w.hl ? bigSize : bigSize * 0.8, w.hl ? 800 : 300, i, 1))}</div>
        </>
      ) : (
        <div>{bottom.map((w, i) => word(w, thinSize, 300, i, 0.88))}</div>
      )}
    </div>
  );
};
