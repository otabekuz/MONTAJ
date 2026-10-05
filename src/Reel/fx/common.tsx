import type { Box } from "../layout";
import { FONT, type Palette } from "../theme";

/** Общие пропсы элемента: кадр считается от начала элемента (он внутри <Sequence>) */
export type FxProps<T> = {
  o: T;
  /** длительность элемента в кадрах результата */
  total: number;
  zone: Box;
  p: Palette;
  layout: "full" | "split" | "voice";
  lang: "uz" | "ru";
  /** секунда исходника → кадр от начала элемента (с учётом вырезки пауз и ускорения) */
  local: (sourceSec: number) => number;
};

/** Слой на всю зону графики, контент по центру */
export const Center: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Карточка тёмного мира */
export const panelStyle = (p: Palette): React.CSSProperties => ({
  background: `linear-gradient(180deg, ${p.panel} 0%, ${p.bg} 140%)`,
  border: `1.5px solid rgba(255,255,255,0.09)`,
  borderRadius: 36,
  boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
});

/** Маленькая метка над заголовком: «01», «xato», «3 qadam» */
export const Label: React.FC<{ text: string; p: Palette; opacity?: number; dark?: boolean }> = ({
  text,
  p,
  opacity = 1,
  dark,
}) =>
  text ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
        color: dark ? p.paperInk : p.accent,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: 6,
        textTransform: "uppercase",
      }}
    >
      <div style={{ width: 42, height: 3, background: dark ? p.paperInk : p.accent, borderRadius: 2 }} />
      {text}
    </div>
  ) : null;

/** Размер шрифта, чтобы самая длинная строка влезла в ширину */
export const fitFont = (text: string, maxWidth: number, max: number, min: number, k = 0.56) => {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 1);
  return Math.max(min, Math.min(max, maxWidth / (longest * k)));
};

/** Разбить фразу на 1–2 строки примерно поровну */
export const balance = (text: string, maxChars = 14): string[] => {
  const words = text.trim().split(/\s+/);
  if (text.length <= maxChars || words.length < 2) return [text];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b);
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
};

/** Число с пробелами между тысячами: 125 000 */
export const formatNumber = (n: number, decimals = 0) => {
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${spaced},${dec}` : spaced;
};
