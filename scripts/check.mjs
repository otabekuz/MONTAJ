// npm run check -- <slug | ID композиции> <кадр|секунды s> [...]
// Рендерит несколько кадров для проверки за одну сборку проекта (быстрее, чем remotion still по одному).
//   npm run check -- kvartira-yunusobod 30 95 4.5s
//   npm run check -- ReelDemoSplit 60 200 400
//   npm run check -- ReelDemo 60 --palette=champagne     (сравнить палитры)
// Результат: out/<slug>-check-<кадр>.png (уменьшенные вдвое).
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
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
const composition = await selectComposition({ serveUrl, id: compositionId, inputProps, ...browserOptions() });
console.log(`${compositionId}: ${(composition.durationInFrames / composition.fps).toFixed(1)} с, ${composition.durationInFrames} кадров`);

fs.mkdirSync("out", { recursive: true });
for (const arg of frameArgs) {
  const frame = Math.min(
    composition.durationInFrames - 1,
    arg.endsWith("s") ? Math.round(parseFloat(arg) * composition.fps) : parseInt(arg, 10),
  );
  const output = path.join("out", `${target}-check-${palette ? `${palette}-` : ""}${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output, inputProps, scale: 0.5, ...browserOptions() });
  console.log(`  ${output}`);
}
console.log("Готово");
