// images.mjs — muqova rasmlari, favicon va kanal logotipini chizadi.
//
// Barcha rasm kod bilan yaratiladi. Shriftlar repo ichida turadi, shuning uchun
// natija mahalliy kompyuterda ham, GitHub Actions ichida ham bir xil chiqadi.

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { coverSvg } from "./cover.mjs";
import { brandMark } from "../templates/marks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FONTS = [
  join(ROOT, "assets/fonts/Archivo.ttf"),
  join(ROOT, "assets/fonts/IBMPlexMono-Regular.ttf"),
];

export function toPng(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Archivo" },
  }).render().asPng();
}

const put = async (rel, buf) => {
  const full = join(ROOT, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buf);
};

export async function buildImages(posts) {
  // Eski muqovalar yig'ilib qolmasin — har safar faqat mavjud xabarlarniki.
  await rm(join(ROOT, "docs/og"), { recursive: true, force: true });

  let n = 0;
  for (const p of posts) {
    await put(`docs/og/${p.slug}.png`, toPng(coverSvg(p), 1200));
    n++;
  }

  // Bosh sahifa va boshqa sahifalar uchun umumiy muqova.
  await put("docs/og/default.png", toPng(coverSvg({
    slug: "ai-lenta",
    title: "Sun'iy intellekt yangiliklari, o'zbekcha",
    tags: ["agentlar"],
    source: { name: "ai.maqsudjon.com" },
  }), 1200));

  // Favicon: SVG zamonaviy brauzerlar uchun, PNG qolganlari uchun.
  const mark = brandMark({ size: 512 });
  await put("docs/favicon.svg", Buffer.from(mark, "utf8"));
  await put("docs/favicon-32.png", toPng(mark, 32));
  await put("docs/favicon-180.png", toPng(mark, 180));
  await put("docs/logo-512.png", toPng(mark, 512));

  return n + 1;
}

// Kanal logotipi — Telegram kvadrat rasm so'raydi.
export async function channelLogo(path) {
  await writeFile(path, toPng(brandMark({ size: 512 }), 512));
}

if (process.argv[1] && process.argv[1].endsWith("images.mjs")) {
  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const n = await buildImages(posts);
  console.log(`  ✓ ${n} ta muqova + favicon`);
}
