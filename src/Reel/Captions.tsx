import type { Caption } from "@remotion/captions";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Timeline } from "./cuts";
import { FONT, type Palette } from "./theme";
import { W } from "./layout";

// Субтитры по образцу (docs/subtitle-style-reference.png):
// белый жирный гротеск, две строки по центру — короткая сверху, главное слово крупно снизу.
// Фраза появляется целиком, звучащее слово чуть крупнее; ключевые слова — акцентным цветом.

type Word = { text: string; from: number; to: number };
type Page = { words: Word[]; from: number; to: number };

export const normWord = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}'ʻʼ‘’]/gu, "").replace(/[ʻʼ‘’]/g, "'");

const MAX_WORDS = 4;
const MAX_CHARS = 22;

export const buildPages = (captions: Caption[], tl: Timeline): Page[] => {
  const words: Word[] = captions
    .filter((c) => c.text.trim())
    .map((c) => ({ text: c.text.trim(), from: tl.toFrame(c.startMs / 1000), to: tl.toFrame(c.endMs / 1000) }));
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
    const prevEnds = prev ? /[.!?…]$/.test(prev.text) || (/[,;:—]$/.test(prev.text) && cur.length >= 2) : false;
    if (cur.length && (cur.length >= MAX_WORDS || chars > MAX_CHARS || gap > 12 || prevEnds)) flush();
    cur.push(w);
  });
  flush();
  // страница держится до следующей, но не дольше 0,6 с после последнего слова
  return pages.map((pg, i) => ({ ...pg, to: Math.min(pages[i + 1]?.from ?? Infinity, pg.to + 18) }));
};

const clean = (s: string) => s.replace(/[.,!?;:…]+$/u, "");

export const Captions: React.FC<{
  pages: Page[];
  highlight: Set<string>;
  p: Palette;
  y: number;
  hidden: (frame: number) => boolean;
}> = ({ pages, highlight, p, y, hidden }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (hidden(f)) return null;
  const page = pages.find((pg) => f >= pg.from && f < pg.to);
  if (!page) return null;

  // нижняя (крупная) строка — последнее слово; если оно короткое — два последних
  const ws = page.words;
  let split = ws.length - 1;
  if (ws.length >= 3 && clean(ws[ws.length - 1].text).length <= 3) split = ws.length - 2;
  if (ws.length === 1) split = 0;
  const top = ws.slice(0, split);
  const bottom = ws.slice(split);

  const bottomText = bottom.map((w) => clean(w.text)).join(" ");
  const big = Math.max(84, Math.min(150, (W - 160) / (bottomText.length * 0.6)));
  const topText = top.map((w) => clean(w.text)).join(" ");
  const small = Math.max(48, Math.min(72, (W - 160) / (topText.length * 0.56 || 1)));

  const pageIn = interpolate(f, [page.from - 1, page.from + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // фраза появляется целиком (строка не прыгает), звучащее слово чуть крупнее
  const renderWord = (w: Word, size: number, weight: number, key: number) => {
    const hl = highlight.has(normWord(w.text));
    const speaking = f >= w.from && f < w.to + 2;
    const k = speaking ? interpolate(f, [w.from, w.from + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
    const bump = hl ? Math.max(0, Math.sin(Math.min(1, (f - w.from) / (0.3 * fps)) * Math.PI)) * 0.08 : 0;
    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          fontFamily: FONT,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 0.98,
          letterSpacing: -size * 0.035,
          color: hl ? p.accent : "#FFFFFF",
          transform: `scale(${1 + 0.05 * k + (f >= w.from ? bump : 0)})`,
          textShadow: "0 4px 22px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.35)",
          margin: `0 ${size * 0.13}px`,
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
        left: 60,
        right: 60,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity: pageIn,
        transform: `translateY(-50%) translateY(${(1 - pageIn) * 18}px) scale(${0.94 + 0.06 * pageIn})`,
      }}
    >
      {top.length ? <div style={{ marginBottom: 2 }}>{top.map((w, i) => renderWord(w, small, 800, i))}</div> : null}
      <div>{bottom.map((w, i) => renderWord(w, big, 900, i))}</div>
    </div>
  );
};
