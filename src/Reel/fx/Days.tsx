import { interpolate, useCurrentFrame } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_OUT, exit } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";

// «Каждый день заходить и повторять поиск»: неделя из 7 дней, в каждом по очереди вспыхивает поиск,
// затем вся неделя перечёркивается (strikeAt) и появляется подпись (label).
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const DAYS = { ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] };

export const Days: React.FC<FxProps<OverlayOf<"days">>> = ({ o, total, p, lang, local }) => {
  const f = useCurrentFrame();
  const out = exit(f, total, 8);
  const strike = o.strikeAt !== undefined ? local(o.strikeAt) : Math.round(total * 0.65);
  const st = interpolate(f, [strike, strike + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const per = Math.max(3, Math.floor((strike - 6) / 7));
  return (
    <Center style={{ opacity: out }}>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 210px)", gap: 22 }}>
        {DAYS[lang].map((d, i) => {
          const t = interpolate(f, [4 + i * per, 4 + i * per + 6], [0, 1], { ...clamp, easing: EASE_OUT });
          const active = f >= 4 + i * per && f < 4 + (i + 1) * per && st === 0;
          return (
            <div key={i} style={{ height: 210, borderRadius: 30, background: active ? p.accentSoft : "rgba(255,255,255,0.05)", border: `2px solid ${active ? p.accent : "rgba(255,255,255,0.12)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, opacity: 0.3 + 0.7 * t, transform: `scale(${0.85 + 0.15 * t + (active ? 0.05 : 0)})`, filter: st > 0 ? `grayscale(${st})` : undefined }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: "#fff" }}>{d}</div>
              <Icon name="search" size={60} color={active ? p.accent : "rgba(255,255,255,0.7)"} stroke={2} />
            </div>
          );
        })}
        <svg style={{ position: "absolute", inset: -20, width: "calc(100% + 40px)", height: "calc(100% + 40px)", overflow: "visible" }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="2" y1="4" x2={2 + 96 * st} y2={4 + 92 * st} stroke={p.bad} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 12 }} />
          <line x1="98" y1="4" x2={98 - 96 * st} y2={4 + 92 * st} stroke={p.bad} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 12 }} />
        </svg>
      </div>
      {o.label ? (
        <div style={{ marginTop: 44, fontFamily: FONT, fontWeight: 900, fontSize: 70, color: "#fff", opacity: st, transform: `translateY(${(1 - st) * 20}px)`, letterSpacing: -1.5 }}>{o.label}</div>
      ) : null}
    </Center>
  );
};
