// npm run finalize -- out/<slug>.mp4
// Громкость под Instagram: −14 LUFS, пик не выше −1,5 dBTP (двухпроходный loudnorm). Видео не перекодируется.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { runFf } from "./lib/env.mjs";

export const finalize = async (file) => {
  const pass1 = await runFf(["-hide_banner", "-i", file, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-c:a", "pcm_s16le", "-f", "null", "-"]);
  const json = pass1.slice(pass1.lastIndexOf("{"), pass1.lastIndexOf("}") + 1);
  const m = JSON.parse(json);
  const tmp = file.replace(/\.mp4$/, ".loud.tmp.mp4");
  // линейный режим (без «дыхания» громкости) — только если после усиления пик останется ниже −2 dBTP;
  // иначе динамический режим, он сам удерживает пики
  const linear = Number(m.input_tp) + (-14 - Number(m.input_i)) <= -2.2;
  // TP с запасом: кодирование в AAC добавляет ~0,4 дБ к пикам
  const filter = `loudnorm=I=-14:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=${linear}`;
  try {
    await runFf(["-y", "-hide_banner", "-i", file, "-c:v", "copy", "-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp]);
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return { before: Number(m.input_i) };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("Использование: npm run finalize -- out/<slug>.mp4");
    process.exit(1);
  }
  const { before } = await finalize(file);
  console.log(`Громкость: ${before} LUFS → −14 LUFS`);
  console.log("Готово");
}
