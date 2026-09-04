// watchdog.mjs — quvur jimgina to'xtab qolmasin.
//
// Eng yomon nosozlik — sezilmaydigani. Manba formatini o'zgartirsa,
// filtr juda qattiq bo'lib qolsa yoki model chegarasi tugasa, sayt
// eskirib boraveradi va buni hech kim bilmaydi.
//
// NEGA TELEGRAM EMAS: ogohlantirish kanalga ketsa obunachilar texnik
// xabar oladi. Buning o'rniga qadam xato bilan tugaydi — GitHub Actions
// repozitoriya egasiga o'zi xat yuboradi. Yangi maxfiy kalit ham kerak
// emas.
//
// Qadam quvurning OXIRIDA turadi: xato bo'lsa ham sayt allaqachon
// nashr qilingan bo'ladi.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALERT_HOURS = Number(process.env.WATCHDOG_HOURS || 6);

async function main() {
  let posts;
  try {
    posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  } catch (e) {
    console.error(`Nazorat: posts.json o'qilmadi — ${e.message}`);
    process.exit(1);
  }

  if (!posts.length) {
    console.error("Nazorat: posts.json bo'sh.");
    process.exit(1);
  }

  // `created` — biz yozgan vaqt. `published` manbaning sanasi va u eski
  // xabar uchun ham yangi bo'lishi mumkin, shuning uchun u yaramaydi.
  const newest = posts
    .map((p) => (p.created ? Date.parse(p.created) : 0))
    .reduce((a, b) => (b > a ? b : a), 0);

  if (!newest) {
    console.log("Nazorat: `created` maydoni yo'q — tekshiruv o'tkazib yuborildi.");
    return;
  }

  const hours = (Date.now() - newest) / 3600_000;
  const stamp = new Date(newest).toISOString().slice(0, 16).replace("T", " ");

  if (hours > ALERT_HOURS) {
    console.error(
      `Nazorat: ${hours.toFixed(1)} soatdan beri yangi xabar yo'q ` +
      `(oxirgisi ${stamp} UTC, chegara ${ALERT_HOURS} soat).`
    );
    console.error("Sabablari: manba formati o'zgargan, model chegarasi tugagan, yoki filtr juda qattiq.");
    process.exit(1);
  }

  console.log(`Nazorat: oxirgi xabar ${hours.toFixed(1)} soat oldin — sog'lom.`);
}

main();
