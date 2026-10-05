// npm run check -- <slug | ID композиции> <кадр|секунды s> [...]
// Рендерит несколько кадров для проверки за одну сборку проекта (быстрее, чем remotion still по одному).
//   npm run check -- kvartira-yunusobod 30 95 4.5s
//   npm run check -- ReelDemoSplit 60 200 400
//   npm run check -- kvartira-yunusobod @10.2 @31.5       (@ — секунды ИСХОДНИКА, как в edit.json)
//   npm run check -- ReelDemo 60 --palette=champagne     (сравнить палитры)
// Результат: out/<slug>-check-<кадр>.png (уменьшенные вдвое).
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { browserOptions } from "./lib/env.mjs";

const args = process.argv.slice(2);
const palette = args.find((a) => a.startsWith("--palette="))?.split("=")[1];
const [target, ...frameArgs] = args.filter((a) => !a.startsWith("--"));
if (!target || frameArgs.length === 0) {
  console.error("Использование: npm run check -- <slug | ID композиции> <кадр|секунды s> ...");
  process.exit(1);
}

const editPath = path.join("reels", target, "edit.json");
const isSlug = fs.existsSync(editPath);
const compositionId = isSlug ? "Reel" : target;
const inputProps = isSlug ? JSON.parse(fs.readFileSync(editPath, "utf8")) : {};
if (palette) inputProps.palette = palette;

console.log("Сборка проекта…");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
// один браузер на все кадры: на Windows повторный запуск браузера на каждый кадр падает («Failed to launch the browser process»)
const puppeteerInstance = await openBrowser("chrome", browserOptions());
const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, puppeteerInstance });
console.log(`${compositionId}: ${(composition.durationInFrames / composition.fps).toFixed(1)} с, ${composition.durationInFrames} кадров`);

fs.mkdirSync("out", { recursive: true });
// секунда исходника → кадр результата (та же логика, что в src/Reel/cuts.ts)
const sourceToFrame = (t) => {
  const { segments = [], speed = 1 } = composition.props;
  let acc = 0;
  for (const s of segments) {
    if (t < s.from) break;
    if (t <= s.to) return Math.round((acc + (t - s.from) / speed) * composition.fps);
    acc += (s.to - s.from) / speed;
  }
  return Math.round(acc * composition.fps);
};
for (const arg of frameArgs) {
  const frame = Math.min(
    composition.durationInFrames - 1,
    arg.startsWith("@")
      ? sourceToFrame(parseFloat(arg.slice(1)))
      : arg.endsWith("s")
        ? Math.round(parseFloat(arg) * composition.fps)
        : parseInt(arg, 10),
  );
  const output = path.join("out", `${target}-check-${palette ? `${palette}-` : ""}${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output, inputProps, scale: 0.5, puppeteerInstance });
  console.log(`  ${output}`);
}
await puppeteerInstance.close({ silent: true });
console.log("Готово");
