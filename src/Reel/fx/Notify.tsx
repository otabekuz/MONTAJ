import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";
import { LuxuryArt, PhoneFrame } from "./LuxuryArt";

// «Появился новый объект — бот сам присылает»: заблокированный телефон на фоне элитной квартиры,
// сначала (hero) в центре вспыхивает новая квартира с меткой, затем сверху падают уведомления Telegram.
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Notify: React.FC<FxProps<OverlayOf<"notify">>> = ({ o, total, zone, p, local }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = Math.min(zone.h - 30, 1060);
  const W = H / 2.05;
  const inT = enter(f, 0, 12);
  const out = exit(f, total, 8);
  const heroAt = o.heroAt !== undefined ? local(o.heroAt) : 4;
  const hero = pop(f, fps, heroAt, 170);
  const firstNote = o.items.length ? local(o.items[0].at) : Infinity;
  const heroShrink = interpolate(f, [firstNote - 4, firstNote + 10], [1, 0.62], { ...clamp, easing: EASE_OUT });
  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ transform: `translateY(${(1 - inT) * 150}px)` }}>
        <PhoneFrame w={W} h={H}>
          <div style={{ position: "absolute", inset: 0, filter: "blur(6px) brightness(0.55)", transform: "scale(1.1)" }}>
            <LuxuryArt variant={1} />
          </div>
          <div style={{ position: "absolute", top: H * 0.1, left: 0, right: 0, textAlign: "center", fontFamily: FONT, color: "#fff" }}>
            <div style={{ fontSize: W * 0.05, opacity: 0.8 }}>{o.dateLabel ?? ""}</div>
            <div style={{ fontSize: W * 0.22, fontWeight: 300, letterSpacing: -4, lineHeight: 1 }}>{o.clock ?? "09:41"}</div>
          </div>
          {/* новая квартира */}
          <div style={{ position: "absolute", left: "50%", top: H * 0.56, width: W * 0.8, transform: `translate(-50%, -50%) scale(${hero * heroShrink})`, borderRadius: 26, overflow: "hidden", boxShadow: `0 0 0 3px ${p.accent}, 0 30px 70px rgba(0,0,0,0.6), 0 0 60px ${p.accentSoft}` }}>
            <div style={{ height: W * 0.6 }}>
              <LuxuryArt variant={4} />
            </div>
            <div style={{ position: "absolute", top: 14, left: 14, padding: "8px 16px", borderRadius: 999, background: p.accent, color: p.onAccent, fontFamily: FONT, fontWeight: 900, fontSize: W * 0.045, letterSpacing: 2 }}>{o.heroLabel ?? "НОВЫЙ"}</div>
          </div>
          {/* уведомления */}
          {o.items.map((it, i) => {
            const at = local(it.at);
            const s = pop(f, fps, at, 230);
            const y = H * 0.27 + i * (W * 0.24);
            return (
              <div key={i} style={{ position: "absolute", left: W * 0.04, right: W * 0.04, top: y, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * -160}px) scale(${0.9 + 0.1 * s})`, borderRadius: 22, background: "rgba(245,245,247,0.92)", backdropFilter: "blur(10px)", padding: W * 0.035, display: "flex", gap: W * 0.03, alignItems: "center", fontFamily: FONT, boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>
                <div style={{ width: W * 0.12, height: W * 0.12, borderRadius: W * 0.03, background: "#2AABEE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="send" size={W * 0.065} color="#fff" stroke={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: W * 0.038, color: "#111", fontWeight: 700 }}>
                    <span>{it.title}</span>
                    <span style={{ fontWeight: 400, color: "#777" }}>{it.time ?? "сейчас"}</span>
                  </div>
                  <div style={{ fontSize: W * 0.036, color: "#333", marginTop: 2 }}>{it.text}</div>
                </div>
                <div style={{ width: W * 0.13, height: W * 0.13, borderRadius: W * 0.025, overflow: "hidden", flexShrink: 0, opacity: interpolate(f, [at + 6, at + 12], [0, 1], clamp) }}>
                  <LuxuryArt variant={i + 2} />
                </div>
              </div>
            );
          })}
        </PhoneFrame>
      </div>
    </Center>
  );
};
