// indexnow.mjs — yangi sahifalarni qidiruv tizimlariga darhol bildiradi.
//
// Google IndexNow'ni tan olmaydi, lekin Bing va Yandex oladi. Kalit fayli
// docs/ ildizida turadi va egalik isboti bo'lib xizmat qiladi — o'chirmang.

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = new URL(SITE.url).hostname;

async function findKey() {
  const files = await readdir(join(ROOT, "docs"));
  const f = files.find((x) => /^[0-9a-f]{16,64}\.txt$/.test(x));
  if (!f) throw new Error("IndexNow kalit fayli docs/ ichida topilmadi");
  return f.replace(/\.txt$/, "");
}

// Sitemapdagi eng yangi manzillar — har safar hammasini yuborish shart emas.
async function recentUrls(limit) {
  const xml = await readFile(join(ROOT, "docs/sitemap.xml"), "utf8");
  const rows = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
    .map((m) => ({ url: m[1], lastmod: m[2] }))
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return rows.slice(0, limit).map((r) => r.url);
}

async function main() {
  const key = await findKey();
  const urlList = await recentUrls(Number(process.env.INDEXNOW_LIMIT || 60));

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `${SITE.url}/${key}.txt`,
      urlList,
    }),
  });

  // 200 = qabul qilindi, 202 = qabul qilindi lekin kalit hali tekshirilmoqda.
  const ok = res.status === 200 || res.status === 202;
  console.log(`IndexNow: ${res.status} — ${urlList.length} ta manzil${ok ? "" : " (yuborilmadi)"}`);
  if (!ok) console.log((await res.text()).slice(0, 200));
}

main().catch((e) => console.error(`IndexNow xatosi: ${e.message}`));
