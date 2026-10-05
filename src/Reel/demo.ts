import type { Caption } from "@remotion/captions";
import type { Overlay, ReelProps } from "./schema";

// Демо-ролики для Studio: показывают элементы и палитры без настоящего видео.
// Цифры и факты здесь условные — в настоящие ролики идут только реальные данные владельца.

/** Искусственные субтитры: слова идут с темпом живой речи */
const fakeCaptions = (text: string): Caption[] => {
  let t = 0.25;
  return text.split(/\s+/).map((w) => {
    const dur = 0.14 + w.replace(/[^\p{L}\p{N}]/gu, "").length * 0.052;
    const c: Caption = { text: w, startMs: Math.round(t * 1000), endMs: Math.round((t + dur) * 1000), timestampMs: null, confidence: 1 };
    t += dur + (/[.!?—,:]$/.test(w) ? 0.3 : 0.04);
    return c;
  });
};

const base = (lang: "uz" | "ru", layout: ReelProps["layout"], text: string) => {
  const captions = fakeCaptions(text);
  const at = (i: number) => captions[i].startMs / 1000;
  const end = captions[captions.length - 1].endMs / 1000;
  return { captions, at, end, lang, layout };
};

const UZ =
  "Kvartirangiz oylab sotilmayaptimi? Gap narxda emas. Qarang: hamma e'lonlar bir xil. Qorong'i rasm, quruq matn, narx yo'q. Xaridor o'tib ketadi. Endi boshqacha qilamiz. Yorug' rasm, aniq narx, joylashuv. Natija — e'lon ajralib turadi. Izohga UY deb yozing, ro'yxatni yuboraman.";

const RU =
  "Квартира месяцами не продаётся? Дело не в цене. Посмотрите: все объявления одинаковые. Тёмные фото, сухой текст, нет цены. Покупатель листает дальше. Делаем иначе. Светлые фото, точная цена, локация. Итог — объявление выделяется. Напишите ДОМ в комментариях — пришлю чек-лист.";

const common = {
  videoFile: "",
  captionsFile: "",
  cutPauses: false,
  speed: 1,
  beats: [],
  autoFraming: true,
  sfx: true,
  musicFile: "",
  ctaSeconds: 3,
  zooms: [],
};

const build = (
  lang: "uz" | "ru",
  layout: ReelProps["layout"],
  palette: ReelProps["palette"],
  overlays: (at: (i: number) => number) => Overlay[],
): ReelProps => {
  const d = base(lang, layout, lang === "uz" ? UZ : RU);
  const uz = lang === "uz";
  return {
    ...common,
    layout,
    lang,
    palette,
    fallbackSeconds: d.end + 0.4,
    captions: d.captions,
    hook: uz ? "Kvartira sotilmayaptimi?" : "Квартира не продаётся?",
    hookSeconds: d.at(3),
    highlightWords: uz ? ["emas", "bir", "xil", "ajralib", "UY", "boshqacha"] : ["не", "цене", "одинаковые", "выделяется", "ДОМ", "иначе"],
    overlays: overlays(d.at),
    transitions: [
      { at: d.at(6) - 0.1, type: "smear" },
      { at: d.at(20) - 0.1, type: "flash" },
      { at: d.at(28) - 0.1, type: "smear" },
    ],
    cues: [{ at: d.at(28), sound: "riser", volume: 0.3 }],
    cta: uz ? "Izohga UY deb yozing" : "Напишите ДОМ в комментариях",
    autoFraming: layout !== "voice",
  };
};

// full — спикер на весь экран, графика порциями
export const demoFull = (lang: "uz" | "ru" = "uz", palette: ReelProps["palette"] = "sky") =>
  build(lang, "full", palette, (at) => [
    { type: "typed", at: at(3), dur: at(6) - at(3) - 0.05, text: lang === "uz" ? "Gap narxda emas" : "Дело не в цене", em: lang === "uz" ? "emas" : "не" },
    { type: "clones", at: at(7), dur: at(17) - at(7) - 0.05, labels: lang === "uz" ? ["Qorong'i rasm", "Quruq matn", "Narx yo'q"] : ["Тёмные фото", "Сухой текст", "Нет цены"], marks: [0.42, 0.62, 0.8] },
    { type: "number", at: at(23), dur: at(28) - at(23) - 0.05, value: 85000, prefix: "$", suffix: "", label: lang === "uz" ? "aniq narx" : "точная цена" },
    { type: "morph", at: at(28), dur: at(32) - at(28) + 0.2, before: lang === "uz" ? "oddiy e'lon" : "обычное", after: lang === "uz" ? "ajralib turadi" : "выделяется" },
  ]);

// split — спикер снизу, монтаж сверху, графика встык
export const demoSplit = (palette: ReelProps["palette"] = "sky") =>
  build("uz", "split", palette, (at) => [
    { type: "title", at: at(3), dur: at(6) - at(3) - 0.05, text: "Narxda emas", sub: "muammo" },
    { type: "clones", at: at(6), dur: at(17) - at(6) - 0.05, labels: ["Qorong'i rasm", "Quruq matn", "Narx yo'q"], marks: [0.45, 0.64, 0.82] },
    { type: "accent", at: at(17), dur: at(20) - at(17) - 0.05, text: "O'tib ketadi", emoji: "" },
    { type: "title", at: at(20), dur: at(23) - at(20) - 0.05, text: "Boshqacha", sub: "yechim" },
    {
      type: "property",
      at: at(23),
      dur: at(28) - at(23) - 0.05,
      title: "3 xonali kvartira",
      price: "$85 000",
      place: "Yunusobod",
      image: "",
      specs: [
        { icon: "rooms", label: "3 xona" },
        { icon: "area", label: "78 m²" },
        { icon: "view", label: "7/9" },
      ],
    },
    { type: "location", at: at(28), dur: at(32) - at(28) + 0.2, place: "Yunusobod", sub: "metroga yaqin" },
  ]);

// voice — только голос, графика на весь экран встык
export const demoVoice = (palette: ReelProps["palette"] = "sky") =>
  build("uz", "voice", palette, (at) => [
    { type: "icon", at: 0.2, dur: at(3) - 0.25, items: [{ icon: "apartment", label: "" }] },
    { type: "typed", at: at(3), dur: at(6) - at(3) - 0.05, text: "Gap narxda emas", em: "emas" },
    { type: "compare", at: at(6), dur: at(17) - at(6) - 0.05, bad: "Qorong'i rasm, quruq matn", good: "Yorug' rasm, aniq narx", badLabel: "Oldin", goodLabel: "Keyin" },
    { type: "slam", at: at(17), dur: at(20) - at(17) - 0.05, text: "E'LON", em: "xaridor o'tib ketadi" },
    {
      type: "paper",
      at: at(20),
      dur: at(28) - at(20) - 0.05,
      tag: "E'LON",
      title: "to'g'ri",
      items: [
        { text: "Yorug' rasm", mark: "v" },
        { text: "Aniq narx", mark: "v" },
        { text: "Joylashuv", mark: "v" },
      ],
    },
    { type: "flow", at: at(28), dur: at(32) - at(28) + 0.2, nodes: [{ label: "Rasm", icon: "photo" }, { label: "Narx", icon: "price" }, { label: "Sotildi", icon: "deal" }] },
  ]);
