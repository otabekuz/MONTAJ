import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import type { Timeline } from "./cuts";
import type { TItem } from "./Transitions";
import type { Cue, Overlay } from "./schema";

// Звук: удар, нарастание, глитч, pop, tick, shine. Whoosh не используем (решение владельца скилла).
// Файлы генерирует `npm run sfx` в public/sfx/.
type Sfx = "impact" | "riser" | "shine" | "glitch" | "pop" | "tick";
type Ev = { frame: number; sound: Sfx; volume: number };

export const RISER_SECONDS = 1.6;

const overlaySounds = (o: Overlay, from: number, fps: number, frames: number, tl: Timeline): Ev[] => {
  const s = (sec: number, sound: Sfx, volume: number): Ev => ({ frame: from + Math.round(sec * fps), sound, volume });
  switch (o.type) {
    case "title": return [s(0.05, "pop", 0.3)];
    case "tool": return [s(0, "pop", 0.38)];
    case "chat": return [s(0.15, "tick", 0.3)];
    case "screen": return o.zoomTo ? [s(0, "pop", 0.28), s(1.6, "shine", 0.28)] : [s(0, "pop", 0.28)];
    case "steps": return o.items.map((_, i) => s(0.4 + i * 0.85, "tick", 0.38));
    case "number": return [s(0.1, "tick", 0.3), s(1.3, "shine", 0.38)];
    case "accent": return [s(0, "impact", 0.5)];
    case "slam": return [s(0.03, "impact", 0.7)];
    case "icon": return o.items.map((_, i) => s((i * 6) / fps, "pop", 0.28));
    case "compare": return [s(0.55, "tick", 0.4), s(1.0, "pop", 0.34)];
    case "flow": return o.nodes.map((_, i) => s(0.15 + i * 0.75, "pop", 0.3));
    case "typed": return [s(0, "tick", 0.22)];
    case "paper": return [s(0, "pop", 0.25), ...o.items.map((_, i) => (o.times?.[i] !== undefined ? { frame: tl.toFrame(o.times[i]) + 6, sound: "tick" as const, volume: 0.36 } : s(0.7 + i * 0.9, "tick", 0.36)))];
    case "clones": return [0, 1, 2].map((i) => s((i * 4) / fps, "pop", 0.26));
    case "morph": return [{ frame: from + Math.round(frames * 0.62), sound: "shine", volume: 0.4 }];
    case "hub": return [s(0, "pop", 0.3), ...o.items.map((_, i) => (o.times?.[i] !== undefined ? { frame: tl.toFrame(o.times[i]), sound: "pop" as const, volume: 0.28 } : s(0.6 + i * 0.6, "pop", 0.26)))];
    case "chart": return o.bars.map((_, i) => s((8 + i * 6) / fps, "tick", 0.3));
    case "property": return [s(0, "pop", 0.3), s(0.6, "shine", 0.3)];
    case "location": return [s(0.6, "pop", 0.4)];
    case "districts":
      return o.focus.length
        ? [
            s(0.1, "tick", 0.3),
            ...o.focus.map((x, i) => (x.at !== undefined ? { frame: tl.toFrame(x.at), sound: "pop" as const, volume: 0.42 } : s((8 + i * Math.round(0.6 * fps)) / fps, "pop", 0.42))),
            ...(o.objects && o.objects !== "none" ? [{ frame: (o.focus[0].at !== undefined ? tl.toFrame(o.focus[0].at) : from + 8) + 14, sound: "shine" as const, volume: 0.3 }] : []),
          ]
        : [s(0.1, "tick", 0.3), s(0.35, "pop", 0.35)];
    case "broll": return [];
    case "tg":
      return [
        s(0.05, "pop", 0.3),
        ...(o.messages ?? []).flatMap((m) => [
          { frame: tl.toFrame(m.at + (m.from === "user" ? (m.typeDur ?? 0) : 0)), sound: "pop" as const, volume: 0.32 },
          ...(m.chips ?? []).map((c) => ({ frame: c.at !== undefined ? tl.toFrame(c.at) : tl.toFrame(m.at) + 6, sound: "tick" as const, volume: 0.3 })),
        ]),
        ...(o.search ? [{ frame: tl.toFrame(o.search.at), sound: "tick" as const, volume: 0.3 }] : []),
        ...(o.tapAt !== undefined ? [{ frame: tl.toFrame(o.tapAt), sound: "pop" as const, volume: 0.4 }] : []),
      ];
    case "feed": return [s(0, "tick", 0.25), ...(o.aiAt !== undefined ? [{ frame: tl.toFrame(o.aiAt), sound: "shine" as const, volume: 0.4 }] : [])];
    case "notify":
      return [
        ...(o.heroAt !== undefined ? [{ frame: tl.toFrame(o.heroAt), sound: "shine" as const, volume: 0.35 }] : []),
        ...o.items.map((it) => ({ frame: tl.toFrame(it.at), sound: "pop" as const, volume: 0.45 })),
      ];
    case "days": return [...Array.from({ length: 7 }, (_, i) => s(0.15 + i * 0.25, "tick", 0.22)), ...(o.strikeAt !== undefined ? [{ frame: tl.toFrame(o.strikeAt), sound: "impact" as const, volume: 0.3 }] : [])];
    case "chip": return [s(0.05, "pop", 0.3), s(0.3, "tick", 0.2)];
    case "giant": return [s(0, "impact", 0.32), s(0.15, "shine", 0.18)];
  }
};

const transitionSound: Record<TItem["type"], Sfx | null> = {
  leak: null,
  flash: "shine",
  glitch: "glitch",
  wipe: "tick",
  smear: null,
  whip: null,
};

export const SoundLayer: React.FC<{
  overlays: Overlay[];
  transitions: TItem[];
  cues: Cue[];
  tl: Timeline;
  sfx: boolean;
  musicFile: string;
  beatWindows: [number, number][];
  ctaFrom: number | null;
}> = ({ overlays, transitions, cues, tl, sfx, musicFile, beatWindows, ctaFrom }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const events: Ev[] = [];
  if (sfx) {
    overlays.forEach((o) => {
      const { from, frames } = tl.span(o.at, o.dur);
      events.push(...overlaySounds(o, from, fps, frames, tl));
    });
    transitions.forEach((t) => {
      const snd = transitionSound[t.type];
      if (snd) events.push({ frame: t.frame - 2, sound: snd, volume: 0.32 });
    });
    cues.forEach((c) => {
      const at = tl.toFrame(c.at);
      events.push({ frame: c.sound === "riser" ? at - Math.round(RISER_SECONDS * fps) : at, sound: c.sound, volume: c.volume });
    });
    if (ctaFrom !== null) events.push({ frame: ctaFrom, sound: "pop", volume: 0.4 });
  }
  // во время «тишины перед главной мыслью» никаких звуков
  const silent = (f: number) => beatWindows.some(([a, b]) => f >= a && f < b);
  return (
    <>
      {events
        .filter((e) => e.frame >= 0 && e.frame < durationInFrames && !silent(e.frame))
        .map((e, i) => (
          <Sequence key={i} from={e.frame} layout="none" durationInFrames={Math.round((e.sound === "riser" ? RISER_SECONDS + 0.3 : 1.6) * fps)}>
            <Audio src={staticFile(`sfx/${e.sound}.wav`)} volume={e.volume} />
          </Sequence>
        ))}
      {musicFile ? (
        <Audio
          src={staticFile(musicFile)}
          loop
          volume={(f) => {
            const fade = interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const duck = beatWindows.some(([a, b]) => f >= a - 4 && f < b) ? 0.12 : 1;
            return 0.13 * fade * duck;
          }}
        />
      ) : null}
    </>
  );
};
