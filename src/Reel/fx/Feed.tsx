import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_IN_OUT, EASE_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";
import { LuxuryArt, PhoneFrame } from "./LuxuryArt";

// «Листаете сотни объявлений»: в телефоне бешено летит лента одинаковых серых карточек, палец свайпает.
// aiAt — включается ИИ: лента тормозит, по ней идёт сканер, серые гаснут, а несколько карточек
// превращаются в элитные квартиры со свечением и галочкой. Над телефоном — ИИ-ядро.
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CARD = 250;

export const Feed: React.FC<FxProps<OverlayOf<"feed">>> = ({ o, total, zone, p, local }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = Math.min(zone.h - 300, 780);
  const W = H / 2.05;
  const inT = enter(f, 0, 10);
  const out = exit(f, total, 8);
  const aiF = o.aiAt !== undefined ? local(o.aiAt) : Infinity;
  const ai = interpolate(f, [aiF, aiF + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  // скорость ленты: быстро → тормозит, когда включается ИИ
  const speed = 46 * (1 - ai) + 1.5 * ai;
  const pos = f < aiF ? f * 46 : aiF * 46 + (f - aiF) * speed * 0.4;
  const scan = interpolate(f, [aiF + 4, aiF + 30], [-0.1, 1.1], { ...clamp, easing: EASE_IN_OUT });
  const n = Math.ceil(H / CARD) + 2;
  const first = Math.floor(pos / CARD);
  const elite = (idx: number) => random(`elite${idx}`) < 0.3;
  const core = pop(f, fps, aiF, 200);
  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      {o.label ? (
        <div style={{ position: "absolute", top: 10, fontFamily: FONT, fontWeight: 300, fontSize: 40, color: "#fff", opacity: 0.9 * (1 - ai), letterSpacing: 1 }}>{o.label}</div>
      ) : null}
      <div style={{ transform: `translateY(${(1 - inT) * 160}px) rotate(${-4 + 4 * ai}deg)`, position: "relative", marginTop: 250 }}>
        <PhoneFrame w={W} h={H}>
          <div style={{ position: "absolute", inset: 0, background: "#f1f1f3", filter: ai < 1 ? `blur(${Math.min(6, speed / 9)}px)` : undefined }}>
            {Array.from({ length: n }).map((_, k) => {
              const idx = first + k;
              const y = idx * CARD - pos;
              const isElite = elite(idx) && ai > 0;
              const lit = isElite ? interpolate(scan, [y / H - 0.05, y / H + 0.1], [0, 1], clamp) : 0;
              return (
                <div key={idx} style={{ position: "absolute", left: 14, right: 14, top: y + 20, height: CARD - 24, borderRadius: 16, background: "#fff", overflow: "hidden", boxShadow: lit ? `0 0 0 3px ${p.accent}, 0 0 40px ${p.accent}` : "0 2px 6px rgba(0,0,0,0.08)", opacity: ai > 0 && !isElite ? 1 - 0.65 * Math.min(1, scan * 1.4) : 1, transform: `scale(${1 + 0.04 * lit})`, zIndex: lit ? 2 : 1 }}>
                  <div style={{ height: "62%", background: "#c9ccd2", position: "relative" }}>
                    {lit > 0 ? <div style={{ position: "absolute", inset: 0, opacity: lit }}><LuxuryArt variant={idx} /></div> : null}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ height: 14, width: "70%", borderRadius: 7, background: lit ? p.accent : "#b9bcc3" }} />
                    <div style={{ height: 12, width: "45%", borderRadius: 6, background: "#d8dadf", marginTop: 10 }} />
                  </div>
                  {lit > 0.5 ? (
                    <div style={{ position: "absolute", top: 10, right: 10, width: 44, height: 44, borderRadius: 22, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop(f, fps, aiF + 20, 260)})` }}>
                      <Icon name="right" size={28} color={p.onAccent} stroke={2.6} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {ai > 0 && scan < 1.05 ? <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 5, background: p.accent, boxShadow: `0 0 30px 8px ${p.accent}` }} /> : null}
          </div>
        </PhoneFrame>
        {/* палец свайпает, пока листаем вручную */}
        {ai < 1 ? (
          <div style={{ position: "absolute", right: -30, top: H * 0.55 - ((f * 3) % 30) * 8, width: 90, height: 90, borderRadius: 45, background: "rgba(255,255,255,0.55)", boxShadow: "0 0 0 12px rgba(255,255,255,0.18)", opacity: 1 - ai }} />
        ) : null}
        {/* ИИ-ядро */}
        {ai > 0 ? (
          <div style={{ position: "absolute", left: "50%", top: -70, transform: `translate(-50%, 0) scale(${core})`, width: 150, height: 150, borderRadius: 75, background: `radial-gradient(circle, #fff 0%, ${p.accent} 45%, rgba(0,0,0,0) 72%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 90px ${p.accent}` }}>
            <Icon name="ai" size={70} color={p.onAccent} stroke={2} />
            {[0, 1, 2].map((r) => (
              <div key={r} style={{ position: "absolute", inset: -20 - r * 22, borderRadius: "50%", border: `2px solid ${p.accent}`, opacity: 0.5 - r * 0.14, transform: `rotate(${f * (3 + r)}deg) scaleX(${1 + 0.15 * Math.sin(f / 9 + r)})` }} />
            ))}
          </div>
        ) : null}
      </div>
    </Center>
  );
};
