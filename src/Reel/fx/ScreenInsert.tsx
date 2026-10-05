import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_IN_OUT, enter, exit } from "../motion";
import { Center, type FxProps } from "./common";

// Скриншот в телефоне (вертикальный) или в широком окне (горизонтальный).
// zoomTo: через ~1 с камера наезжает на область и обводит её рамкой акцентного цвета.
export const ScreenInsert: React.FC<FxProps<OverlayOf<"screen">>> = ({ o, total, zone, p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isWindow = o.frame === "window";
  const inT = enter(f, 0, 14);
  const out = exit(f, total, 8);

  const maxH = zone.h - 70;
  // телефон — в пропорциях скриншота iPhone (9 : 19,5), чтобы скриншот входил целиком и zoomTo совпадал с картинкой
  const w = isWindow ? Math.min(zone.w - 60, 1000) : Math.min(600, maxH * 0.462);
  const h = isWindow ? w * 0.68 : Math.min(maxH, w * 2.165);

  const z = o.zoomTo;
  // наезд через ~1 с, а у коротких кадров — раньше (на 25% длительности), чтобы успел случиться
  const z0 = Math.min(fps, Math.round(total * 0.25));
  const zt = z ? interpolate(f, [z0, z0 + 0.5 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT }) : 0;
  const scale = z ? 1 + zt * (Math.min(1 / z.w, 1 / z.h) * 0.75 - 1) : 1;
  const cx = z ? z.x + z.w / 2 : 0.5;
  const cy = z ? z.y + z.h / 2 : 0.5;
  // сдвиг не больше, чем позволяет увеличение — иначе за краем скриншота открывается пустота
  const lim = (len: number) => ((scale - 1) * len) / 2;
  const clampTo = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const tx = clampTo((0.5 - cx) * w * zt * scale, lim(w));
  const ty = clampTo((0.5 - cy) * h * zt * scale, lim(h));
  const frameT = enter(f, z0 + 0.5 * fps, 10);

  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ transform: `translateY(${(1 - inT) * 80}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {o.title ? (
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 30, color: p.muted, marginBottom: 18, letterSpacing: 1, maxWidth: w, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {o.title}
          </div>
        ) : null}
        <div
          style={{
            width: w,
            height: h,
            borderRadius: isWindow ? 22 : 64,
            border: isWindow ? "2px solid rgba(255,255,255,0.12)" : "14px solid #0c0c0c",
            outline: isWindow ? "none" : "2px solid rgba(255,255,255,0.14)",
            background: "#111",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 50px 100px rgba(0,0,0,0.6)",
          }}
        >
          {isWindow ? (
            <div style={{ height: 44, background: "#1b1b1b", display: "flex", alignItems: "center", gap: 10, paddingLeft: 18 }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
              ))}
            </div>
          ) : null}
          <div style={{ position: "absolute", left: 0, right: 0, top: isWindow ? 44 : 0, bottom: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
              {o.image ? (
                <Img src={staticFile(o.image)} style={{ width: "100%", height: "100%", objectFit: isWindow ? "contain" : "cover", objectPosition: "top" }} />
              ) : (
                <MockChat p={p} />
              )}
              {z ? (
                <div
                  style={{
                    position: "absolute",
                    left: `${z.x * 100}%`,
                    top: `${z.y * 100}%`,
                    width: `${z.w * 100}%`,
                    height: `${z.h * 100}%`,
                    border: `${4 / scale}px solid ${p.accent}`,
                    borderRadius: 10 / scale,
                    opacity: frameT,
                    boxShadow: `0 0 ${30 / scale}px ${p.accent}`,
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Center>
  );
};

const MockChat: React.FC<{ p: FxProps<unknown>["p"] }> = ({ p }) => (
  <div style={{ position: "absolute", inset: 0, background: "#151515", padding: 30, display: "flex", flexDirection: "column", gap: 22 }}>
    {[0.7, 0.5, 0.8, 0.45, 0.65].map((wd, i) => (
      <div
        key={i}
        style={{
          alignSelf: i % 2 ? "flex-start" : "flex-end",
          width: `${wd * 100}%`,
          height: 60,
          borderRadius: 24,
          background: i % 2 ? "rgba(255,255,255,0.08)" : p.accentSoft,
        }}
      />
    ))}
  </div>
);
