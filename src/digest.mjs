// digest.mjs — kunlik dayjest: kunning eng muhim xabarlari bitta postda.
//
// Kanalga darhol chiqmagan xabarlar ham shu yerda ko'rinadi, ya'ni hech
// narsa e'tibordan chetda qolmaydi.
//
// SOATLIK QUVUR ichida ishlaydi va vaqtni O'ZI hal qiladi. Ilgari u alohida
// ish oqimida, GitHub jadvaliga bog'liq edi — GitHub esa kuniga 1-2 marta
// ishlaydi, ya'ni kunda bir marta chiqadigan post umuman chiqmasligi mumkin
// edi. Endi har soatda tekshiriladi: kech bo'ldimi va bugun yuborilganmi.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../templates/shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const COUNT = Number(process.env.DIGEST_COUNT || 7);
// Toshkent vaqti bilan shu soatdan keyin chiqadi.
const HOUR = Number(process.env.DIGEST_HOUR || 20);
const STATE = "data/digest-sent.json";

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
    hour: d.getUTCHours(),
    month: MONTHS[d.getUTCMonth()],
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
  };
};

async function main() {
  if (!TOKEN || !CHAT) {
    console.log("Dayjest: Telegram kaliti yo'q — o'tkazib yuborildi.");
    return;
  }

  const nowT = tashkent(new Date().toISOString());

  // Kech bo'lmaguncha kutamiz.
  if (nowT.hour < HOUR) {
    console.log(`Dayjest: hozir ${String(nowT.hour).padStart(2, "0")}:00, ${HOUR}:00 dan keyin chiqadi.`);
    return;
  }

  // Bugun allaqachon chiqqan bo'lsa takrorlamaymiz.
  let last = null;
  try { last = JSON.parse(await readFile(join(ROOT, STATE), "utf8")).ymd; } catch {}
  if (last === nowT.ymd) {
    console.log(`Dayjest: bugun (${nowT.ymd}) allaqachon yuborilgan.`);
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
    "",
    `@${SITE.telegram}`,
  ];

  // Dayjest muqovasi — kunning eng muhim xabarining rasmi.
  const call = (method, body) =>
    fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  let j = { ok: false };
  try {
    const bytes = await readFile(join(ROOT, `docs/og/${picked[0].slug}.jpg`));
    const form = new FormData();
    form.set("chat_id", CHAT);
    form.set("caption", lines.join("\n"));
    form.set("parse_mode", "HTML");
    form.set("photo", new Blob([bytes], { type: "image/png" }), "cover.png");
    j = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: form })
      .then((r) => r.json());
  } catch (e) {
    console.error(`  (rasm o'tmadi: ${e.message})`);
  }
  if (!j.ok) {
    j = await call("sendMessage", {
      chat_id: CHAT,
      text: lines.join("\n"),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  }
  if (!j.ok) throw new Error(j.description || "yuborilmadi");

  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(ROOT, STATE), JSON.stringify({ ymd: nowT.ymd, at: new Date().toISOString() }, null, 2) + "\n");

  console.log(`Dayjest yuborildi: ${picked.length} ta sarlavha (sutkada ${day.length} ta xabar).`);
}

main().catch((e) => {
  console.error(`Dayjest xatosi: ${e.message}`);
  process.exit(1);
});
