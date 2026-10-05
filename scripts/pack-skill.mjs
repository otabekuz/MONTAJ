// npm run pack-skill [-- --global]
// Пересобирает справочники скилла из источников, чтобы правила не расходились:
//   .claude/agents/reel-editor.md      → references/elements.md, references/montage.md
//   .claude/agents/reel-scriptwriter.md → references/script.md
//   src/Reel/schema.ts                  → references/schema.ts
//   docs/example-edit.json              → references/example-edit.json
// SKILL.md и references/pipeline.md пишутся руками прямо в скилле.
// Затем пакует dist/montaj-reels.skill (zip). С --global ещё копирует скилл в ~/.claude/skills/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const NAME = "montaj-reels";
const SKILL = path.join(".claude", "skills", NAME);
const REF = path.join(SKILL, "references");
const read = (p) => fs.readFileSync(p, "utf8");
const stripFront = (s) => s.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
const between = (s, tag) => {
  const m = new RegExp(`<!-- ${tag} -->([\\s\\S]*?)<!-- /${tag} -->`).exec(s);
  if (!m) throw new Error(`В источнике нет блока <!-- ${tag} -->`);
  return m[1].trim();
};
const banner = (src) => `> Сгенерировано из \`${src}\` командой \`npm run pack-skill\`. Правь источник, не этот файл.\n\n`;

fs.mkdirSync(REF, { recursive: true });
const editor = read(".claude/agents/reel-editor.md");
const writer = read(".claude/agents/reel-scriptwriter.md");

fs.writeFileSync(
  path.join(REF, "elements.md"),
  `# Анимации и элементы монтажа\n\n${banner(".claude/agents/reel-editor.md")}Каталог всего, что можно поставить в ролик. Точный формат полей — \`schema.ts\` рядом (копия \`src/Reel/schema.ts\`), заполненный план — \`example-edit.json\`. Как из этого собирать ролик — \`montage.md\`.\n\n${between(editor, "elements")}\n`,
);
fs.writeFileSync(
  path.join(REF, "montage.md"),
  `# Режиссура монтажа\n\n${banner(".claude/agents/reel-editor.md")}${between(editor, "montage")}\n`,
);
fs.writeFileSync(path.join(REF, "script.md"), `# Сценарий Reels: как писать\n\n${banner(".claude/agents/reel-scriptwriter.md")}${stripFront(writer)}\n`);
fs.writeFileSync(
  path.join(REF, "schema.ts"),
  `// Копия src/Reel/schema.ts — точный формат edit.json. Сгенерировано npm run pack-skill.\n${read("src/Reel/schema.ts")}`,
);
if (fs.existsSync("docs/example-edit.json")) fs.copyFileSync("docs/example-edit.json", path.join(REF, "example-edit.json"));
console.log(`Справочники → ${REF}`);

// --- zip (без сжатия зависимостей: deflate из zlib) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));

const files = walk(SKILL).sort();
const locals = [];
const centrals = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(path.join(NAME, path.relative(SKILL, f)).split(path.sep).join("/"));
  const data = fs.readFileSync(f);
  const comp = zlib.deflateRawSync(data);
  const crc = CRC(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6); // имена в UTF-8
  lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  locals.push(lh, name, comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  ch.writeUInt32LE(offset, 42);
  centrals.push(ch, name);
  offset += 30 + name.length + comp.length;
}
const central = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
fs.mkdirSync("dist", { recursive: true });
const archive = path.join("dist", `${NAME}.skill`);
fs.writeFileSync(archive, Buffer.concat([...locals, central, end]));
console.log(`Архив → ${archive} (${files.length} файлов)`);

if (process.argv.includes("--global")) {
  const target = path.join(os.homedir(), ".claude", "skills", NAME);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(SKILL, target, { recursive: true });
  console.log(`Глобальный скилл → ${target}`);
}
console.log("Готово");
