// Копия src/Reel/schema.ts — точный формат edit.json. Сгенерировано npm run pack-skill.
import { z } from "zod";
import type { Caption } from "@remotion/captions";
import { DISTRICT_IDS } from "./fx/tashkent";

// Все времена — в секундах исходного видео (до вырезки пауз, её делаем автоматически).
const base = { at: z.number().min(0), dur: z.number().min(0.3) };

export const overlaySchema = z.discriminatedUnion("type", [
  // Карточка сервиса/приложения, когда его называют (OLX, Telegram, Uybor…)
  z.object({ type: z.literal("tool"), ...base, name: z.string(), icon: z.string() }),
  // Окно чата: печатается сообщение, потом ответ (ответ — только дословно со скриншота)
  z.object({ type: z.literal("chat"), ...base, prompt: z.string(), answer: z.string() }),
  // Экран телефона или окно со скриншотом. image — файл из public/, пусто — макет.
  // zoomTo — через ~1 с камера наезжает на область скриншота и обводит её рамкой
  // (доли 0..1: x,y — левый верхний угол, w,h — размер).
  z.object({
    type: z.literal("screen"),
    ...base,
    title: z.string(),
    image: z.string(),
    zoomTo: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0.02).max(1),
        h: z.number().min(0.02).max(1),
      })
      .optional(),
    // phone — вертикальный скриншот в телефоне; window — горизонтальный в широком окне
    frame: z.enum(["phone", "window"]).optional(),
  }),
  // Шаги 01-02-03
  z.object({ type: z.literal("steps"), ...base, title: z.string(), items: z.array(z.string()) }),
  // Крупная «металлическая» цифра со счётчиком (как «$17 M» на образце). Только реальные цифры из речи.
  z.object({
    type: z.literal("number"),
    ...base,
    value: z.number(),
    suffix: z.string(),
    label: z.string(),
    prefix: z.string().optional(),
  }),
  // Акцент: слово «падает» в кадр с ударом
  z.object({ type: z.literal("accent"), ...base, text: z.string(), emoji: z.string() }),
  // Заголовок смыслового блока — крупная кинетическая типографика
  z.object({ type: z.literal("title"), ...base, text: z.string(), sub: z.string() }),
  // B-roll: видео или картинка из public/ (в split — верхняя половина, в full — весь кадр)
  z.object({ type: z.literal("broll"), ...base, file: z.string() }),
  // Иконки-понятия (1–3): визуальная метафора фразы. icon — ключ из src/Reel/fx/icons.tsx
  z.object({
    type: z.literal("icon"),
    ...base,
    items: z.array(z.object({ icon: z.string(), label: z.string() })).min(1).max(3),
  }),
  // Было / стало: неправильное перечёркивается, правильное — с галочкой
  z.object({
    type: z.literal("compare"),
    ...base,
    bad: z.string(),
    good: z.string(),
    badLabel: z.string(),
    goodLabel: z.string(),
  }),
  // Схема-процесс A → B → C (2–4 блока), последний — результат
  z.object({
    type: z.literal("flow"),
    ...base,
    nodes: z.array(z.object({ label: z.string(), icon: z.string() })).min(2).max(4),
  }),
  // Смена «мира»: заливка акцентом на весь кадр и одно огромное слово (1 раз на ролик)
  z.object({ type: z.literal("slam"), ...base, text: z.string(), em: z.string() }),
  // Фраза набирается по словам со свечением; слова из em — курсив с засечками, акцентным цветом
  z.object({ type: z.literal("typed"), ...base, text: z.string(), em: z.string() }),
  // Светлый «бумажный» мир: бланк с пунктами; mark "x" — зачеркнуть, "v" — галочка
  z.object({
    type: z.literal("paper"),
    ...base,
    tag: z.string(),
    title: z.string(),
    items: z.array(z.object({ text: z.string(), mark: z.enum(["x", "v", ""]) })).min(1).max(5),
    // секунды исходника, когда появляется каждый пункт (по словам); без них — каждые 0,9 с
    times: z.array(z.number().min(0)).optional(),
  }),
  // Три одинаковых типовых объявления — «все на одно лицо» (герой роликов про продажу)
  // marks — когда появляется подпись каждой копии (доля длительности 0..1), чтобы попасть в слова
  z.object({
    type: z.literal("clones"),
    ...base,
    labels: z.array(z.string()).max(3),
    marks: z.array(z.number().min(0).max(1)).max(3).optional(),
  }),
  // Типовое объявление превращается в премиальное (линия-сканер)
  z.object({ type: z.literal("morph"), ...base, before: z.string(), after: z.string() }),
  // Ядро + модули: к центральному узлу по очереди подключаются 2–5 модулей, по линиям бежит свет
  // times — секунды исходника, когда подключается каждый модуль (по словам); без них — каждые 0,6 с
  z.object({
    type: z.literal("hub"),
    ...base,
    center: z.string(),
    items: z.array(z.string()).min(1).max(5),
    times: z.array(z.number().min(0)).optional(),
  }),
  // График из столбиков — только реальные цифры
  z.object({
    type: z.literal("chart"),
    ...base,
    title: z.string(),
    unit: z.string(),
    bars: z
      .array(z.object({ label: z.string(), value: z.number().min(0), highlight: z.boolean() }))
      .min(2)
      .max(4),
  }),
  // Карточка объекта недвижимости: фото (необязательно), цена, параметры. Только реальные данные.
  z.object({
    type: z.literal("property"),
    ...base,
    title: z.string(),
    price: z.string(),
    place: z.string(),
    image: z.string(),
    specs: z.array(z.object({ icon: z.string(), label: z.string() })).max(4),
  }),
  // Локация: на схематичной карте падает метка, подпись района/ориентира
  z.object({ type: z.literal("location"), ...base, place: z.string(), sub: z.string() }),
  // Карта районов Ташкента (схема). focus пустой — «поиск» со сканером; иначе районы подсвечиваются по очереди:
  // rank — номер в рейтинге, value — подпись «металлом» (только реальные цифры), zoom — наезд на районы,
  // objects — на первом районе растут многоэтажки (towers) или частные дома (houses); title — плашка сверху.
  z.object({
    type: z.literal("districts"),
    ...base,
    focus: z
      .array(
        z.object({
          id: z.enum(DISTRICT_IDS),
          rank: z.number().int().min(1).max(12).optional(),
          value: z.string().optional(),
          // секунда исходника, когда район подсвечивается (по слову); по умолчанию — сразу, по очереди
          at: z.number().min(0).optional(),
        }),
      )
      .max(4),
    zoom: z.boolean().optional(),
    objects: z.enum(["towers", "houses", "none"]).optional(),
    title: z.string().optional(),
  }),
]);

export const zoomSchema = z.object({
  at: z.number().min(0),
  dur: z.number().min(0.2),
  scale: z.number().min(1).max(1.6),
});

// Переходы между смысловыми блоками
export const transitionSchema = z.object({
  at: z.number().min(0),
  type: z.enum(["whip", "wipe", "flash", "glitch", "smear"]),
});

// Отдельные звуковые акценты: riser заканчивается ровно в `at` (нарастание в момент),
// остальные звуки начинаются в `at`.
export const cueSchema = z.object({
  at: z.number().min(0),
  sound: z.enum(["riser", "impact", "shine", "glitch", "pop"]),
  volume: z.number().min(0).max(1),
});

export const reelSchema = z.object({
  // full — спикер на весь экран; split — спикер снизу, монтаж сверху;
  // voice — спикера в кадре нет: графика на весь экран + голос (videoFile — аудио: mp3/wav/m4a)
  layout: z.enum(["full", "split", "voice"]),
  // Язык ролика: субтитры, распознавание речи, тексты на экране
  lang: z.enum(["uz", "ru"]).optional(),
  // Палитра: sky | champagne | sage | blush | monolith (см. src/Reel/theme.ts)
  palette: z.enum(["sky", "champagne", "sage", "blush", "monolith"]).optional(),
  // Файл лежит в папке public/ (в voice — аудиофайл с голосом)
  videoFile: z.string(),
  // Субтитры, созданные скриптом `npm run transcribe` (тоже в public/)
  captionsFile: z.string(),
  // Длина ролика, если видео ещё нет (заглушка / демо)
  fallbackSeconds: z.number().min(1),
  // Автоматически вырезать паузы между фразами
  cutPauses: z.boolean(),
  // Ускорение речи (высота голоса сохраняется). 1.1–1.2 — бодрый темп Reels
  speed: z.number().min(0.8).max(1.5),
  // «Тишина как приём»: секунды слов, перед которыми пауза НЕ вырезается (до 0.7 с),
  // а музыка в ней затихает. 0–1 раз на ролик, перед главной мыслью.
  beats: z.array(z.number().min(0)),
  // Фраза-хук в первые секунды
  hook: z.string(),
  hookSeconds: z.number().min(0.5).max(6),
  // Слова, которые подсвечиваются в хуке и субтитрах
  highlightWords: z.array(z.string()),
  // Графика, приближения, переходы
  overlays: z.array(overlaySchema),
  zooms: z.array(zoomSchema),
  transitions: z.array(transitionSchema),
  cues: z.array(cueSchema),
  // Смена плана (общий/крупный) на каждой новой фразе
  autoFraming: z.boolean(),
  // Звуки и музыка (файл из public/, пусто — без музыки)
  sfx: z.boolean(),
  musicFile: z.string(),
  // Кодовое слово / призыв в конце. Пусто — концовки нет.
  cta: z.string(),
  ctaSeconds: z.number().min(1).max(6),
});

export type Overlay = z.infer<typeof overlaySchema>;
export type OverlayOf<T extends Overlay["type"]> = Extract<Overlay, { type: T }>;
export type Zoom = z.infer<typeof zoomSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Cue = z.infer<typeof cueSchema>;
// Кусок исходного видео, который остаётся после вырезки пауз (секунды)
export type Segment = { from: number; to: number };

export type ReelProps = z.infer<typeof reelSchema> & {
  captions?: Caption[];
  hasVideo?: boolean;
  segments?: Segment[];
};
