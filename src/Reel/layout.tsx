import type { ReelProps } from "./schema";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export type Box = { x: number; y: number; w: number; h: number };

// Безопасные зоны Reels: сверху ~220 px (шапка), снизу ~360 px (подпись, кнопки), справа ~140 px (лайки).
export type Zones = {
  /** где живёт графика */
  gfx: Box;
  /** центр строки субтитров по вертикали */
  captionY: number;
  /** где стоит спикер (null — спикера нет) */
  speaker: Box | null;
};

export const SPLIT_TOP = 896;

export const zonesFor = (layout: ReelProps["layout"]): Zones => {
  switch (layout) {
    case "split":
      return {
        // графика не заходит на субтитры у стыка половин и под шапку Instagram
        gfx: { x: 0, y: 110, w: W, h: SPLIT_TOP - 110 - 80 },
        captionY: SPLIT_TOP + 10,
        speaker: { x: 0, y: SPLIT_TOP, w: W, h: H - SPLIT_TOP },
      };
    case "voice":
      return {
        gfx: { x: 0, y: 200, w: W, h: 1080 },
        captionY: 1440,
        speaker: null,
      };
    case "full":
    default:
      return {
        gfx: { x: 0, y: 240, w: W, h: 960 },
        captionY: 1390,
        speaker: { x: 0, y: 0, w: W, h: H },
      };
  }
};

export const boxStyle = (b: Box): React.CSSProperties => ({
  position: "absolute",
  left: b.x,
  top: b.y,
  width: b.w,
  height: b.h,
});
