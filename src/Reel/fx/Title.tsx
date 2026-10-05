import { useCurrentFrame } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { enter, exit } from "../motion";
import { balance, Center, fitFont, type FxProps, Label } from "./common";

// Заголовок блока: слова выезжают из-под маски по очереди, сверху — маленькая метка.
export const Title: React.FC<FxProps<OverlayOf<"title">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const lines = balance(o.text.toUpperCase(), 12);
  const size = fitFont(lines.join("\n"), zone.w - 140, 150, 78, 0.6);
  const out = exit(f, total, 7);
  let wordIndex = 0;
  return (
    <Center style={{ opacity: out, transform: `translateY(${(1 - out) * -30}px)` }}>
      <div style={{ marginBottom: 28 }}>
        <Label text={o.sub} p={p} opacity={enter(f, 0, 10)} />
      </div>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", gap: size * 0.25, justifyContent: "center" }}>
          {line.split(" ").map((w, wi) => {
            const t = enter(f, 3 + wordIndex++ * 3, 12);
            return (
              <div key={wi} style={{ overflow: "hidden", paddingBottom: size * 0.08 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 900,
                    fontSize: size,
                    lineHeight: 1,
                    letterSpacing: -size * 0.03,
                    color: p.text,
                    transform: `translateY(${(1 - t) * 110}%)`,
                  }}
                >
                  {w}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div
        style={{
          marginTop: 30,
          height: 5,
          width: 160 * enter(f, 10, 16),
          background: p.accent,
          borderRadius: 3,
        }}
      />
    </Center>
  );
};
