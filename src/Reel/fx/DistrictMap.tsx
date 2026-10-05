import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT, metalGradient } from "../theme";
import { EASE_IN_OUT, EASE_OUT, enter, exit, pop } from "../motion";
import type { FxProps } from "./common";
import { Icon } from "./icons";
import {
  DISTRICTS,
  type DistrictShape,
  OUTLINE_PATH,
  pointInPoly,
  SHAPES,
} from "./tashkent";

// Карта районов Ташкента — герой роликов о локациях.
// Без focus — «поиск»: по карте идёт сканер, районы вспыхивают.
// С focus — районы по очереди заливаются акцентом и обводятся светящейся линией, на них — номер и подпись;
// zoom — камера наезжает на выбранные районы; objects — на районе растут дома (towers) или частные дома (houses).

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// мягкие края: при наезде карта растворяется, а не обрывается
const MASK =
  "radial-gradient(ellipse 62% 62% at 50% 50%, black 72%, transparent 100%)";
const byId = Object.fromEntries(SHAPES.map((s) => [s.id, s])) as Record<
  string,
  DistrictShape
>;

/** Точки внутри района для объектов (детерминированно) */
const spotsIn = (
  s: DistrictShape,
  count: number,
  seed: string,
  minGap: number,
) => {
  const pts: [number, number][] = [];
  const [x0, y0, x1, y1] = s.bbox;
  const [cx, cy] = s.centroid;
  for (let i = 0; pts.length < count && i < 400; i++) {
    const x = cx + (random(`${seed}x${i}`) - 0.5) * (x1 - x0) * 0.62;
    const y = cy + (random(`${seed}y${i}`) - 0.5) * (y1 - y0) * 0.62;
    if (
      pointInPoly([x, y], s.poly) &&
      pts.every((q) => Math.hypot(q[0] - x, q[1] - y) > minGap)
    )
      pts.push([x, y]);
  }
  return pts.sort((a, b) => a[1] - b[1]);
};

export const DistrictMap: React.FC<FxProps<OverlayOf<"districts">>> = ({
  o,
  total,
  zone,
  p,
  lang,
  local,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = Math.min(zone.w - 30, zone.h - 70);
  const k = S / 1000;
  const inT = enter(f, 0, 10);
  const out = exit(f, total, 8);
  const draw = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: EASE_OUT });
  const focus = o.focus;
  const focusAt = (j: number) => {
    const t = focus[j]?.at;
    return t !== undefined
      ? Math.max(2, local(t))
      : 8 + j * Math.round(0.6 * fps);
  };
  // до первой подсветки по карте идёт сканер — «ищем»
  const searching = !focus.length || f < focusAt(0);

  // камера: наезд на рамку выбранных районов
  let scale = 1;
  let cx = 500;
  let cy = 500;
  if (o.zoom && focus.length) {
    const boxes = focus.map((x) => byId[x.id].bbox);
    const bx0 = Math.min(...boxes.map((b) => b[0]));
    const by0 = Math.min(...boxes.map((b) => b[1]));
    const bx1 = Math.max(...boxes.map((b) => b[2]));
    const by1 = Math.max(...boxes.map((b) => b[3]));
    const target = Math.min(
      2.1,
      Math.max(1, 640 / Math.max(bx1 - bx0, by1 - by0)),
    );
    const z0 = Math.max(4, focusAt(0) - 4);
    const t = interpolate(f, [z0, z0 + 0.9 * fps], [0, 1], {
      ...clamp,
      easing: EASE_IN_OUT,
    });
    scale = 1 + (target - 1) * t;
    cx = 500 + ((bx0 + bx1) / 2 - 500) * t;
    cy = 500 + ((by0 + by1) / 2 - 500) * t;
  }
  // экранные координаты точки карты (для подписей, которые не масштабируются)
  const toScreen = (x: number, y: number) =>
    [((x - cx) * scale + 500) * k, ((y - cy) * scale + 500) * k] as const;
  const mapTransform = `translate(500 500) scale(${scale}) translate(${-cx} ${-cy})`;

  const scanY = interpolate(
    f % Math.round(1.6 * fps),
    [0, 1.6 * fps],
    [-80, 1080],
  );
  const pulse = 0.5 + 0.5 * Math.sin((f / fps) * Math.PI * 2);
  const name = (id: string) => DISTRICTS[id as keyof typeof DISTRICTS][lang];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: Math.min(inT, out),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: S,
          height: S,
          transform: `scale(${0.94 + 0.06 * inT})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            maskImage: MASK,
            WebkitMaskImage: MASK,
          }}
        >
          <svg
            viewBox="0 0 1000 1000"
            width={S}
            height={S}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            <defs>
              <clipPath id="city">
                <path d={OUTLINE_PATH} />
              </clipPath>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <g transform={mapTransform}>
              {/* подложка города и кольцевые дороги */}
              <path d={OUTLINE_PATH} fill="rgba(255,255,255,0.035)" />
              <g clipPath="url(#city)" opacity={draw * 0.9}>
                <ellipse
                  cx={505}
                  cy={450}
                  rx={175}
                  ry={150}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={5}
                  strokeDasharray="2 12"
                  strokeLinecap="round"
                />
                <ellipse
                  cx={515}
                  cy={500}
                  rx={390}
                  ry={380}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={7}
                />
                {[0, 40, 80, 125, 165, 210, 250, 300, 330].map((deg) => {
                  const r = (deg * Math.PI) / 180;
                  return (
                    <line
                      key={deg}
                      x1={505}
                      y1={450}
                      x2={505 + Math.cos(r) * 620}
                      y2={450 + Math.sin(r) * 620}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={4}
                    />
                  );
                })}
                <path
                  d="M760 40 C 700 260, 640 330, 560 420 S 380 640, 300 1000"
                  fill="none"
                  stroke={p.accentSoft}
                  strokeWidth={6}
                  opacity={0.7}
                />
              </g>
              {/* районы */}
              {SHAPES.map((s) => {
                const j = focus.findIndex((x) => x.id === s.id);
                const on =
                  j >= 0
                    ? interpolate(f, [focusAt(j), focusAt(j) + 10], [0, 1], {
                        ...clamp,
                        easing: EASE_OUT,
                      })
                    : 0;
                const dim = focus.length
                  ? interpolate(
                      f,
                      [focusAt(0), focusAt(0) + 10],
                      [1, 0.45],
                      clamp,
                    )
                  : 1;
                let flash = 0;
                if (searching) {
                  const d = Math.abs((s.centroid[1] - scanY) / 120);
                  flash = Math.max(0, 1 - d) * 0.5;
                }
                return (
                  <g key={s.id}>
                    <path
                      d={s.path}
                      pathLength={1}
                      fill={
                        on > 0
                          ? p.accent
                          : `rgba(255,255,255,${0.04 + flash * 0.25})`
                      }
                      fillOpacity={on > 0 ? 0.18 + 0.5 * on : 1}
                      stroke={on > 0 ? p.accent : "rgba(255,255,255,0.55)"}
                      strokeOpacity={on > 0 ? 1 : 0.45 * dim + flash}
                      strokeWidth={(on > 0 ? 5 + pulse * 2 : 2.4) / scale}
                      strokeDasharray={draw < 1 ? `${draw} 1` : undefined}
                      strokeLinejoin="round"
                    />
                    {on > 0 ? (
                      <path
                        d={s.path}
                        fill="none"
                        stroke={p.accent}
                        strokeWidth={14 / scale}
                        opacity={0.35 * on * (0.6 + 0.4 * pulse)}
                        filter="url(#glow)"
                      />
                    ) : null}
                  </g>
                );
              })}
              <path
                d={OUTLINE_PATH}
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={3.5 / scale}
                pathLength={1}
                strokeDasharray={draw < 1 ? `${draw} 1` : undefined}
              />
              {/* объекты на районе */}
              {o.objects && o.objects !== "none"
                ? focus.slice(0, 1).flatMap((fx) => {
                    const s = byId[fx.id];
                    const spots = spotsIn(
                      s,
                      o.objects === "towers" ? 8 : 10,
                      `${fx.id}${o.objects}`,
                      30 / scale,
                    );
                    const start = focusAt(0) + 6;
                    return spots.map(([x, y], i) => {
                      const t = pop(f, fps, start + i * 2, 220);
                      // размеры в «экранных» единицах, чтобы при наезде дома не становились огромными
                      const sz = 28 / scale;
                      if (o.objects === "towers") {
                        const h =
                          ((80 + random(`h${fx.id}${i}`) * 130) *
                            Math.min(1, t)) /
                          scale;
                        return (
                          <g
                            key={`${fx.id}${i}`}
                            transform={`translate(${x} ${y})`}
                            opacity={Math.min(1, t * 2)}
                          >
                            <polygon
                              points={`0,0 ${sz},${-sz * 0.5} ${sz},${-sz * 0.5 - h} 0,${-h}`}
                              fill={p.metal[2]}
                            />
                            <polygon
                              points={`0,0 ${-sz},${-sz * 0.5} ${-sz},${-sz * 0.5 - h} 0,${-h}`}
                              fill={p.metal[1]}
                            />
                            <polygon
                              points={`0,${-h} ${sz},${-sz * 0.5 - h} 0,${-sz - h} ${-sz},${-sz * 0.5 - h}`}
                              fill={p.metal[0]}
                            />
                            {Array.from({
                              length: Math.floor(h / (sz * 0.9)),
                            }).map((_, r) => (
                              <line
                                key={r}
                                x1={-sz * 0.75}
                                y1={-sz * 0.35 - (r + 0.6) * sz * 0.9}
                                x2={-sz * 0.2}
                                y2={-sz * 0.1 - (r + 0.6) * sz * 0.9}
                                stroke={p.bg}
                                strokeWidth={1.6 / scale}
                                opacity={0.5}
                              />
                            ))}
                          </g>
                        );
                      }
                      const hs = sz * 1.15 * Math.min(1, t);
                      return (
                        <g
                          key={`${fx.id}${i}`}
                          transform={`translate(${x} ${y}) scale(${Math.max(0.01, t)})`}
                        >
                          <polygon
                            points={`${-hs},0 ${hs},0 ${hs},${-hs} 0,${-hs * 1.8} ${-hs},${-hs}`}
                            fill={p.metal[1]}
                            stroke={p.bg}
                            strokeWidth={1.5 / scale}
                          />
                          <rect
                            x={-hs * 0.3}
                            y={-hs * 0.7}
                            width={hs * 0.6}
                            height={hs * 0.7}
                            fill={p.bg}
                            opacity={0.6}
                          />
                        </g>
                      );
                    });
                  })
                : null}
            </g>
            {/* сканер в режиме поиска */}
            {searching ? (
              <g clipPath="url(#city)" opacity={focus.length ? 0.6 : 1}>
                <rect
                  x={0}
                  y={scanY - 3}
                  width={1000}
                  height={6}
                  fill={p.accent}
                  opacity={0.9}
                />
                <rect
                  x={0}
                  y={scanY - 60}
                  width={1000}
                  height={60}
                  fill={`url(#scanfade)`}
                />
                <defs>
                  <linearGradient id="scanfade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={p.accent} stopOpacity={0} />
                    <stop offset="1" stopColor={p.accent} stopOpacity={0.25} />
                  </linearGradient>
                </defs>
              </g>
            ) : null}
          </svg>
        </div>

        {/* подписи районов (не масштабируются вместе с картой) */}
        {focus.map((fx, j) => {
          const s = byId[fx.id];
          // подпись над районом: дома и заливка остаются видны
          const [sx, sy] = toScreen(
            s.centroid[0],
            s.bbox[1] + (s.centroid[1] - s.bbox[1]) * 0.25,
          );
          const t = pop(f, fps, focusAt(j) + 4, 260);
          const vt = enter(f, focusAt(j) + 14, 12);
          return (
            <div
              key={fx.id}
              style={{
                position: "absolute",
                left: sx,
                top: sy,
                transform: `translate(-50%, -100%) scale(${t})`,
                transformOrigin: "50% 100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 24px 12px 12px",
                  borderRadius: 999,
                  background: "rgba(10,14,20,0.88)",
                  border: `2px solid ${p.accent}`,
                  boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 30px ${p.accentSoft}`,
                }}
              >
                {fx.rank ? (
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      background: p.accent,
                      color: p.onAccent,
                      fontFamily: FONT,
                      fontWeight: 900,
                      fontSize: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {fx.rank}
                  </div>
                ) : (
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      background: p.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={o.objects === "houses" ? "home" : "location"}
                      size={32}
                      color={p.onAccent}
                      stroke={2.4}
                    />
                  </div>
                )}
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: 38,
                    color: "#fff",
                    whiteSpace: "nowrap",
                    letterSpacing: -0.5,
                  }}
                >
                  {name(fx.id)}
                </div>
              </div>
              {fx.value ? (
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 900,
                    fontSize: 64,
                    letterSpacing: -2,
                    backgroundImage: metalGradient(p),
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    opacity: vt,
                    transform: `translateY(${(1 - vt) * 16}px)`,
                    filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.7))",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fx.value}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* заголовок карты и честная пометка «схема» */}
        {o.title ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -6,
              display: "flex",
              justifyContent: "center",
              opacity: enter(f, 4, 10),
            }}
          >
            <div
              style={{
                padding: "12px 28px",
                borderRadius: 999,
                background: p.accentSoft,
                border: `1.5px solid ${p.accent}`,
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: p.accent,
              }}
            >
              {o.title}
            </div>
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 6,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}
        >
          {lang === "ru" ? "схема районов" : "tumanlar sxemasi"}
        </div>
        {!focus.length ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "46%",
              transform: `translate(-50%, -50%) scale(${pop(f, fps, 10)})`,
              width: 170,
              height: 170,
              borderRadius: 85,
              background: "rgba(10,14,20,0.85)",
              border: `3px solid ${p.accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 110,
              color: p.accent,
              boxShadow: `0 0 60px ${p.accentSoft}`,
            }}
          >
            ?
          </div>
        ) : null}
      </div>
    </div>
  );
};
