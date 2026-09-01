// ig-refresh.mjs — Instagram tokenini o'z-o'zidan yangilaydi.
//
// Instagram'ning uzoq muddatli tokeni 60 kunda tugaydi. Qo'lda yangilash
// esdan chiqadi va bir kuni post to'xtaydi — buni oldini olamiz.
//
// Token 30 kundan kam qolganda yangilanadi (Instagram 24 soatdan yosh
// tokenni yangilashga ruxsat bermaydi, 30 kunlik zaxira yetarli).
//
// Yangi tokenni saqlash uchun GH_ADMIN_TOKEN kerak — "Secrets: write"
// huquqiga ega. U bo'lmasa token yangilanmaydi, lekin muddat tugashiga
// oz qolganda Telegram orqali ogohlantiramiz. Jimgina to'xtab qolish
// eng yomon variant.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = join(ROOT, "data/ig-token.json");

const TOKEN = process.env.IG_ACCESS_TOKEN;
const ADMIN = process.env.GH_ADMIN_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || "maqsudjon-cell/ailenta";
const DAY = 86400_000;
const RENEW_UNDER = 30 * DAY;   // shu muddatdan kam qolsa yangilaymiz
const WARN_UNDER = 14 * DAY;    // saqlay olmasak, shu muddatdan ogohlantiramiz

async function readState() {
  try { return JSON.parse(await readFile(STATE, "utf8")); } catch { return null; }
}

// Faylda faqat sanalar turadi — token hech qachon repozitoriyaga tushmaydi.
async function saveState(expires) {
  await writeFile(STATE, JSON.stringify({
    yangilandi: new Date().toISOString(),
    tugaydi: new Date(expires).toISOString(),
    izoh: "Bu faylda maxfiy ma'lumot yo'q — faqat token muddati.",
  }, null, 2) + "\n");
}

async function warn(text) {
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chat) return;
  await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  }).catch(() => {});
}

async function main() {
  if (!TOKEN) {
    console.log("IG token: IG_ACCESS_TOKEN yo'q — o'tkazib yuborildi.");
    return;
  }

  const state = await readState();
  const expires = state?.tugaydi ? Date.parse(state.tugaydi) : 0;
  const left = expires - Date.now();

  if (expires && left > RENEW_UNDER) {
    console.log(`IG token: ${Math.round(left / DAY)} kun qoldi — yangilash shart emas.`);
    return;
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", TOKEN);

  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));

  if (!res.ok || !j.access_token) {
    const why = j.error?.message || `HTTP ${res.status}`;
    console.error(`IG token: yangilanmadi — ${why}`);
    if (left > 0 && left < WARN_UNDER) {
      await warn(`Instagram tokeni ${Math.round(left / DAY)} kundan keyin tugaydi va yangilanmadi: ${why}`);
    }
    process.exitCode = 0; // post joylashni to'xtatmaymiz
    return;
  }

  const newExpires = Date.now() + (j.expires_in || 60 * 86400) * 1000;

  if (!ADMIN) {
    console.error("IG token: yangi token olindi, lekin GH_ADMIN_TOKEN yo'q — saqlanmadi.");
    await warn(
      "Instagram tokeni yangilanishi kerak, lekin GH_ADMIN_TOKEN sozlanmagan. "
      + "GitHub'da 'Secrets: write' huquqli token qo'shilsa, bu o'z-o'zidan hal bo'ladi."
    );
    return;
  }

  await run("gh", ["secret", "set", "IG_ACCESS_TOKEN", "--repo", REPO, "--body", j.access_token], {
    env: { ...process.env, GH_TOKEN: ADMIN },
  });

  await saveState(newExpires);
  console.log(`IG token: yangilandi — ${new Date(newExpires).toISOString().slice(0, 10)} gacha.`);
}

main();
