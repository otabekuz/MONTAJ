import { useCurrentFrame } from "remotion";

// Иллюстрация элитной квартиры (не фото конкретного объекта): панорамное окно, вечерний город,
// дизайнерский свет, диван, отражения. variant 0..5 меняет время суток и цвета.
// Используется в ленте, чате с ботом, уведомлениях — когда настоящих фото нет.

const SKIES = [
  ["#1B2440", "#C77D5A", "#F2B880"], // закат
  ["#0B1630", "#2D4A7A", "#89A9D6"], // синий час
  ["#120F24", "#3B2A5C", "#B07ACB"], // сиреневые сумерки
  ["#0A1A22", "#1E4D5C", "#7FC1C9"], // бирюзовый вечер
  ["#1A1410", "#6B4A2E", "#E7B97A"], // тёплая ночь
  ["#0C0F1A", "#26304D", "#C9D6F2"], // лунная ночь
];

export const LuxuryArt: React.FC<{ variant?: number; style?: React.CSSProperties }> = ({ variant = 0, style }) => {
  const f = useCurrentFrame();
  const v = ((variant % SKIES.length) + SKIES.length) % SKIES.length;
  const [top, mid, low] = SKIES[v];
  const id = `lux${v}`;
  // окна небоскрёбов мерцают
  const tw = (i: number) => 0.45 + 0.55 * Math.abs(Math.sin(f / 23 + i * 1.7));
  const towers = [
    [20, 120, 34], [58, 90, 26], [86, 135, 40], [130, 70, 30], [164, 110, 36], [204, 60, 24],
    [232, 100, 38], [274, 80, 28], [306, 125, 34], [344, 95, 30], [378, 140, 22],
  ];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block", ...style }}>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.65" stopColor={mid} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={`${id}floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2622" />
          <stop offset="1" stopColor="#0d0c0b" />
        </linearGradient>
        <radialGradient id={`${id}lamp`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE7B8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFE7B8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* панорамное окно с городом */}
      <rect x="0" y="0" width="400" height="215" fill={`url(#${id}sky)`} />
      <circle cx={70 + v * 40} cy={70} r={18} fill={low} opacity={0.55} />
      {towers.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={215 - h} width={w} height={h} fill="#0b0d14" opacity={0.92} />
          {Array.from({ length: Math.floor(h / 14) }).map((_, r) => (
            <rect key={r} x={x + 5} y={215 - h + 6 + r * 14} width={w - 10} height={3} fill="#FFD9A0" opacity={tw(i * 7 + r) * 0.55} />
          ))}
        </g>
      ))}
      {/* рамы окна */}
      {[100, 200, 300].map((x) => (
        <rect key={x} x={x - 2} y={0} width={4} height={215} fill="#1a1714" />
      ))}
      <rect x="0" y="0" width="400" height="8" fill="#1a1714" />
      {/* пол с отражением окна */}
      <rect x="0" y="215" width="400" height="85" fill={`url(#${id}floor)`} />
      <rect x="0" y="215" width="400" height="40" fill={low} opacity={0.12} />
      {/* диван */}
      <rect x="150" y="226" width="190" height="34" rx="10" fill="#E9E1D6" />
      <rect x="150" y="212" width="190" height="22" rx="10" fill="#F4EEE6" />
      <rect x="140" y="220" width="22" height="40" rx="8" fill="#DDD3C5" />
      <rect x="328" y="220" width="22" height="40" rx="8" fill="#DDD3C5" />
      {/* журнальный столик и растение */}
      <ellipse cx="110" cy="262" rx="40" ry="8" fill="#B08D57" />
      <rect x="40" y="228" width="16" height="34" rx="4" fill="#3b3128" />
      <path d="M48 228 C 30 200, 38 185, 48 175 C 58 185, 66 200, 48 228" fill="#3E6B48" />
      {/* дизайнерская люстра */}
      <line x1="245" y1="0" x2="245" y2="70" stroke="#C9A86A" strokeWidth="1.5" />
      <circle cx="245" cy="88" r="46" fill={`url(#${id}lamp)`} opacity={0.65 + 0.15 * Math.sin(f / 15)} />
      <ellipse cx="245" cy="76" rx="22" ry="9" fill="#E8C98A" />
    </svg>
  );
};

/** Рамка телефона: корпус, «островок», скругления */
export const PhoneFrame: React.FC<{ w: number; h: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ w, h, children, style }) => (
  <div
    style={{
      position: "relative",
      width: w,
      height: h,
      borderRadius: w * 0.13,
      background: "#050505",
      padding: w * 0.028,
      boxShadow: "0 60px 120px rgba(0,0,0,0.65), inset 0 0 0 2px rgba(255,255,255,0.12)",
      ...style,
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: w * 0.105, overflow: "hidden", background: "#0E1621" }}>
      {children}
      <div style={{ position: "absolute", top: w * 0.03, left: "50%", transform: "translateX(-50%)", width: w * 0.3, height: w * 0.075, borderRadius: 99, background: "#000" }} />
    </div>
  </div>
);
