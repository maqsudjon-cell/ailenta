// digest.mjs — kunlik dayjest: o'tgan sutkaning eng muhim xabarlari bitta postda.
//
// Har kuni ertalab ishlaydi. Kanalga darhol chiqmagan xabarlar ham shu yerda
// ko'rinadi, ya'ni hech narsa e'tibordan chetda qolmaydi.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const COUNT = Number(process.env.DIGEST_COUNT || 7);

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const tashkent = (iso) => {
  const d = new Date(Date.parse(iso) + 5 * 3600_000);
  return {
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
  };
};

async function main() {
  if (!TOKEN || !CHAT) {
    console.log("Dayjest: Telegram kaliti yo'q — o'tkazib yuborildi.");
    return;
  }

  const posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8"));
  const since = Date.now() - 24 * 3600_000;

  const day = posts
    .filter((p) => Date.parse(p.published) >= since)
    .sort((a, b) => b.importance - a.importance || (b.coverage || 0) - (a.coverage || 0));

  if (day.length < 3) {
    console.log(`Dayjest: oxirgi sutkada atigi ${day.length} ta xabar — yuborilmadi.`);
    return;
  }

  const picked = day.slice(0, COUNT);
  const t = tashkent(new Date().toISOString());

  const lines = [
    `<b>AI LENTA — ${t.day}-${t.month}</b>`,
    "",
    ...picked.map((p) => `● <a href="${SITE.url}/x/${esc(p.slug)}/">${esc(p.title)}</a>`),
    "",
    `<a href="${SITE.url}/kun/${t.ymd}/">Kunning barcha xabari (${day.length} ta)</a>`,
  ];

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text: lines.join("\n"),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `HTTP ${res.status}`);

  console.log(`Dayjest yuborildi: ${picked.length} ta sarlavha (sutkada ${day.length} ta xabar).`);
}

main().catch((e) => {
  console.error(`Dayjest xatosi: ${e.message}`);
  process.exit(1);
});
