// instagram.mjs — muhim xabarlarni Instagram tasmasiga joylaydi.
//
// Kerakli sozlamalar (GitHub secrets):
//   IG_USER_ID       — Instagram professional akkauntning raqamli id'si
//   IG_ACCESS_TOKEN  — uzoq muddatli token (60 kun, keyin yangilanadi)
//
// Kalit yo'q bo'lsa jimgina to'xtaydi.
//
// MUHIM FARQ: Telegramga rasmni fayl bo'lib yuborsak bo'ladi, Instagram esa
// faqat HAVOLA qabul qiladi va rasmni o'zi yuklab oladi. Shuning uchun bu
// qadam sayt chiqqandan KEYIN ishlashi va rasm ochilishini kutishi kerak.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;
const API = "https://graph.instagram.com/v21.0";
const MIN_IMPORTANCE = Number(process.env.IG_MIN_IMPORTANCE || 4);
const PAUSE = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Instagram havolalarni bosib bo'lmaydigan qiladi, shuning uchun manzilni
// matnda yozamiz. Xeshteglar esa u yerda haqiqatan topilishga yordam beradi.
const hashtag = (t) =>
  "#" + String(t).toLowerCase().replace(/[’'`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

function caption(p) {
  const tags = [...new Set([...(p.tags || []).map(hashtag), "#suniyintellekt", "#AI", "#texnologiya", "#ozbekiston"])];
  return [
    p.title,
    "",
    p.summary,
    "",
    `Manba: ${p.source.name}`,
    `To'liq xabar: ${SITE.domain}`,
    "",
    tags.join(" "),
  ].join("\n").slice(0, 2200);
}

async function api(path, body) {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, access_token: TOKEN }),
  });
  const j = await res.json().catch(() => ({}));
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j;
}

// Rasm saytda ochilguncha kutamiz — Pages yoyilishi bir-ikki daqiqa oladi.
async function waitForImage(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return true;
    } catch {}
    await sleep(15000);
  }
  return false;
}

async function main() {
  if (!USER || !TOKEN) {
    console.log("Instagram: IG_USER_ID yoki IG_ACCESS_TOKEN yo'q — o'tkazib yuborildi.");
    return;
  }

  let run;
  try {
    run = JSON.parse(await readFile(join(ROOT, "data/last-run.json"), "utf8"));
  } catch {
    console.log("Instagram: yangi xabar yo'q.");
    return;
  }

  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  let sent = [];
  try {
    sent = JSON.parse(await readFile(join(ROOT, "data/instagram-sent.json"), "utf8"));
  } catch {}
  const sentSet = new Set(sent);

  const queue = (run.slugs || [])
    .filter((s) => !sentSet.has(s))
    .map((s) => bySlug.get(s))
    .filter(Boolean)
    .filter((p) => p.importance >= MIN_IMPORTANCE)
    .sort((a, b) => b.importance - a.importance);

  if (!queue.length) {
    console.log(`Instagram: muhimlik ${MIN_IMPORTANCE}+ bo'lgan yangi xabar yo'q.`);
    return;
  }

  let ok = 0;
  for (const p of queue) {
    const imageUrl = `${SITE.url}/ig/${p.slug}.jpg`;
    try {
      if (!(await waitForImage(imageUrl))) {
        console.error(`  ✗ rasm saytda ochilmadi: ${imageUrl}`);
        continue;
      }
      const container = await api(`${USER}/media`, {
        image_url: imageUrl,
        caption: caption(p),
      });
      // Instagram konteynerni tayyorlashga bir oz vaqt oladi.
      await sleep(PAUSE);
      await api(`${USER}/media_publish`, { creation_id: container.id });
      sentSet.add(p.slug);
      ok++;
      console.log(`  → ${p.title}`);
    } catch (e) {
      console.error(`  ✗ joylanmadi: ${p.title} — ${e.message}`);
    }
    await sleep(PAUSE);
  }

  await writeFile(
    join(ROOT, "data/instagram-sent.json"),
    JSON.stringify([...sentSet].slice(-2000), null, 2)
  );
  console.log(`Instagram: ${ok}/${queue.length} ta xabar joylandi.`);
}

main();
