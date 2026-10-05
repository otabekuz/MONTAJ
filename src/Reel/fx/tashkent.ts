// Схематичная карта районов Ташкента (не кадастровая): 12 районов на своих местах относительно друг друга.
// Границы — «силовая» диаграмма Вороного внутри контура города, с мягкой неровностью, общей для соседей.
// Координаты — условные 0..1000 (x — на восток, y — на юг).

export const DISTRICTS = {
  shayxontohur: { ru: "Шайхантахур", uz: "Shayxontohur", site: [415, 405], w: 0 },
  olmazor: { ru: "Алмазар", uz: "Olmazor", site: [330, 225], w: 9000 },
  yunusobod: { ru: "Юнусабад", uz: "Yunusobod", site: [565, 195], w: 14000 },
  mirzoulugbek: { ru: "Мирзо-Улугбек", uz: "Mirzo Ulug'bek", site: [770, 320], w: 14000 },
  yashnobod: { ru: "Яшнабад", uz: "Yashnobod", site: [775, 565], w: 12000 },
  mirobod: { ru: "Мирабад", uz: "Mirobod", site: [590, 470], w: 0 },
  yakkasaroy: { ru: "Яккасарай", uz: "Yakkasaroy", site: [485, 570], w: -2000 },
  chilonzor: { ru: "Чиланзар", uz: "Chilonzor", site: [300, 590], w: 9000 },
  uchtepa: { ru: "Учтепа", uz: "Uchtepa", site: [170, 420], w: 6000 },
  sergeli: { ru: "Сергели", uz: "Sergeli", site: [490, 830], w: 12000 },
  bektemir: { ru: "Бектемир", uz: "Bektemir", site: [805, 805], w: 6000 },
  yangihayot: { ru: "Янгихаёт", uz: "Yangihayot", site: [265, 825], w: 8000 },
} as const;

export type DistrictId = keyof typeof DISTRICTS;
export const DISTRICT_IDS = Object.keys(DISTRICTS) as [DistrictId, ...DistrictId[]];

type Pt = [number, number];

const OUTLINE: Pt[] = [
  [300, 85], [420, 55], [560, 65], [690, 105], [805, 170], [885, 265], [925, 385], [905, 505],
  [935, 625], [925, 765], [845, 885], [705, 935], [560, 965], [415, 950], [280, 920], [165, 840],
  [95, 720], [65, 590], [80, 450], [118, 315], [190, 185],
];

/** Отсечение многоугольника полуплоскостью a·x ≤ b (Сазерленд–Ходжмен) */
const clip = (poly: Pt[], a: Pt, b: number): Pt[] => {
  const out: Pt[] = [];
  const inside = (q: Pt) => a[0] * q[0] + a[1] * q[1] <= b + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const dp = a[0] * prev[0] + a[1] * prev[1];
      const dc = a[0] * cur[0] + a[1] * cur[1];
      const t = (b - dp) / (dc - dp);
      out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]);
    }
    if (ci) out.push(cur);
  }
  return out;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

const distToSeg = (q: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t);
};
/** Ребро лежит на контуре города — его не трогаем, чтобы районы совпадали с контуром */
const onOutline = (a: Pt, b: Pt) =>
  OUTLINE.some((q, i) => {
    const r = OUTLINE[(i + 1) % OUTLINE.length];
    return distToSeg(a, q, r) < 0.5 && distToSeg(b, q, r) < 0.5;
  });

/** Неровная граница: одинаковая для обоих соседей (ключ — концы ребра без учёта направления) */
const roughEdge = (a: Pt, b: Pt): Pt[] => {
  if (onOutline(a, b)) return [];
  const ka = `${Math.round(a[0])},${Math.round(a[1])}`;
  const kb = `${Math.round(b[0])},${Math.round(b[1])}`;
  const flip = ka > kb;
  const [p, q] = flip ? [b, a] : [a, b];
  const key = flip ? `${kb}|${ka}` : `${ka}|${kb}`;
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const steps = Math.max(1, Math.round(len / 45));
  const nx = -(q[1] - p[1]) / (len || 1);
  const ny = (q[0] - p[0]) / (len || 1);
  const pts: Pt[] = [];
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const amp = (hash(`${key}#${s}`) - 0.5) * Math.min(22, len * 0.12);
    pts.push([p[0] + (q[0] - p[0]) * t + nx * amp, p[1] + (q[1] - p[1]) * t + ny * amp]);
  }
  return flip ? pts.reverse() : pts;
};

export type DistrictShape = { id: DistrictId; poly: Pt[]; path: string; centroid: Pt; bbox: [number, number, number, number] };

const centroidOf = (poly: Pt[]): Pt => {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
};

const toPath = (poly: Pt[]) => `M${poly.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("L")}Z`;

export const SHAPES: DistrictShape[] = DISTRICT_IDS.map((id) => {
  const d = DISTRICTS[id];
  let poly: Pt[] = [...OUTLINE];
  for (const other of DISTRICT_IDS) {
    if (other === id) continue;
    const o = DISTRICTS[other];
    const a: Pt = [2 * (o.site[0] - d.site[0]), 2 * (o.site[1] - d.site[1])];
    const b = o.site[0] ** 2 + o.site[1] ** 2 - d.site[0] ** 2 - d.site[1] ** 2 - o.w + d.w;
    poly = clip(poly, a, b);
  }
  const rough: Pt[] = [];
  poly.forEach((q, i) => {
    rough.push(q);
    rough.push(...roughEdge(q, poly[(i + 1) % poly.length]));
  });
  const xs = rough.map((q) => q[0]);
  const ys = rough.map((q) => q[1]);
  return {
    id,
    poly: rough,
    path: toPath(rough),
    centroid: centroidOf(poly),
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
});

export const OUTLINE_PATH = toPath(OUTLINE);

export const pointInPoly = (pt: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
