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

// Ikki yo'l bilan so'raymiz. Faqat DoH'ga suyanish xato edi: bu kompyuterdan
// dns.google javob bermay qoldi va skript to'g'ri ulangan domenni "ulanmagan"
// deb ko'rsatdi. Tizimning o'z resolveri asosiy, DoH zaxira.
async function resolveSystem() {
  try {
    const { Resolver } = await import("node:dns/promises");
    const r = new Resolver();
    r.setServers(["1.1.1.1", "8.8.8.8"]);
    return await r.resolve4(domain);
  } catch {
    return null;
  }
}

async function resolveDoh() {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.Answer || []).filter((a) => a.type === 1).map((a) => a.data);
  } catch {
    return null;
  }
}

async function dnsOk() {
  const ips = (await resolveSystem()) ?? (await resolveDoh());
  if (!ips) return { ips: [], ok: false, error: "DNS so'rovi o'tmadi" };
  return { ips, ok: ips.some((ip) => PAGES_IPS.includes(ip)) };
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
