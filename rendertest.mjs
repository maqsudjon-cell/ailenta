import { coverSvg, thumbSvg } from "./src/cover.mjs";
import { brandMark } from "./templates/marks.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const posts = JSON.parse(readFileSync("/Users/macbook/Downloads/ailenta/data/posts.json", "utf8"));
mkdirSync("/tmp/covers", { recursive: true });

const fonts = [
  "/Users/macbook/Downloads/ailenta/assets/fonts/Archivo.ttf",
  "/Users/macbook/Downloads/ailenta/assets/fonts/IBMPlexMono-Regular.ttf",
];

const png = (svg, w) => new Resvg(svg, {
  fitTo: { mode: "width", value: w },
  font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Archivo" },
}).render().asPng();

// Turli mavzudagi to'rtta xabar
const pick = [];
for (const t of ["xavfsizlik", "sud", "chiplar", "biznes"]) {
  const p = posts.find((x) => (x.tags || []).some((y) => y.toLowerCase() === t));
  if (p) pick.push(p);
}
while (pick.length < 4) pick.push(posts[pick.length]);

pick.forEach((p, i) => {
  writeFileSync(`/tmp/covers/cover${i}.png`, png(coverSvg(p), 1200));
  console.log(`  ${i}: ${p.tags.join(", ").padEnd(24)} ${p.title.slice(0, 46)}`);
});
writeFileSync("/tmp/covers/mark.png", png(brandMark({ size: 512 }), 512));
console.log("  brend belgisi yozildi");
