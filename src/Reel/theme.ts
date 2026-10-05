// Палитры роликов. Выбирается полем `palette` в edit.json.
// Три мира: тёмный (основной), заливка акцентом (`slam`, один удар), светлая «бумага» (`paper`).
// Акцент — не больше ~10% кадра: он работает, пока редкий.

export type Palette = {
  label: string;
  // тёмный мир
  bg: string;
  panel: string;
  line: string;
  text: string;
  muted: string;
  // акцент: подсветка слов, метки, результат
  accent: string;
  accentSoft: string;
  // текст на заливке акцентом (slam, плашки)
  onAccent: string;
  // светлый мир
  paper: string;
  paperInk: string;
  paperMuted: string;
  // «металл» для крупных цифр (как «$17 M» на образце)
  metal: [string, string, string, string];
  // отметка «плохо» (перечёркивание, ошибка) — приглушённая, не спорит с акцентом
  bad: string;
};

export const PALETTES = {
  // Небо — светлый голубой, как цифра на образце. Спокойно, дорого, читается на любом фоне.
  sky: {
    label: "Небо",
    bg: "#0A1017",
    panel: "#16212C",
    line: "rgba(168,216,245,0.10)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.62)",
    accent: "#A8D8F5",
    accentSoft: "rgba(168,216,245,0.18)",
    onAccent: "#06233A",
    paper: "#F3F8FC",
    paperInk: "#0D1A25",
    paperMuted: "#6B7F90",
    metal: ["#F6FBFF", "#BCD9EF", "#7E9FBE", "#E4F1FB"],
    bad: "#F2A7A0",
  },
  // Шампань — светлое тёплое золото. Премиальная недвижимость, вечерний свет.
  champagne: {
    label: "Шампань",
    bg: "#0F0D0B",
    panel: "#221E1A",
    line: "rgba(232,207,160,0.10)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.62)",
    accent: "#EBD3A6",
    accentSoft: "rgba(235,211,166,0.18)",
    onAccent: "#2A1E0C",
    paper: "#F8F2E8",
    paperInk: "#1E1810",
    paperMuted: "#8A7B66",
    metal: ["#FFF8EA", "#EBD3A6", "#B79A6B", "#F5E6C8"],
    bad: "#F0A99C",
  },
  // Шалфей — светлый мятно-зелёный. Свежо, «зелёный район», семейное жильё.
  sage: {
    label: "Шалфей",
    bg: "#0C110E",
    panel: "#19221C",
    line: "rgba(191,227,198,0.10)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.62)",
    accent: "#BFE6C8",
    accentSoft: "rgba(191,230,200,0.18)",
    onAccent: "#0F2F1A",
    paper: "#F3F7F1",
    paperInk: "#142019",
    paperMuted: "#6E8274",
    metal: ["#F6FCF7", "#CBE8D2", "#88B293", "#E5F4E8"],
    bad: "#F2A7A0",
  },
  // Пудра — светлый персиково-розовый. Мягко, тепло, уют.
  blush: {
    label: "Пудра",
    bg: "#110D0D",
    panel: "#241B1B",
    line: "rgba(246,200,186,0.10)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.62)",
    accent: "#F7CBBD",
    accentSoft: "rgba(247,203,189,0.18)",
    onAccent: "#3A1A12",
    paper: "#FBF3EF",
    paperInk: "#241614",
    paperMuted: "#937A73",
    metal: ["#FFF7F3", "#F4CFC3", "#BE8E80", "#FAE6DE"],
    bad: "#E79A92",
  },
  // Monolith — исходный стиль скилла (чёрный, белый, красный). Для совместимости со старыми планами.
  monolith: {
    label: "Monolith",
    bg: "#000000",
    panel: "#2A2A2A",
    line: "rgba(255,255,255,0.07)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.6)",
    accent: "#E10600",
    accentSoft: "rgba(225,6,0,0.2)",
    onAccent: "#000000",
    paper: "#FFFFFF",
    paperInk: "#0A0A0A",
    paperMuted: "#777777",
    metal: ["#FFFFFF", "#D9D9D9", "#8C8C8C", "#F2F2F2"],
    bad: "#E10600",
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
export const DEFAULT_PALETTE: PaletteName = "sky";

export const getPalette = (name: string | undefined): Palette =>
  PALETTES[(name as PaletteName) ?? DEFAULT_PALETTE] ?? PALETTES[DEFAULT_PALETTE];

export const FONT = "'Inter Tight', 'Helvetica Neue', Arial, sans-serif";
export const SERIF = "'Playfair Display', Georgia, serif";

export const metalGradient = (p: Palette) =>
  `linear-gradient(175deg, ${p.metal[0]} 0%, ${p.metal[1]} 38%, ${p.metal[2]} 55%, ${p.metal[3]} 78%, ${p.metal[1]} 100%)`;
