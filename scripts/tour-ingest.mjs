// npm run tour-ingest -- <slug> "<клип или папка>" ["<клип>" …]
// Клипы обзора объекта → public/reels/<slug>/clip-01.mp4, clip-02.mp4 …:
//   1080×1920 (вертикальный кадр; горизонтальный обрезается по центру — предупреждение),
//   частота кадров сохраняется до 60 (60 к/с нужны для плавных ускорений и замедлений),
//   HDR с iPhone (HLG / Dolby Vision) переводится в обычный цвет — иначе картинка блёклая и серая,
//   ключевой кадр каждые 0,5 с (быстрый доступ к любому кадру при ускорениях), звук убирается.
// Порядок клипов — как в команде (папка — по имени файла). Список → reels/<slug>/clips.json.
import fs from "node:fs";
import path from "node:path";
import { runFf } from "./lib/env.mjs";

const [slug, ...inputs] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug) || inputs.length === 0) {
  console.error('Использование: npm run tour-ingest -- <slug> "<клип или папка>" ["<клип>" …]');
  process.exit(1);
}
const VIDEO = /\.(mp4|mov|m4v|mkv|webm)$/i;
const files = inputs.flatMap((p) => {
  if (!fs.existsSync(p)) {
    console.error(`Не найдено: ${p}`);
    process.exit(1);
  }
  if (fs.statSync(p).isDirectory()) {
    return fs
      .readdirSync(p)
      .filter((f) => VIDEO.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => path.join(p, f));
  }
  return [p];
});

const probe = async (file) => {
  const out = await runFf(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate,color_transfer,color_primaries:stream_side_data=rotation:format=duration", "-of", "json", file], "ffprobe");
  const j = JSON.parse(out.slice(out.indexOf("{")));
  const s = j.streams?.[0] ?? {};
  const [n, d] = String(s.avg_frame_rate ?? "30/1").split("/").map(Number);
  const rot = Math.abs(Number(s.side_data_list?.find((x) => x.rotation !== undefined)?.rotation ?? 0));
  const portrait = rot === 90 || rot === 270 ? s.width > s.height : s.height >= s.width;
  return {
    fps: d ? n / d : 30,
    duration: Number(j.format?.duration ?? 0),
    hdr: /arib-std-b67|smpte2084/.test(String(s.color_transfer)),
    portrait,
    size: `${s.width}×${s.height}`,
  };
};

const dir = path.join("public", "reels", slug);
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join("reels", slug), { recursive: true });

const list = [];
for (const [k, file] of files.entries()) {
  const name = `clip-${String(k + 1).padStart(2, "0")}.mp4`;
  const out = path.join(dir, name);
  const tmp = out.replace(/\.mp4$/, ".tmp.mp4");
  const info = await probe(file);
  const fps = Math.min(60, Math.round(info.fps)) || 30;
  const vf = [
    // HDR → SDR: в линейный свет, мягкое сжатие ярких мест (mobius), обратно в bt709
    ...(info.hdr ? ["zscale=t=linear:npl=203", "format=gbrpf32le", "zscale=p=bt709", "tonemap=tonemap=mobius:param=0.35:desat=0", "zscale=t=bt709:m=bt709:r=tv"] : []),
    "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos",
    "crop=1080:1920",
    "format=yuv420p",
  ].join(",");
  process.stdout.write(`${path.basename(file)} → ${name}  (${info.size}, ${info.fps.toFixed(0)} к/с, ${info.duration.toFixed(1)} с${info.hdr ? ", HDR" : ""}) … `);
  try {
    await runFf([
      "-y", "-i", file, "-an",
      "-vf", vf,
      "-r", String(fps),
      "-c:v", "libx264", "-preset", "medium", "-crf", "17",
      "-g", String(Math.max(1, Math.round(fps / 2))), "-keyint_min", String(Math.max(1, Math.round(fps / 2))), "-sc_threshold", "0",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-movflags", "+faststart",
      tmp,
    ]);
    fs.renameSync(tmp, out);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    console.error(`\n${e.message}`);
    process.exit(1);
  }
  console.log("ok");
  if (!info.portrait) console.log(`  ⚠ горизонтальное видео — кадр обрезан по центру до вертикали, потеряно ~70% ширины. Снимайте вертикально.`);
  if (fps < 50) console.log(`  ⚠ ${fps} к/с — замедлять этот клип нельзя (рывки), ускорять можно. Для деталей снимайте 60 к/с.`);
  list.push({ file: `reels/${slug}/${name}`, source: path.basename(file), duration: +info.duration.toFixed(2), fps, hdr: info.hdr, portrait: info.portrait });
}
fs.writeFileSync(path.join("reels", slug, "clips.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`→ reels/${slug}/clips.json (${list.length} клипов)`);
console.log("Готово");
