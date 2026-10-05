import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { OverlayOf } from "../schema";
import { enter, exit } from "../motion";
import type { FxProps } from "./common";

const VIDEO = /\.(mp4|mov|webm|m4v)$/i;

// B-roll: видео или фото владельца с медленным наездом (Ken Burns).
export const Broll: React.FC<FxProps<OverlayOf<"broll">>> = ({ o, total }) => {
  const f = useCurrentFrame();
  const t = Math.min(enter(f, 0, 8), exit(f, total, 6));
  const scale = interpolate(f, [0, total], [1.04, 1.14]);
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` };
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: t, background: "#000" }}>
      {VIDEO.test(o.file) ? (
        <OffthreadVideo src={staticFile(o.file)} muted style={style} />
      ) : (
        <Img src={staticFile(o.file)} style={style} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.35) 100%)" }} />
    </div>
  );
};
