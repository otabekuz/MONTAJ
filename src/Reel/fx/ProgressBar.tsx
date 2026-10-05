import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette } from "../theme";

// Тонкая полоска прогресса сверху: зритель видит, что ролик короткий, и досматривает.
export const ProgressBar: React.FC<{ p: Palette }> = ({ p }) => {
  const f = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height: 6, background: "rgba(255,255,255,0.12)" }}>
      <div style={{ width: `${(f / Math.max(1, durationInFrames - 1)) * 100}%`, height: "100%", background: p.accent }} />
    </div>
  );
};
