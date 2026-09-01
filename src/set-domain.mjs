// set-domain.mjs — saytni yangi domenga ko'chiradi.
//
//   node src/set-domain.mjs ailenta.uz
//
// Manzil bitta joyda (templates/shell.mjs dagi SITE.url) turadi, qolgan hamma
// narsa — canonical, og:url, sitemap, RSS, muqova rasmidagi yozuv — o'shandan
// olinadi. Shuning uchun ko'chirish uchun shu bitta qatorni va CNAME faylini
// almashtirish yetadi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const domain = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
  console.error("Ishlatilishi: node src/set-domain.mjs ailenta.uz");
  process.exit(1);
}

// Domen haqiqatan GitHub Pages'ga qarab turganini tekshiramiz — noto'g'ri
// ulangan domenga ko'chsak sayt butunlay ochilmay qoladi.
const PAGES_IPS = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];

async function dnsOk() {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      headers: { accept: "application/dns-json" },
    });
    const j = await res.json();
    const ips = (j.Answer || []).filter((a) => a.type === 1).map((a) => a.data);
    return { ips, ok: ips.some((ip) => PAGES_IPS.includes(ip)) };
  } catch (e) {
    return { ips: [], ok: false, error: e.message };
  }
}

const shellPath = join(ROOT, "templates/shell.mjs");
const shell = await readFile(shellPath, "utf8");
const current = shell.match(/url:\s*"([^"]+)"/)?.[1];

console.log(`  Hozirgi: ${current}`);
console.log(`  Yangi:   https://${domain}\n`);

const dns = await dnsOk();
if (dns.ok) {
  console.log(`  ✓ DNS to'g'ri: ${dns.ips.join(", ")}`);
} else {
  console.log(`  ⚠ DNS hali GitHub Pages'ga qaramayapti${dns.ips.length ? `: ${dns.ips.join(", ")}` : " (A yozuvi yo'q)"}`);
  console.log("    Kerakli A yozuvlari:");
  for (const ip of PAGES_IPS) console.log(`      ${ip}`);
  if (!process.argv.includes("--force")) {
    console.log("\n  Baribir davom etish uchun: --force");
    process.exit(1);
  }
  console.log("\n  --force berilgani uchun davom etilmoqda.");
}

await writeFile(shellPath, shell.replace(/url:\s*"[^"]+"/, `url: "https://${domain}"`));
await writeFile(join(ROOT, "docs/CNAME"), domain);

console.log(`\n  ✓ templates/shell.mjs — SITE.url yangilandi`);
console.log(`  ✓ docs/CNAME — ${domain}`);
console.log(`\n  Endi: node src/build.mjs && node src/audit.mjs`);
console.log(`  So'ng commit va push; keyin Search Console'ga yangi sitemap.`);
