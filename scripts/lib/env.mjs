// Общие настройки скриптов.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

/** Свой Chrome для рендера, если задан REMOTION_BROWSER_EXECUTABLE (в облаке без доступа к remotion.media) */
export const browserOptions = () => {
  const exe = process.env.REMOTION_BROWSER_EXECUTABLE;
  return exe ? { browserExecutable: exe } : {};
};

/** ffmpeg, который поставляется вместе с Remotion — ставить отдельно ничего не нужно */
export const ffmpegPath = (tool = "ffmpeg") => {
  const dir = path.join(process.cwd(), "node_modules", "@remotion");
  const pkg = fs.readdirSync(dir).find((d) => d.startsWith("compositor-"));
  if (!pkg) throw new Error("Не найден ffmpeg Remotion (node_modules/@remotion/compositor-*). Запустите npm i.");
  const bin = path.join(dir, pkg, process.platform === "win32" ? `${tool}.exe` : tool);
  return { bin, dir: path.join(dir, pkg) };
};

/** Запуск ffmpeg/ffprobe; возвращает stdout+stderr, при ошибке бросает исключение */
export const runFf = (args, tool = "ffmpeg") =>
  new Promise((resolve, reject) => {
    const { bin, dir } = ffmpegPath(tool);
    const env = { ...process.env };
    if (process.platform === "linux") env.LD_LIBRARY_PATH = [dir, env.LD_LIBRARY_PATH].filter(Boolean).join(":");
    if (process.platform === "darwin") env.DYLD_LIBRARY_PATH = [dir, env.DYLD_LIBRARY_PATH].filter(Boolean).join(":");
    const p = spawn(bin, args, { env, cwd: process.cwd() });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${tool} завершился с кодом ${code}\n${out.slice(-2000)}`))));
  });

/** Запуск команды с выводом в консоль (npx remotion …) */
export const run = (cmd, args) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"], shell: process.platform === "win32" });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
      process.stdout.write(d);
    });
    p.stderr.on("data", (d) => {
      out += d;
      process.stderr.write(d);
    });
    p.on("close", (code) => resolve({ code, out }));
  });

export const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
