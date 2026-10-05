import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { OverlayOf } from "../schema";
import { FONT } from "../theme";
import { EASE_IN_OUT, EASE_OUT, enter, exit, pop } from "../motion";
import { Center, type FxProps } from "./common";
import { Icon } from "./icons";
import { LuxuryArt, PhoneFrame } from "./LuxuryArt";

// Телефон с Telegram — герой роликов про ботов и каналы. Режимы:
//   chat    — переписка с ботом: сообщение пользователя печатается синхронно с голосом и отправляется,
//             бот «печатает…», отвечает текстом, чипами-параметрами, карточками квартир и статусом;
//   channel — лента канала с постами, затем поиск: запрос печатается, неподходящие посты гаснут;
//   start   — экран бота с кнопкой «Запустить» и нажатием.
// Всё — макет интерфейса (не скриншот): квартиры — иллюстрации, без выдуманных цен и адресов.

const TG = { header: "#17212B", bg: "#0E1621", user: "#2B5278", bot: "#182533", blue: "#2AABEE", link: "#6AB3F3", muted: "#7F91A4" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Msg = NonNullable<OverlayOf<"tg">["messages"]>[number];

const textLines = (t: string, perLine: number) => Math.max(1, Math.ceil(t.length / perLine));

export const Telegram: React.FC<FxProps<OverlayOf<"tg">>> = ({ o, total, zone, p, local }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = Math.min(zone.h - 30, 1060);
  const W = H / 2.05;
  const S = W / 420; // масштаб интерфейса (макет под ширину экрана 420 — крупно, читается на телефоне)
  const inT = enter(f, 0, 14);
  const out = exit(f, total, 8);
  const sway = Math.sin(f / 50) * 2.2;

  return (
    <Center style={{ opacity: Math.min(inT, out) }}>
      <div style={{ perspective: 1800 }}>
        <div style={{ transform: `translateY(${(1 - inT) * 220}px) rotateX(${(1 - inT) * 25}deg) rotateY(${sway}deg) scale(${0.9 + 0.1 * inT})` }}>
          <PhoneFrame w={W} h={H}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${S})`, transformOrigin: "0 0", width: 420, height: H / S - 0 }}>
              {o.mode === "chat" ? <Chat o={o} f={f} fps={fps} local={local} h={(H - W * 0.056) / S} accent={p.accent} /> : null}
              {o.mode === "channel" ? <Channel o={o} f={f} fps={fps} local={local} h={(H - W * 0.056) / S} /> : null}
              {o.mode === "start" ? <Start o={o} f={f} fps={fps} local={local} accent={p.accent} /> : null}
            </div>
          </PhoneFrame>
        </div>
      </div>
    </Center>
  );
};

const Header: React.FC<{ title: string; sub: string; icon: string }> = ({ title, sub, icon }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 118, paddingTop: 46, background: TG.header, display: "flex", alignItems: "center", gap: 16, paddingLeft: 22, zIndex: 3 }}>
    <div style={{ fontSize: 34, color: TG.link, fontFamily: FONT }}>‹</div>
    <div style={{ width: 58, height: 58, borderRadius: 29, background: `linear-gradient(135deg, ${TG.blue}, #1C6FB0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={30} color="#fff" stroke={2.2} />
    </div>
    <div style={{ fontFamily: FONT }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>{title}</div>
      <div style={{ fontSize: 17, color: TG.muted, whiteSpace: "nowrap" }}>{sub}</div>
    </div>
  </div>
);

const Chat: React.FC<{ o: OverlayOf<"tg">; f: number; fps: number; local: (s: number) => number; h: number; accent: string }> = ({ o, f, fps, local, h, accent }) => {
  const msgs = o.messages ?? [];
  // когда сообщение появляется в ленте (для пользователя — после набора)
  const shownAt = (m: Msg) => local(m.at + (m.from === "user" ? (m.typeDur ?? 0) : 0));
  const heights = msgs.map((m) => {
    let hh = 22;
    if (m.text) hh += textLines(m.text, 19) * 38 + 30;
    if (m.chips?.length) hh += Math.ceil(m.chips.length / 2) * 52 + 14;
    if (m.cards) hh += 186;
    if (m.note) hh += 54;
    return hh;
  });
  const top = 130;
  const bottomLimit = h - 96;
  // прокрутка: последнее показанное сообщение — над полем ввода
  let visibleBottom = top;
  msgs.forEach((m, i) => {
    const t = interpolate(f, [shownAt(m) - 2, shownAt(m) + 8], [0, 1], { ...clamp, easing: EASE_OUT });
    visibleBottom += heights[i] * t;
  });
  const scroll = Math.max(0, visibleBottom - bottomLimit);

  // поле ввода: набирается сообщение пользователя
  const typing = msgs.find((m) => m.from === "user" && m.typeDur && f >= local(m.at) && f < local(m.at + (m.typeDur ?? 0)));
  const typed = typing?.text
    ? typing.text.slice(0, Math.floor(interpolate(f, [local(typing.at), local(typing.at + (typing.typeDur ?? 0)) - 3], [0, typing.text.length], clamp)))
    : "";

  let y = top - scroll;
  return (
    <div style={{ position: "absolute", inset: 0, background: TG.bg, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "radial-gradient(circle at 20% 20%, #fff 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, #fff 1.5px, transparent 2px)", backgroundSize: "60px 60px, 90px 90px" }} />
      {msgs.map((m, i) => {
        const at = shownAt(m);
        const s = interpolate(f, [at - 1, at + 7], [0, 1], { ...clamp, easing: EASE_OUT });
        const my = y;
        y += heights[i] * s;
        const isUser = m.from === "user";
        const dots = !isUser && f >= at - 0.6 * fps && f < at;
        return (
          <div key={i}>
            {dots ? (
              <div style={{ position: "absolute", left: 18, top: my, padding: "18px 24px", borderRadius: 22, background: TG.bot, display: "flex", gap: 8 }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{ width: 11, height: 11, borderRadius: 6, background: TG.muted, opacity: 0.4 + 0.6 * Math.abs(Math.sin((f + d * 5) / 6)) }} />
                ))}
              </div>
            ) : null}
            {s > 0 ? (
              <div
                style={{
                  position: "absolute",
                  top: my,
                  [isUser ? "right" : "left"]: 18,
                  maxWidth: 340,
                  opacity: s,
                  transform: `translateY(${(1 - s) * 30}px) scale(${0.92 + 0.08 * s})`,
                  transformOrigin: isUser ? "100% 100%" : "0 100%",
                  background: isUser ? TG.user : TG.bot,
                  borderRadius: isUser ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                  padding: "14px 18px",
                  color: "#fff",
                  fontSize: 25,
                  lineHeight: 1.45,
                }}
              >
                {m.text ? <div>{m.text}</div> : null}
                {m.chips?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: m.text ? 10 : 0, maxWidth: 310 }}>
                    {m.chips.map((c, k) => {
                      const cs = pop(f, fps, c.at !== undefined ? local(c.at) : at + 6 + k * 5, 260);
                      return (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(42,171,238,0.16)", border: `1.5px solid ${TG.blue}`, transform: `scale(${cs})`, opacity: Math.min(1, cs * 1.5), fontSize: 20, fontWeight: 600 }}>
                          <Icon name={c.icon} size={22} color={TG.link} stroke={2.2} />
                          {c.text}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {m.cards ? (
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    {Array.from({ length: m.cards }).map((_, k) => {
                      const cs = pop(f, fps, at + 4 + k * 5, 200);
                      return (
                        <div key={k} style={{ width: 96, borderRadius: 12, overflow: "hidden", background: "#0E1621", transform: `translateY(${(1 - cs) * 40}px)`, opacity: Math.min(1, cs * 1.4), boxShadow: `0 0 0 1.5px ${accent}` }}>
                          <div style={{ height: 112 }}>
                            <LuxuryArt variant={k + 1} />
                          </div>
                          <div style={{ padding: "6px 8px", fontSize: 15, color: TG.link, display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon name="right" size={18} color={TG.link} stroke={2.4} />
                            подходит
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {m.note ? (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: "#8FE3A1", opacity: interpolate(f, [at + 18, at + 26], [0, 1], clamp) }}>
                    <Icon name="right" size={24} color="#8FE3A1" stroke={2.4} />
                    {m.note}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      <Header title={o.title} sub={o.sub ?? "бот"} icon="ai" />
      {/* поле ввода */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: TG.header, display: "flex", alignItems: "center", gap: 14, padding: "0 18px" }}>
        <div style={{ flex: 1, minHeight: 58, borderRadius: 29, background: "#242F3D", display: "flex", alignItems: "center", padding: "6px 22px", fontSize: 22, color: typed ? "#fff" : TG.muted, lineHeight: 1.3, overflow: "hidden" }}>
          {typed ? (
            <span>
              {typed.length > 60 ? `…${typed.slice(-60)}` : typed}
              <span style={{ opacity: Math.floor(f / 6) % 2 ? 1 : 0 }}>|</span>
            </span>
          ) : (
            "Сообщение"
          )}
        </div>
        <div style={{ width: 58, height: 58, borderRadius: 29, background: typed ? TG.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${typed ? 1 : 0.8})` }}>
          <Icon name="send" size={28} color={typed ? "#fff" : TG.muted} stroke={2.2} />
        </div>
      </div>
    </div>
  );
};

const Channel: React.FC<{ o: OverlayOf<"tg">; f: number; fps: number; local: (s: number) => number; h: number }> = ({ o, f, fps, local, h }) => {
  const posts = o.posts ?? [];
  const searchAt = o.search ? local(o.search.at) : Infinity;
  const searching = f >= searchAt;
  const typed = o.search && searching ? o.search.text.slice(0, Math.floor(interpolate(f, [searchAt + 4, searchAt + 4 + o.search.text.length * 1.2], [0, o.search.text.length], clamp))) : "";
  const filterT = o.search ? interpolate(f, [searchAt + 6 + o.search.text.length * 1.2, searchAt + 18 + o.search.text.length * 1.2], [0, 1], { ...clamp, easing: EASE_IN_OUT }) : 0;
  const scroll = searching ? 0 : interpolate(f, [0, Math.min(searchAt, 9999)], [0, Math.max(0, posts.length * 330 - (h - 180))], { ...clamp, easing: EASE_IN_OUT }) * (searchAt === Infinity ? 0.6 : 1);
  let y = 150 - scroll * (1 - filterT);
  return (
    <div style={{ position: "absolute", inset: 0, background: TG.bg, fontFamily: FONT }}>
      {posts.map((post, i) => {
        const match = !o.search || o.search.match.includes(i);
        const k = match ? 1 : 1 - filterT;
        const ph = 330 * k;
        const my = y;
        y += ph;
        if (k <= 0.02) return null;
        const pin = pop(f, fps, 4 + i * 4, 200);
        return (
          <div key={i} style={{ position: "absolute", left: 16, right: 16, top: my, height: 318 * k, overflow: "hidden", opacity: k * Math.min(1, pin * 1.3), borderRadius: 20, background: TG.bot, border: match && filterT > 0 ? `2px solid ${TG.blue}` : "2px solid transparent", boxShadow: match && filterT > 0 ? `0 0 30px rgba(42,171,238,${0.4 * filterT})` : "none" }}>
            <div style={{ height: 190 }}>
              <LuxuryArt variant={i} />
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: TG.link, fontWeight: 600 }}>
                <Icon name="person" size={18} color={TG.link} stroke={2.2} />
                {post.author}
              </div>
              <div style={{ fontSize: 24, color: "#fff", fontWeight: 700, marginTop: 4 }}>{post.title}</div>
              <div style={{ fontSize: 19, color: TG.muted, marginTop: 2 }}>{post.tag}</div>
            </div>
          </div>
        );
      })}
      <Header title={o.title} sub={o.sub ?? "канал"} icon="apartment" />
      {o.search ? (
        <div style={{ position: "absolute", top: 136, left: 16, right: 16, height: searching ? 62 : 0, overflow: "hidden", borderRadius: 31, background: "#242F3D", display: "flex", alignItems: "center", gap: 12, padding: searching ? "0 20px" : 0, fontSize: 23, color: "#fff", zIndex: 4, transform: `scaleY(${interpolate(f, [searchAt, searchAt + 6], [0, 1], clamp)})` }}>
          <Icon name="search" size={26} color={TG.link} stroke={2.4} />
          {typed}
          <span style={{ opacity: Math.floor(f / 6) % 2 ? 1 : 0 }}>|</span>
        </div>
      ) : null}
    </div>
  );
};

const Start: React.FC<{ o: OverlayOf<"tg">; f: number; fps: number; local: (s: number) => number; accent: string }> = ({ o, f, fps, local, accent }) => {
  const tapAt = o.tapAt !== undefined ? local(o.tapAt) : 30;
  const ripple = interpolate(f, [tapAt, tapAt + 18], [0, 1], clamp);
  const press = f >= tapAt && f < tapAt + 5 ? 0.94 : 1;
  const logo = pop(f, fps, 4, 180);
  const lines = o.lines ?? [];
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #17212B 0%, ${TG.bg} 60%)`, fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 170 }}>
      <div style={{ width: 160, height: 160, borderRadius: 80, background: `linear-gradient(135deg, ${TG.blue}, #1C6FB0)`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${logo})`, boxShadow: `0 0 80px rgba(42,171,238,0.5)` }}>
        <Icon name="ai" size={84} color="#fff" stroke={1.8} />
      </div>
      <div style={{ marginTop: 28, fontSize: 34, fontWeight: 800, color: "#fff" }}>{o.title}</div>
      <div style={{ marginTop: 6, fontSize: 19, color: TG.muted, textAlign: "center", padding: "0 30px" }}>{o.sub ?? "бот"}</div>
      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12, width: 350 }}>
        {lines.map((l, i) => {
          const t = enter(f, 10 + i * 6, 10);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: "#fff", opacity: t, transform: `translateX(${(1 - t) * 30}px)` }}>
              <Icon name="right" size={26} color={accent} stroke={2.4} />
              {l}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 70, left: 30, right: 30 }}>
        <div style={{ position: "relative", height: 86, borderRadius: 18, background: TG.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: 2, transform: `scale(${press * (1 + 0.025 * Math.sin(f / 5))})`, overflow: "hidden" }}>
          {o.button ?? "ЗАПУСТИТЬ"}
          {ripple > 0 && ripple < 1 ? <div style={{ position: "absolute", width: 600, height: 600, borderRadius: 300, background: "rgba(255,255,255,0.35)", transform: `scale(${ripple})`, opacity: 1 - ripple }} /> : null}
        </div>
        {/* палец */}
        <div style={{ position: "absolute", left: "58%", top: 40, opacity: interpolate(f, [tapAt - 14, tapAt - 6, tapAt + 14, tapAt + 22], [0, 1, 1, 0], clamp), transform: `translateY(${interpolate(f, [tapAt - 14, tapAt], [80, 0], { ...clamp, easing: EASE_OUT })}px) scale(${press})` }}>
          <div style={{ width: 70, height: 70, borderRadius: 35, background: "rgba(255,255,255,0.85)", boxShadow: "0 0 0 10px rgba(255,255,255,0.25)" }} />
        </div>
      </div>
    </div>
  );
};
