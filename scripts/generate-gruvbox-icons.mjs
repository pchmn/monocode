// Usage: node gen.mjs <gruvbox-material-icons clone dir> <material-icons.json> <out.json>
// Reuses the Material name tables; only icons with an SVG in the gruvbox repo are kept.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const [dir, tablePath, out] = process.argv.slice(2);
const table = JSON.parse(readFileSync(tablePath, "utf8"));
const read = (f) => (existsSync(`${dir}/icons/${f}.svg`) ? readFileSync(`${dir}/icons/${f}.svg`, "utf8") : "");
const svgs = {};
const keep = (map, file) => {
  const res = {};
  for (const [k, n] of Object.entries(map)) {
    svgs[n] ??= read(file(n));
    if (svgs[n]) res[k] = n;
    else delete svgs[n];
  }
  return res;
};
const plain = (n) => n;
const files = keep(table.files, plain);
const exts = keep(table.exts, plain);
const folders = keep(table.folders, (n) => `colorful-${n}`);
for (const [n, f] of [["file", "file"], ["folder", "colorful-folder-base"]]) {
  const s = read(f);
  if (s) svgs[n] = s;
}
writeFileSync(out, JSON.stringify({ files, exts, folders, svgs }));
console.log(Object.keys(files).length, Object.keys(exts).length, Object.keys(folders).length, Object.keys(svgs).length);
