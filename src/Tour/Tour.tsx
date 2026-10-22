import { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../Reel/fonts";
import { H, W } from "../Reel/layout";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../Reel/motion";
import { getPalette } from "../Reel/theme";
import { ClipLayer, type LayerFx } from "./ClipLayer";
import type { ResolvedClip, TourProps, TourTransition } from "./schema";
import { Marks } from "./Marks";
import { EndCard, Hook, Tags } from "./Text";
import { buildSpeedMap, enterOf, transitionDur } from "./timing";

// Ролик-обзор объекта: клипы идут «одним дублем», склейки спрятаны в движении.
// Слои: клипы (цвет общий) → «стена» перехода → подписи → хук/финальная плашка; музыка.

const BLUR_LEVELS = [6, 12, 22, 36, 54, 76];
const blurId = (dir: "h" | "v", px: number) => {
  let i = 0;
  while (i < BLUR_LEVELS.length - 1 && BLUR_LEVELS[i] < px) i++;
  return px < 3 ? undefined : `tour-${dir}b-${i}`;
};

/** SVG-фильтры: направленное размытие (резкий поворот) и лёгкая резкость */
const TourFilters: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      {BLUR_LEVELS.map((px, i) => (
        <filter key={`h${i}`} id={`tour-hb-${i}`} x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation={`${px / 2} 0`} edgeMode="duplicate" />
        </filter>
      ))}
      {BLUR_LEVELS.map((px, i) => (
        <filter key={`v${i}`} id={`tour-vb-${i}`} x="0" y="-10%" width="100%" height="120%">
          <feGaussianBlur stdDeviation={`0 ${px / 2}`} edgeMode="duplicate" />
        </filter>
      ))}
      <filter id="tour-sharp">
        <feConvolveMatrix order="3" kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0" preserveAlpha="true" />
      </filter>
    </defs>
  </svg>
);

const GRADE: Record<string, { filter: string; tint: string | null }> = {
  clean: { filter: "brightness(1.04) contrast(1.06) saturate(0.97)", tint: null },
  warm: { filter: "brightness(1.04) contrast(1.05) saturate(1.02)", tint: "rgba(255,196,140,0.10)" },
  cool: { filter: "brightness(1.04) contrast(1.06) saturate(0.93)", tint: "rgba(170,205,255,0.10)" },
  none: { filter: "", tint: null },
};

const ease = (p: number, e = EASE_IN_OUT) => e(Math.min(1, Math.max(0, p)));

type Pair = { a: LayerFx; b: LayerFx; showA: boolean; showB: boolean; wall?: { x: number; y: number; vertical: boolean; tone: "light" | "dark"; blur?: string } };

/** как выглядят оба кадра в момент p (0..1) перехода */
const transitionFx = (t: TourTransition, p: number): Pair => {
  const dir = t.dir ?? "left";
  const vertical = dir === "up" || dir === "down";
  const sign = dir === "left" || dir === "up" ? -1 : 1;
  const size = vertical ? H : W;
  const axis = (v: number) => (vertical ? { x: 0, y: v } : { x: v, y: 0 });
  switch (t.type) {
    case "dissolve": {
      // наплыв: новый кадр проявляется поверх, оба продолжают двигаться; лёгкий встречный масштаб
      const e = ease(p);
      return { a: { scale: 1 + 0.03 * e }, b: { opacity: e, scale: 1.035 - 0.035 * e }, showA: e < 0.999, showB: e > 0.001 };
    }
    case "whip": {
      // кадры стоят встык и проносятся вбок; смаз максимален в середине
      const e = ease(p, EASE_IN_OUT);
      const blur = Math.sin(Math.PI * Math.min(1, Math.max(0, p))) * 76;
      const id = blurId(vertical ? "v" : "h", blur);
      return {
        a: { ...axis(sign * e * size), blurFilter: id, scale: 1.04 },
        b: { ...axis(-sign * (1 - e) * size), blurFilter: id, scale: 1.04 },
        showA: e < 0.999,
        showB: e > 0.001,
      };
    }
    case "push": {
      // пролёт: наезд со смазом в старый кадр → из глубины выплывает новый, на стыке — лёгкая вспышка света
      if (p < 0.5) {
        const e = ease(p * 2, EASE_IN);
        return { a: { scale: 1 + 0.45 * e, zoomBlur: e, brightness: 1 + 0.18 * e }, b: {}, showA: true, showB: false };
      }
      const e = ease((p - 0.5) * 2, EASE_OUT);
      return { a: {}, b: { scale: 1.3 - 0.3 * e, zoomBlur: 1 - e, brightness: 1.18 - 0.18 * e }, showA: false, showB: true };
    }
    case "wall": {
      // «стена» проходит у самого объектива: закрывает кадр целиком — под ней склейка
      const e = ease(p, EASE_IN_OUT);
      const band = 1.7;
      const pos = sign < 0 ? size - e * size * (1 + band) : -band * size + e * size * (1 + band);
      const par = 0.12 * size;
      return {
        a: { ...axis(sign * e * par) },
        b: { ...axis(-sign * (1 - e) * par) },
        showA: p < 0.5,
        showB: p >= 0.5,
        wall: { ...axis(pos), vertical, tone: t.tone ?? "light", blur: blurId(vertical ? "v" : "h", Math.sin(Math.PI * p) * 30) },
      };
    }
    case "inset": {
      // «окошко» (образец F): кадр сжимается в окно на чёрном, уезжает вбок, новый въезжает окном и раскрывается
      const small = 0.64;
      const travel = (vertical ? H : W) * 0.9;
      if (p < 0.35) {
        const e = ease(p / 0.35);
        return { a: { scale: 1 - (1 - small) * e, card: true }, b: {}, showA: true, showB: false };
      }
      if (p < 0.65) {
        const e = ease((p - 0.35) / 0.3);
        return {
          a: { ...axis(sign * e * travel), scale: small, card: true },
          b: { ...axis(-sign * (1 - e) * travel), scale: small, card: true },
          showA: e < 0.999,
          showB: true,
        };
      }
      const e = ease((p - 0.65) / 0.35);
      return { a: {}, b: { scale: small + (1 - small) * e, card: e < 0.999 }, showA: false, showB: true };
    }
    case "cut":
    default:
      return { a: {}, b: {}, showA: p < 0.5, showB: p >= 0.5 };
  }
};

const Wall: React.FC<{ w: NonNullable<Pair["wall"]> }> = ({ w }) => {
  const light = w.tone === "light";
  const face = light ? ["#ddd8d0", "#f3f0ea", "#ebe7e0"] : ["#2a2724", "#3b3733", "#302c29"];
  const edge = light ? "rgba(40,34,28,0.35)" : "rgba(0,0,0,0.55)";
  const deg = w.vertical ? 180 : 90;
  const cross = w.vertical ? 90 : 180;
  // объём: тень у кромки, свет на плоскости, стык панелей; сверху вниз — свет от окна падает сверху
  const groove = light ? "rgba(60,50,40,0.18)" : "rgba(0,0,0,0.35)";
  return (
    <div
      style={{
        position: "absolute",
        left: w.x,
        top: w.y,
        width: w.vertical ? W : W * 1.7,
        height: w.vertical ? H * 1.7 : H,
        background: `linear-gradient(${deg}deg, transparent 0%, ${edge} 2.5%, ${face[0]} 6%, ${face[1]} 45%, ${face[2]} 90%, ${edge} 97%, transparent 100%)`,
        filter: w.blur ? `url(#${w.blur})` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          ...(w.vertical ? { left: 0, right: 0, top: "6%", bottom: "6%" } : { top: 0, bottom: 0, left: "6%", right: "6%" }),
          background: [
            `linear-gradient(${cross}deg, rgba(255,255,255,${light ? 0.16 : 0.05}) 0%, transparent 45%, rgba(0,0,0,${light ? 0.1 : 0.2}) 100%)`,
            `linear-gradient(${deg}deg, transparent 37%, ${groove} 37.6%, transparent 38.4%, transparent 71%, ${groove} 71.5%, transparent 72.2%)`,
          ].join(", "),
        }}
      />
    </div>
  );
};

export const Tour: React.FC<TourProps> = (props) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = getPalette(props.palette);
  const loop = props.loop ?? false;
  const clips = props.clips;
  const resolved = useMemo(
    (): ResolvedClip[] => props.resolved ?? clips.map((_, i) => ({ start: i * 3, dur: 3, scale: 1, fileDur: 0, fps: 30 })),
    [props.resolved, clips],
  );
  const maps = useMemo(
    () => clips.map((c, i) => buildSpeedMap(c, enterOf(clips, i, loop), resolved[i].scale)),
    [clips, loop, resolved],
  );
  // второй кадр стопкой идёт ровно со своей скоростью от stack.in
  const stackMaps = useMemo(
    () =>
      clips.map((c) => {
        if (!c.stack) return null;
        const v = c.stack.speed ?? 1;
        return { dur: 30, srcAt: (o: number) => c.stack!.in + o * v, speedAt: () => v, toLocal: (t: number) => (t - c.stack!.in) / v };
      }),
    [clips],
  );
  const total = durationInFrames / fps;
  const o = f / fps;
  const motionBlur = props.motionBlur ?? true;
  const last = clips.length - 1;

  // длительность перехода не больше 80% соседних клипов
  const dOf = (i: number) => {
    const next = i === last ? 0 : i + 1;
    return Math.min(transitionDur(clips[i].exit), resolved[i].dur * 0.8, resolved[next].dur * 0.8);
  };

  const single = (i: number, local: number, fx?: LayerFx) => (
    <ClipLayer
      key={`c${i}`}
      clip={clips[i]}
      map={maps[i]}
      local={local}
      fileDur={resolved[i].fileDur}
      srcFps={resolved[i].fps}
      motionBlur={motionBlur}
      fx={fx}
    />
  );
  // два кадра стопкой: сверху клип, снизу деталь (stack) — оба движутся; во время перехода стопка двигается целиком
  const layer = (i: number, local: number, fx?: LayerFx) => {
    const st = clips[i].stack;
    if (!st || !stackMaps[i]) return single(i, local, fx);
    const half = (top: boolean, node: React.ReactNode) => (
      <div style={{ position: "absolute", left: 0, width: W, top: top ? 0 : H / 2 + 5, height: H / 2 - 5, overflow: "hidden" }}>{node}</div>
    );
    const { scale, card, ...rest } = fx ?? {};
    return (
      <div
        key={`st${i}`}
        style={{
          position: "absolute",
          inset: 0,
          transform: scale && card ? `scale(${scale})` : undefined,
          borderRadius: card ? 34 : undefined,
          overflow: "hidden",
        }}
      >
        {half(true, single(i, local, rest))}
        {half(
          false,
          <ClipLayer
            clip={{ file: st.file, in: st.in, out: st.in + 30, push: clips[i].push }}
            map={stackMaps[i]!}
            local={local}
            fileDur={resolved[i].stackDur ?? 0}
            srcFps={30}
            motionBlur={false}
            fx={rest}
          />,
        )}
      </div>
    );
  };

  let i = 0;
  while (i < last && o >= resolved[i + 1].start) i++;

  let content: React.ReactNode;
  // клип, который сейчас на экране один (вне перехода): только на нём показываем надписи и рулетки
  let solo = -1;
  let wall: Pair["wall"];
  const pair = (a: number, aLocal: number, b: number, bLocal: number, t: TourTransition, prog: number) => {
    const fx = transitionFx(t, prog);
    wall = fx.wall;
    return (
      <>
        {fx.showA ? layer(a, aLocal, fx.a) : null}
        {fx.showB ? <div key={`b${b}`} style={{ position: "absolute", inset: 0 }}>{layer(b, bLocal, fx.b)}</div> : null}
      </>
    );
  };

  const exitD = dOf(i);
  const enterD = i > 0 ? dOf(i - 1) : 0;
  if (i < last && exitD > 0 && o >= resolved[i + 1].start - exitD / 2) {
    const b = resolved[i + 1].start;
    content = pair(i, o - resolved[i].start, i + 1, o - b, clips[i].exit!, (o - (b - exitD / 2)) / exitD);
  } else if (i > 0 && enterD > 0 && o < resolved[i].start + enterD / 2) {
    const b = resolved[i].start;
    content = pair(i - 1, o - resolved[i - 1].start, i, o - b, clips[i - 1].exit!, (o - (b - enterD / 2)) / enterD);
  } else if (i === last && loop && exitD > 0 && o >= total - exitD) {
    // петля: последний клип уходит в самое начало ролика — после повтора стык не виден
    content = pair(last, o - resolved[last].start, 0, o - total, clips[last].exit!, (o - (total - exitD)) / exitD);
  } else {
    content = layer(i, o - resolved[i].start);
    solo = i;
  }

  const grade = GRADE[props.grade ?? "clean"];
  const gradeFilter = [grade.filter, props.sharpen ? "url(#tour-sharp)" : ""].filter(Boolean).join(" ");
  const loopTail = loop ? dOf(last) : 0;
  const musicFrom = Math.round((props.musicStart ?? 0) * fps);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <TourFilters />
      <AbsoluteFill style={{ filter: gradeFilter || undefined }}>{content}</AbsoluteFill>
      {grade.tint ? <AbsoluteFill style={{ background: grade.tint, mixBlendMode: "soft-light" }} /> : null}
      {wall ? <Wall w={wall} /> : null}

      <Marks surfaces={(props.surfaces ?? []).filter((m) => m.clip === solo)} rulers={(props.rulers ?? []).filter((m) => m.clip === solo)} maps={maps} resolved={resolved} p={p} />
      <Tags tags={props.tags ?? []} clips={clips} maps={maps} resolved={resolved} p={p} />
      {props.hook ? <Hook hook={props.hook} p={p} /> : null}
      {props.endCard ? <EndCard card={props.endCard} end={total - loopTail} p={p} /> : null}

      {props.musicFile ? (
        <Audio
          src={staticFile(props.musicFile)}
          trimBefore={musicFrom}
          loop
          volume={(fr) => {
            // при петле конец не затухает до тишины — повтор звучит естественно
            const fade = interpolate(fr, [0, 6, durationInFrames - (loop ? 6 : 24), durationInFrames], [0, 1, 1, loop ? 0.6 : 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (props.musicVolume ?? 0.9) * fade;
          }}
        />
      ) : null}
      {(props.sfx ?? []).map((s, k) => {
        const at = resolved[s.clip] ? resolved[s.clip].start + s.offset : -1;
        if (at < 0) return null;
        return (
          <Sequence key={`sfx${k}`} from={Math.round(at * fps)}>
            <Audio src={staticFile(`sfx/${s.sound}.wav`)} volume={s.volume ?? 0.5} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
