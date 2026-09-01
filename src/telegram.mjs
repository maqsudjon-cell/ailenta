// telegram.mjs — shu yugurishda saytga chiqqan xabarlarni kanalga yuboradi.
//
// Kerakli sozlamalar (GitHub secrets):
//   TELEGRAM_BOT_TOKEN — @BotFather bergan token
//   TELEGRAM_CHAT_ID   — kanal manzili (@kanal_nomi) yoki raqamli id
//
// Kalit yo'q bo'lsa jimgina to'xtaydi — quvurning qolgan qismi ishlayveradi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const PAUSE = 1500; // Telegram kanalga soniyasiga bir nechta xabar yuborishni cheklaydi

// Kanalga faqat muhim xabarlar darhol chiqadi. Qolganlari saytda turadi va
// ertalabki dayjestga tushadi — aks holda kanal kuniga 30 ta post bilan to'ladi.
const MIN_IMPORTANCE = Number(process.env.TELEGRAM_MIN_IMPORTANCE || 4);

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Teg Telegramda hashtag bo'lib ketadi: bo'shliq va apostrof olib tashlanadi.
const hashtag = (t) =>
  "#" + String(t).replace(/[’'`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/_+$/, "");

function message(p) {
  const tags = (p.tags || []).map(hashtag).join(" ");
  const lines = [
    `<b>${esc(p.title)}</b>`,
    "",
    esc(p.summary),
    "",
    `<a href="${esc(p.source.url)}">${esc(p.source.name)}</a>` +
      (p.coverage > 1 ? ` · ${p.coverage} nashr yozdi` : ""),
    `<a href="${SITE.url}/x/${esc(p.slug)}/">Saytda o'qish</a>`,
  ];
  if (tags) lines.push("", tags);
  return lines.join("\n");
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${res.status}`);
  return j.result;
}

// Rasm bilan yuboriladi — kanalda faqat matn turgani zerikarli ko'rinadi.
//
// Rasm URL bilan emas, fayl bo'lib yuboriladi: bu qadam saytga chiqishdan
// oldin ishlaydi, ya'ni havola hali mavjud emas va Telegram uni yuklab
// ololmaydi ("failed to get HTTP URL content").
async function sendPhotoFile(text, filePath) {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.set("chat_id", CHAT);
  form.set("caption", text);
  form.set("parse_mode", "HTML");
  form.set("photo", new Blob([bytes], { type: "image/png" }), "cover.png");

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${res.status}`);
  return j.result;
}

async function send(text, photoPath) {
  if (photoPath) {
    try {
      return await sendPhotoFile(text, photoPath);
    } catch (e) {
      console.error(`    (rasm o'tmadi: ${e.message} — matn bilan yuborilmoqda)`);
    }
  }
  return api("sendMessage", {
    chat_id: CHAT,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!TOKEN || !CHAT) {
    console.log("Telegram: TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID yo'q — o'tkazib yuborildi.");
    return;
  }

  let run;
  try {
    run = JSON.parse(await readFile(join(ROOT, "data/last-run.json"), "utf8"));
  } catch {
    console.log("Telegram: last-run.json yo'q — yuboradigan yangi xabar yo'q.");
    return;
  }

  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));

  // Bir marta yuborilgan xabar ikkinchi marta ketmasin.
  let sent = [];
  try {
    sent = JSON.parse(await readFile(join(ROOT, "data/telegram-sent.json"), "utf8"));
  } catch {}
  const sentSet = new Set(sent);

  const queue = (run.slugs || [])
    .filter((s) => !sentSet.has(s))
    .map((s) => bySlug.get(s))
    .filter(Boolean)
    .filter((p) => p.importance >= MIN_IMPORTANCE)
    // Muhimi oldin ketsin.
    .sort((a, b) => b.importance - a.importance);

  if (!queue.length) {
    console.log(`Telegram: muhimlik ${MIN_IMPORTANCE}+ bo'lgan yangi xabar yo'q.`);
    return;
  }

  let ok = 0;
  for (const p of queue) {
    try {
      await send(message(p), join(ROOT, `docs/og/${p.slug}.png`));
      sentSet.add(p.slug);
      ok++;
      console.log(`  → ${p.title}`);
    } catch (e) {
      console.error(`  ✗ yuborilmadi: ${p.title} — ${e.message}`);
    }
    await sleep(PAUSE);
  }

  await writeFile(
    join(ROOT, "data/telegram-sent.json"),
    JSON.stringify([...sentSet].slice(-3000), null, 2)
  );
  console.log(`Telegram: ${ok}/${queue.length} ta xabar yuborildi.`);
}

main();
