import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { H, W } from "../Reel/layout";
import { EASE_IN, EASE_OUT } from "../Reel/motion";
import { FONT, metalGradient, type Palette } from "../Reel/theme";
import type { ResolvedClip, TourRuler, TourSurface } from "./schema";
import type { SpeedMap } from "./timing";

// Графика «в пространстве» обзора: надпись на поверхности с перспективой (дверь, стена, фасад) и рулетка размера.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type P = [number, number];
const BOX_W = 1000;

/** CSS matrix3d: прямоугольник w×h → четырёхугольник tl, tr, br, bl (пиксели кадра) */
const quadMatrix = (w: number, h: number, [p0, p1, p2, p3]: [P, P, P, P]) => {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(",")})`;
};

/** углы поверхности в секунду исходника t: между ключами — линейно, за краями — крайний ключ */
const quadAt = (keys: TourSurface["keys"], t: number): [P, P, P, P] => {
  const px = (p: P): P => [p[0] * W, p[1] * H];
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  let a = sorted[0];
  let b = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].t <= t) a = sorted[i];
    if (sorted[i].t >= t) {
      b = sorted[i];
      break;
    }
    b = sorted[i];
  }
  const k = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const mix = (p: P, q: P): P => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  return [px(mix(a.tl, b.tl)), px(mix(a.tr, b.tr)), px(mix(a.br, b.br)), px(mix(a.bl, b.bl))];
};

const dist = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]);

export const Surface: React.FC<{ s: TourSurface; t: number; src: number; p: Palette }> = ({ s, t, src, p }) => {
  const quad = quadAt(s.keys, src);
  const ratio = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / Math.max(1, dist(quad[0], quad[1]) + dist(quad[3], quad[2]));
  const boxH = BOX_W * ratio;
  const longest = Math.max(...s.lines.map((l) => l.length));
  const size = Math.min(boxH / (s.lines.length * 1.02), (BOX_W / Math.max(3, longest)) * 1.75);
  const style = s.style ?? "paint";
  const out = interpolate(t, [s.dur - 0.35, s.dur], [1, 0], { ...clamp, easing: EASE_IN });
  const color: React.CSSProperties =
    style === "paint"
      ? { color: "rgba(38,35,32,0.82)" }
      : style === "light"
        ? { color: "#fff", textShadow: "0 0 18px rgba(255,255,255,0.35)" }
        : { backgroundImage: metalGradient(p), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: BOX_W,
        height: boxH,
        transformOrigin: "0 0",
        transform: quadMatrix(BOX_W, boxH, quad),
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        opacity: out,
        ...(style === "paint" ? { mixBlendMode: "multiply" as const } : {}),
      }}
    >
      {s.lines.map((line, i) => {
        // строки появляются по очереди, как в образце F: «Хороший / ремонт / это / дорого»
        const k = interpolate(t, [0.1 + i * 0.28, 0.45 + i * 0.28], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: size,
              lineHeight: 0.98,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              clipPath: `inset(0 ${(1 - k) * 100}% 0 0)`,
              filter: style === "paint" ? "blur(0.6px)" : undefined,
              ...color,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

export const Ruler: React.FC<{ r: TourRuler; t: number; p: Palette }> = ({ r, t, p }) => {
  const a: P = [r.from[0] * W, r.from[1] * H];
  const b: P = [r.to[0] * W, r.to[1] * H];
  const grow = interpolate(t, [0, 0.6], [0, 1], { ...clamp, easing: EASE_OUT });
  const out = interpolate(t, [r.dur - 0.3, r.dur], [1, 0], { ...clamp, easing: EASE_IN });
  const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const end = (q: P): P => [mid[0] + (q[0] - mid[0]) * grow, mid[1] + (q[1] - mid[1]) * grow];
  const ea = end(a);
  const eb = end(b);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const head = (q: P, dir: number) => {
    const s = 26;
    const l: P = [q[0] - dir * s * Math.cos(ang - 0.45), q[1] - dir * s * Math.sin(ang - 0.45)];
    const rr: P = [q[0] - dir * s * Math.cos(ang + 0.45), q[1] - dir * s * Math.sin(ang + 0.45)];
    return `M${l[0]},${l[1]} L${q[0]},${q[1]} L${rr[0]},${rr[1]}`;
  };
  const label = interpolate(t, [0.45, 0.8], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.45))" }}>
        <circle cx={a[0]} cy={a[1]} r={9 * grow} fill="#fff" />
        <circle cx={b[0]} cy={b[1]} r={9 * grow} fill="#fff" />
        <line x1={ea[0]} y1={ea[1]} x2={eb[0]} y2={eb[1]} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
        {grow > 0.95 ? (
          <>
            <path d={head(ea, -1)} stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={head(eb, 1)} stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: mid[0] + 36,
          top: mid[1],
          transform: `translateY(-50%) scale(${0.9 + 0.1 * label})`,
          transformOrigin: "left center",
          opacity: label,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 92,
          letterSpacing: "-0.02em",
          backgroundImage: metalGradient(p),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.5))",
          whiteSpace: "nowrap",
        }}
      >
        {r.label}
      </div>
    </div>
  );
};

export const Marks: React.FC<{
  surfaces: TourSurface[];
  rulers: TourRuler[];
  maps: SpeedMap[];
  resolved: ResolvedClip[];
  p: Palette;
}> = ({ surfaces, rulers, maps, resolved, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = f / fps;
  const local = (clip: number, at: number) => (maps[clip] ? o - (resolved[clip].start + maps[clip].toLocal(at)) : -1);
  return (
    <>
      {surfaces.map((s, i) => {
        const t = local(s.clip, s.at);
        if (t < 0 || t > s.dur) return null;
        return <Surface key={`s${i}`} s={s} t={t} src={maps[s.clip].srcAt(o - resolved[s.clip].start)} p={p} />;
      })}
      {rulers.map((r, i) => {
        const t = local(r.clip, r.at);
        if (t < 0 || t > r.dur) return null;
        return <Ruler key={`r${i}`} r={r} t={t} p={p} />;
      })}
    </>
  );
};
