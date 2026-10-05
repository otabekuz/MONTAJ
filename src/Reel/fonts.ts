import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/inter-tight/800.css";
import "@fontsource/inter-tight/900.css";
import "@fontsource/playfair-display/500-italic.css";
import "@fontsource/playfair-display/700-italic.css";
import { continueRender, delayRender } from "remotion";

// Шрифты лежат в node_modules (латиница, расширенная латиница для o'/g', кириллица) —
// интернет при рендере не нужен. Ждём загрузки, иначе первые кадры уйдут с запасным шрифтом.
const SAMPLE = "Aa Oʻoʻ Gʻgʻ Ёё Яя Ўў Ққ Ғғ Ҳҳ 0123456789$";
const faces = [
  "400 40px 'Inter Tight'",
  "600 40px 'Inter Tight'",
  "800 40px 'Inter Tight'",
  "900 40px 'Inter Tight'",
  "italic 500 40px 'Playfair Display'",
  "italic 700 40px 'Playfair Display'",
];

if (typeof document !== "undefined") {
  const handle = delayRender("Загрузка шрифтов");
  Promise.all(faces.map((f) => document.fonts.load(f, SAMPLE)))
    .catch(() => undefined)
    .then(() => continueRender(handle));
}
