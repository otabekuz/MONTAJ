// npm run new-reel -- <slug> <full|split|voice> <uz|ru> [палитра]
// Создаёт reels/<slug>/edit.json по шаблону. Палитра по умолчанию — из PROGRESS.md («Палитра: …») или sky.
import fs from "node:fs";
import path from "node:path";

const [slug, layout = "full", lang = "uz", paletteArg] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug) || !["full", "split", "voice"].includes(layout) || !["uz", "ru"].includes(lang)) {
  console.error("Использование: npm run new-reel -- <slug> <full|split|voice> <uz|ru> [sky|champagne|sage|blush]");
  process.exit(1);
}
const progress = fs.existsSync("PROGRESS.md") ? fs.readFileSync("PROGRESS.md", "utf8") : "";
const palette = paletteArg ?? /Палитра:\s*`?(\w+)`?/.exec(progress)?.[1] ?? "sky";

const dir = path.join("reels", slug);
const file = path.join(dir, "edit.json");
if (fs.existsSync(file)) {
  console.error(`${file} уже есть — не перезаписываю.`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join("public", "reels", slug), { recursive: true });
const voice = layout === "voice";
const edit = {
  layout,
  lang,
  palette,
  videoFile: `reels/${slug}.${voice ? "mp3" : "mp4"}`,
  captionsFile: `reels/${slug}.captions.json`,
  fallbackSeconds: 30,
  cutPauses: true,
  speed: 1,
  beats: [],
  cues: [],
  hook: "",
  hookSeconds: 2.8,
  highlightWords: [],
  autoFraming: !voice,
  zooms: [],
  transitions: [],
  overlays: [],
  sfx: true,
  musicFile: "",
  cta: "",
  ctaSeconds: 2.6,
};
fs.writeFileSync(file, JSON.stringify(edit, null, 2) + "\n");
console.log(`→ ${file}  (${layout}, ${lang}, палитра ${palette})`);
console.log("Готово");
