import { Composition, Folder } from "remotion";
import { demoFull, demoSplit, demoVoice } from "./Reel/demo";
import { FPS, H, W } from "./Reel/layout";
import { calculateReelMetadata } from "./Reel/meta";
import { Reel } from "./Reel/Reel";
import { type ReelProps, reelSchema } from "./Reel/schema";

// Reel — настоящий ролик: план передаётся через --props=reels/<slug>/edit.json.
// Демо — проверка элементов и палитр без видео (цифры в демо условные).

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
      <Folder name="Demo">
        <Composition id="ReelDemo" component={Reel} defaultProps={demoFull("uz", "sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoRu" component={Reel} defaultProps={demoFull("ru", "champagne")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoSplit" component={Reel} defaultProps={demoSplit("sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
        <Composition id="ReelDemoVoice" component={Reel} defaultProps={demoVoice("sky")} calculateMetadata={calculateReelMetadata} durationInFrames={FPS * 20} fps={FPS} width={W} height={H} />
      </Folder>
    </>
  );
};
