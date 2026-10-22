// Копия src/Tour/schema.ts — формат edit.json обзора объекта ("layout": "tour"). Сгенерировано npm run pack-skill.
import { z } from "zod";

// Формат «Tour» — обзор объекта без речи: клипы владельца (сверхширокий 0.5x, плавная проводка),
// ускорения между комнатами, скрытые склейки и музыка в бит. Стиль разобран в docs/tour-reference.md.
// Времена клипа (in, out, ramps, tags) — секунды ИСХОДНОГО файла клипа.

// Переход ИЗ клипа в следующий (у последнего — в начало ролика, если loop)
export const tourTransitionSchema = z.object({
  // cut      — склейка встык (по движению, на шторке-предмете, который уже есть в кадре: дверь, стена, колонна);
  // dissolve — наплыв в движении: оба кадра двигаются, один просвечивает сквозь другой (референс C);
  // whip     — резкий поворот: кадр улетает вбок с размытием, новый прилетает с той же стороны (референсы B, D);
  // push     — пролёт: наезд в кадр со смазом от центра, новый кадр выплывает из глубины (финал D);
  // wall     — «стена»: мягкая полоса-стена проплывает через кадр и прячет склейку (дверь в D, 6,6 с)
  // inset    — «окошко»: кадр сжимается в окно с чёрными полями, уезжает вбок, новый въезжает и раскрывается (референс F)
  type: z.enum(["cut", "dissolve", "whip", "push", "wall", "inset"]),
  // направление движения камеры: куда «уходит» кадр (whip, wall); по умолчанию left (камера поворачивает вправо)
  dir: z.enum(["left", "right", "up", "down"]).optional(),
  // длительность перехода, с (по умолчанию: dissolve 0.4, whip 0.3, push 0.36, wall 0.4, cut 0)
  dur: z.number().min(0).max(1.2).optional(),
  // для whip/push клипы сами разгоняются к склейке и тормозят после неё (speed ramp); false — без разгона
  ramp: z.boolean().optional(),
  // wall: тон «стены» — light (светлая стена/дверь) или dark
  tone: z.enum(["light", "dark"]).optional(),
});

export const tourClipSchema = z.object({
  // файл в public/ (после npm run tour-ingest — reels/<slug>/clip-01.mp4 …)
  file: z.string(),
  in: z.number().min(0),
  out: z.number().min(0.2),
  // базовая скорость клипа: 1 — как снято; 1.5–2 — проходные места; 0.7–0.9 — «вкусные» детали (нужно 60 к/с)
  speed: z.number().min(0.4).max(6).optional(),
  // участки другой скорости внутри клипа (секунды исходника): разгон по коридору, замедление на люстре.
  // Края сглажены — скорость меняется плавно, как в референсах.
  ramps: z.array(z.object({ at: z.number().min(0), dur: z.number().min(0.1), speed: z.number().min(0.3).max(8) })).optional(),
  // лёгкий цифровой наезд за клип (0.02 = +2%); оживляет статичные кадры. По умолчанию 0.02
  push: z.number().min(0).max(0.15).optional(),
  // точка, к которой наезжать (доли кадра), по умолчанию центр
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  // переход в следующий клип (у последнего — в начало ролика при loop)
  exit: tourTransitionSchema.optional(),
  // два кадра стопкой (референс F): снизу второй файл — деталь к общему плану (раковина + смеситель)
  stack: z.object({ file: z.string(), in: z.number().min(0), speed: z.number().min(0.4).max(4).optional() }).optional(),
});

// Точка кадра в долях: [x, y], 0..1
const pt = z.tuple([z.number(), z.number()]);

// Надпись на поверхности в кадре с перспективой (дверь, стена, фасад) — как «Хороший ремонт это дорого» на двери (F)
// и «36 этажей» на фасаде. keys — углы поверхности (доли кадра) в секунды исходника клипа; между ключами углы
// двигаются плавно — так надпись «едет» вместе со стеной. Один ключ — надпись стоит (для статичного кадра).
export const tourSurfaceSchema = z.object({
  clip: z.number().int().min(0),
  at: z.number().min(0),
  dur: z.number().min(0.6).max(8),
  lines: z.array(z.string()).min(1).max(4),
  // paint — «напечатано» на светлой поверхности (тёмный, через multiply); light — белый; metal — металл палитры
  style: z.enum(["paint", "light", "metal"]).optional(),
  keys: z
    .array(z.object({ t: z.number().min(0), tl: pt, tr: pt, br: pt, bl: pt }))
    .min(1)
    .max(8),
});

// Рулетка: стрелка между двумя точками кадра и размер (высота потолка, ширина окна) — только реальные размеры владельца
export const tourRulerSchema = z.object({
  clip: z.number().int().min(0),
  at: z.number().min(0),
  dur: z.number().min(0.8).max(6),
  from: pt,
  to: pt,
  label: z.string(),
});

// Тонкая подпись комнаты/параметра. Только реальные данные владельца. at — секунда исходника клипа.
export const tourTagSchema = z.object({
  clip: z.number().int().min(0),
  at: z.number().min(0),
  dur: z.number().min(0.6).max(6),
  text: z.string(),
  sub: z.string().optional(),
  // место: bottom (по умолчанию, над подписью Reels) | top
  pos: z.enum(["bottom", "top"]).optional(),
});

export const tourSchema = z.object({
  layout: z.literal("tour"),
  lang: z.enum(["uz", "ru"]).optional(),
  palette: z.enum(["sky", "champagne", "sage", "blush", "monolith"]).optional(),
  clips: z.array(tourClipSchema).min(1),
  // музыка из public/ (своя montaj-*.webm или трек владельца) и откуда в треке начинать, с
  musicFile: z.string(),
  musicStart: z.number().min(0).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  // сетка битов: bpm (+ beatOffset — время первого удара в треке) или файл npm run beats
  bpm: z.number().min(40).max(220).optional(),
  beatOffset: z.number().optional(),
  beatsFile: z.string().optional(),
  // ставить склейки на удары: базовая скорость клипов чуть меняется (0.8–1.25×), чтобы каждый переход попал в бит
  beatSync: z.boolean().optional(),
  // через сколько ударов допускаются склейки: 1 — на любой удар, 2 — на сильные доли
  beatEvery: z.number().int().min(1).max(4).optional(),
  // цвет: clean — светло и чисто (как в референсах), warm — теплее, cool — холоднее, none — как снято
  grade: z.enum(["clean", "warm", "cool", "none"]).optional(),
  // лёгкая резкость (видео с телефона после масштабирования мягкое)
  sharpen: z.boolean().optional(),
  // размытие движения на ускорениях (смешивание кадров) — как у настоящей камеры на быстром проходе
  motionBlur: z.boolean().optional(),
  // бесшовная петля: конец переходит в первый кадр (Reels крутит ролик по кругу — досмотры растут)
  loop: z.boolean().optional(),
  // хук-надпись в первые секунды (необязательно; референсы обходятся без текста)
  hook: z.object({ text: z.string(), sub: z.string().optional(), dur: z.number().min(0.8).max(4) }).optional(),
  tags: z.array(tourTagSchema).optional(),
  surfaces: z.array(tourSurfaceSchema).optional(),
  rulers: z.array(tourRulerSchema).optional(),
  // финальная плашка: заголовок и 1–3 строки (цена, комнаты, контакт) — только данные владельца
  endCard: z.object({ title: z.string(), lines: z.array(z.string()).max(3), dur: z.number().min(1).max(5) }).optional(),
  // кадр обложки: секунда готового ролика
  coverAt: z.number().min(0).optional(),
  // звуки (свои, public/sfx, без whoosh): clip — номер клипа, offset — секунды от начала клипа В РОЛИКЕ
  // (можно отрицательные: нарастание начинается до склейки). Удар — хук и кульминация, нарастание — перед ней, блик — люстры и надписи
  sfx: z
    .array(
      z.object({
        clip: z.number().int().min(0),
        offset: z.number(),
        sound: z.enum(["impact", "riser", "shine", "glitch", "pop", "tick"]),
        volume: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});

export type TourProps = z.infer<typeof tourSchema> & {
  // заполняет calculateMetadata
  resolved?: ResolvedClip[];
  beats?: number[];
};
export type TourClip = z.infer<typeof tourClipSchema>;
export type TourTransition = z.infer<typeof tourTransitionSchema>;
export type TourTag = z.infer<typeof tourTagSchema>;
export type TourSurface = z.infer<typeof tourSurfaceSchema>;
export type TourRuler = z.infer<typeof tourRulerSchema>;

export type ResolvedClip = {
  /** начало клипа в ролике, с */
  start: number;
  /** длина в ролике, с */
  dur: number;
  /** множитель скорости после подгонки под бит */
  scale: number;
  /** длина файла, с (0 — неизвестна) */
  fileDur: number;
  /** частота кадров файла */
  fps: number;
  /** длина файла второго кадра стопкой (stack), с */
  stackDur?: number;
};
