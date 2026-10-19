import { Composition, Folder } from "remotion";
import { demoFull, demoSplit, demoVoice } from "./Reel/demo";
import { FPS, H, W } from "./Reel/layout";
import { calculateReelMetadata } from "./Reel/meta";
import { Matte, type MatteProps } from "./Reel/Matte";
import { Reel } from "./Reel/Reel";
import { type ReelProps, reelSchema } from "./Reel/schema";
import { calculateTourMetadata } from "./Tour/meta";
import { type TourProps, tourSchema } from "./Tour/schema";
import { Tour } from "./Tour/Tour";

// Reel — настоящий ролик: план передаётся через --props=reels/<slug>/edit.json.
// Tour — обзор объекта без речи: план reels/<slug>/edit.json с "layout": "tour".
// Демо — проверка элементов и палитр без видео (цифры в демо условные).

const tourDefaults: TourProps = {
  layout: "tour",
  clips: [{ file: "reels/tour-demo/clip-01.mp4", in: 0, out: 3 }],
  musicFile: "",
  grade: "clean",
};

const reelDefaults: ReelProps = (() => {
  const d = demoFull("uz", "sky");
  return { ...d, captions: undefined };
})();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        schema={reelSchema}
        defaultProps={reelDefaults}
        calculateMetadata={calculateReelMetadata}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Tour"
        component={Tour}
        schema={tourSchema}
        defaultProps={tourDefaults}
        calculateMetadata={calculateTourMetadata}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Matte"
        component={Matte}
        defaultProps={{ slug: "", width: W, height: H, frames: 1 } as MatteProps}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.frames) })}
        durationInFrames={1}
        fps={FPS}
        width={W}
        height={H}
      />
      <Folder name="Demo">
        <Composition id="ReelDemo" component={Reel} defaultProps={demoFull("uz", "sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoRu" component={Reel} defaultProps={demoFull("ru", "champagne")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoSplit" component={Reel} defaultProps={demoSplit("sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoVoice" component={Reel} defaultProps={demoVoice("sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
      </Folder>
    </>
  );
};
