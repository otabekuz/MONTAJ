import { Sequence } from "remotion";
import type { Timeline } from "./cuts";
import { Accent } from "./fx/Accent";
import { BigNumber } from "./fx/BigNumber";
import { Broll } from "./fx/Broll";
import { Chart } from "./fx/Chart";
import { ChatPrompt } from "./fx/ChatPrompt";
import { Chip } from "./fx/Chip";
import { Compare } from "./fx/Compare";
import { DistrictMap } from "./fx/DistrictMap";
import { Concept } from "./fx/Concept";
import { Flow } from "./fx/Flow";
import { Hub } from "./fx/Hub";
import { Location } from "./fx/Location";
import { Paper } from "./fx/Paper";
import { Property } from "./fx/Property";
import { ScreenInsert } from "./fx/ScreenInsert";
import { Clones, Morph } from "./fx/Sites";
import { Slam } from "./fx/Slam";
import { Steps } from "./fx/Steps";
import { Title } from "./fx/Title";
import { ToolCard } from "./fx/ToolCard";
import { Typed } from "./fx/Typed";
import type { FxProps } from "./fx/common";
import { type Box, H, W } from "./layout";
import type { Overlay } from "./schema";
import type { Palette } from "./theme";

/** Элементы, которые в full уводят спикера в размытие (графике нужен спокойный фон) */
export const HEAVY = new Set<Overlay["type"]>(["chat", "steps", "number", "title", "screen", "compare", "flow", "chart", "paper", "hub", "clones", "morph", "property", "location", "districts", "typed", "icon"]);

const renderFx = (o: Overlay, props: Omit<FxProps<never>, "o">) => {
  switch (o.type) {
    case "title": return <Title o={o} {...props} />;
    case "accent": return <Accent o={o} {...props} />;
    case "typed": return <Typed o={o} {...props} />;
    case "slam": return <Slam o={o} {...props} />;
    case "tool": return <ToolCard o={o} {...props} />;
    case "chat": return <ChatPrompt o={o} {...props} />;
    case "steps": return <Steps o={o} {...props} />;
    case "number": return <BigNumber o={o} {...props} />;
    case "screen": return <ScreenInsert o={o} {...props} />;
    case "broll": return <Broll o={o} {...props} />;
    case "icon": return <Concept o={o} {...props} />;
    case "compare": return <Compare o={o} {...props} />;
    case "flow": return <Flow o={o} {...props} />;
    case "chart": return <Chart o={o} {...props} />;
    case "paper": return <Paper o={o} {...props} />;
    case "clones": return <Clones o={o} {...props} />;
    case "morph": return <Morph o={o} {...props} />;
    case "hub": return <Hub o={o} {...props} />;
    case "property": return <Property o={o} {...props} />;
    case "location": return <Location o={o} {...props} />;
    case "districts": return <DistrictMap o={o} {...props} />;
    case "chip": return <Chip o={o} {...props} />;
    case "giant": return null; // рисуется за спиной человека — см. Reel.tsx
  }
};

const FULL_FRAME: Box = { x: 0, y: 0, w: W, h: H };

export const Overlays: React.FC<{
  overlays: Overlay[];
  tl: Timeline;
  zone: Box;
  layout: "full" | "split" | "voice";
  lang: "uz" | "ru";
  p: Palette;
  gfxStyle: React.CSSProperties;
}> = ({ overlays, tl, zone, layout, lang, p, gfxStyle }) => (
  <>
    {overlays.map((o, i) => {
      if (o.type === "giant") return null;
      const { from, frames } = tl.span(o.at, o.dur);
      // slam — всегда весь кадр; broll в full — перебивка на весь кадр
      const full = o.type === "slam" || o.type === "chip" || (o.type === "broll" && layout === "full");
      const box = full ? FULL_FRAME : zone;
      return (
        <Sequence key={i} from={from} durationInFrames={frames} layout="none" name={`${o.type} ${o.at}s`}>
          <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: full ? "hidden" : "visible", ...(full ? {} : gfxStyle) }}>
            {renderFx(o, { total: frames, zone: { ...box, x: 0, y: 0 }, p, layout, lang, local: (s) => tl.toFrame(s) - from })}
          </div>
        </Sequence>
      );
    })}
  </>
);
