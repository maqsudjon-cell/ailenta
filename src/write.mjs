// write.mjs — klasterlarni o'zbekcha xabarga aylantiradi.
//
// Provayder AI_PROVIDER bilan tanlanadi: "gemini" (standart) yoki "anthropic".
// Kalit: GEMINI_API_KEY yoki ANTHROPIC_API_KEY.
//
// Kirish:  data/clusters.json
// Chiqish: data/posts.json (qo'shib boriladi), data/seen.json (yangilanadi)

import { readFile, writeFile, rename } from "node:fs/promises";
import { storyKey, sameStory } from "./similar.mjs";
import { normalizeTags, TAG_GUIDE } from "./tags.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Fayl yozilayotganda jarayon to'xtasa (masalan quvur yopilsa), oddiy
// writeFile faylni bo'shatib qoldiradi. Avval yonidagi vaqtinchalik faylga
// yozib, keyin o'rniga ko'chiramiz — bunda fayl yo eski, yo yangi holatda bo'ladi.
async function writeAtomic(path, data) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

const PROVIDER = process.env.AI_PROVIDER || "gemini";
const BATCH = 8;

const SYSTEM = `Sen o'zbek tilidagi AI yangiliklar tahririyatining muharririsan.
Senga bir voqea haqidagi ingliz tilidagi sarlavhalar va qisqa tavsiflar beriladi.
Vazifang — o'sha voqeani o'zbekchada qisqa va aniq yetkazish.

QAT'IY QOIDALAR:
1. Faqat berilgan matndagi ma'lumotdan foydalan. O'zingdan fakt, raqam, sana yoki
   ism qo'shma. Bilganingni emas, berilganini yoz.
2. Har qanday raqam berilgan matnda aynan shunday turgan bo'lishi shart. Manbalar
   bir-biriga zid raqam bersa, ko'pchilik takrorlagan raqamni ol.
3. Sarlavha 60 belgidan oshmasin, nuqta qo'yilmasin, hayajon belgisi ishlatilmasin.
4. Xulosa — 2 yoki 3 ta jumla, jami 45 so'zgacha. Sodda, tushunarli o'zbekcha.
5. Ingliz tilidagi maqola matnini so'zma-so'z ko'chirma, o'z so'zing bilan yoz.
6. Ortiqcha sifat va reklama ohangi bo'lmasin: "ajoyib", "inqilobiy", "hayratlanarli" —
   bularni ishlatma. Faktni quruq va tiniq ayt.
7. Texnik atamalarni o'zbekchada keng qo'llaniladigan shaklda yoz: "model", "chip",
   "bulut", "agent". Sun'iy tarjima qilma. Sun'iy intellektni faqat "sun'iy
   intellekt" yoki "AI" deb yoz — "SI" yoki "SunI" kabi qisqartma ishlatma.
8. Kim nima qilgani va kim xabar bergani chalkashmasin. Manbada "X kompaniyani
   tanqid qildi" desa, "X bu haqda xabar berdi" deb yozma. Harakat qilgan tomonni
   harakat qilgan tomon, xabar bergan nashrni xabar bergan nashr deb qoldir.
9. Sabab yoki maqsad manbada aytilmagan bo'lsa, o'zingdan qo'shma. Faqat nima
   bo'lganini yoz, nima uchun bo'lganini taxmin qilma.
10. Ishonching komil bo'lmasa yoki matn yetarli bo'lmasa, "skip": true qaytar.
11. Foydalanuvchi xabarining oxirida "ALLAQACHON CHIQQAN" ro'yxati beriladi.
    Agar voqea o'sha ro'yxatda allaqachon bo'lsa — boshqa so'z bilan yozilgan
    bo'lsa ham, boshqa nashrdan kelgan bo'lsa ham — "skip": true qaytar.
    Yangi tafsilot qo'shilgani takroran chiqarish uchun asos bo'lmaydi.
12. Shu javobning o'zida ikkita element bir voqea haqida bo'lsa, faqat bittasini
    qoldir — qolganiga "skip": true qo'y.

Javobni faqat JSON massiv sifatida qaytar, boshqa hech narsa yozma:
[{"id":"<berilgan id>","title":"...","summary":"...","tags":["..."],"importance":1-5,"skip":false}]

tags — 1 yoki 2 ta. ${TAG_GUIDE}
importance — 5 = kunning asosiy voqeasi, 1 = mayda xabar.`;

// ---------- provayderlar ----------

// Bepul tarifda kunlik so'rov chegarasi bor va u har bir model uchun alohida.
// Chegara tugasa 429 qaytadi — shunda biroz kutamiz, keyin yengilroq modelga
// o'tamiz. Aks holda o'sha yugurishdagi xabarlar butunlay yo'qoladi.
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.5-flash,gemini-2.5-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geminiOnce(model, key, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    }
  );
  if (res.status === 429) {
    const err = new Error(`${model}: kunlik chegara tugadi`);
    err.quota = true;
    throw err;
  }
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY yo'q");

  let last;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiOnce(model, key, prompt);
      } catch (e) {
        last = e;
        if (e.quota) break;              // bu modelda kutish yordam bermaydi
        if (attempt === 0) await sleep(3000);
      }
    }
    console.error(`  · ${last.message} — keyingi modelga o'tilmoqda`);
  }
  throw last;
}

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY yo'q");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 4000,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.content?.[0]?.text ?? "";
}

const call = PROVIDER === "anthropic" ? callAnthropic : callGemini;

// ---------- tekshiruv ----------

// Xulosadagi har bir raqam manba matnida ham bo'lishi shart.
//
// O'zbekchada kasr vergul bilan yoziladi ("3,5 milliard"), inglizchada nuqta
// bilan ("3.5 billion"). Inglizcha mingliklarni ham vergul ajratadi ("150,000").
// Shuning uchun ikki xil normallashtirib solishtiramiz: birida ajratgichlar
// nuqtaga keltiriladi (kasr uchun), ikkinchisida butunlay olib tashlanadi (minglik uchun).
const asDecimal = (s) => s.replace(/\s/g, "").replace(/,/g, ".");
const asDigits = (s) => s.replace(/[\s.,]/g, "");

export function numbersAreGrounded(text, sourceText) {
  const nums = text.match(/\d[\d.,\s]*\d|\d/g) || [];
  const hayDecimal = asDecimal(sourceText);
  const hayDigits = asDigits(sourceText);

  return nums.every((raw) => {
    const n = raw.replace(/[.,\s]+$/, "");
    const dec = asDecimal(n);
    const dig = asDigits(n);
    if (dig.length <= 1) return true;             // "2 ta kompaniya" kabi mayda sonlar
    if (/^(19|20)\d\d$/.test(dig)) return true;   // yil
    return hayDecimal.includes(dec) || hayDigits.includes(dig);
  });
}

function extractJson(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("JSON topilmadi");
  return JSON.parse(text.slice(start, end + 1));
}

const slugify = (s) =>
  s.toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// ---------- asosiy ----------

async function main() {
  const clusters = JSON.parse(await readFile(join(ROOT, "data/clusters.json"), "utf8"));
  if (!clusters.length) return console.log("Yangi klaster yo'q.");

  // Jadval ikki marta ishga tushsa, ikkinchisida deyarli hamma narsa takror
  // bo'ladi. Bir-ikkita arzimas klaster uchun bepul limitni sarflamaymiz.
  const MIN_CLUSTERS = Number(process.env.MIN_CLUSTERS || 2);
  if (clusters.length < MIN_CLUSTERS) {
    return console.log(`Atigi ${clusters.length} ta yangi klaster — LLM chaqirilmadi.`);
  }

  let posts = [];
  let seen = { urls: [], titles: [] };
  try { posts = JSON.parse(await readFile(join(ROOT, "data/posts.json"), "utf8")); } catch {}
  try { seen = JSON.parse(await readFile(join(ROOT, "data/seen.json"), "utf8")); } catch {}

  const written = [];

  // Nashr etilgan xabarlarning o'zbekcha matn imzosi. Inglizcha sarlavhalar
  // bo'yicha tekshiruv filter.mjs da bo'ldi, ammo turli nashrlar bir voqeani
  // butunlay boshqa so'zlar bilan yozadi va u yerdan o'tib ketishi mumkin.
  // Model esa hammasini bitta o'zbekcha shaklga keltiradi — oxirgi to'siq shu.
  const publishedKeys = posts.map(storyKey);

  for (let i = 0; i < clusters.length; i += BATCH) {
    const batch = clusters.slice(i, i + BATCH);
    const prompt = batch
      .map((c, n) => {
        const lead = c.items[0];
        const others = c.items.slice(1, 6).map((x) => `- ${x.sourceName}: ${x.title}`).join("\n");
        return [
          `### ${n}`,
          `id: ${lead.id}`,
          `Asosiy manba: ${lead.sourceName}`,
          `Sarlavha: ${lead.title}`,
          lead.summary ? `Tavsif: ${lead.summary.slice(0, 600)}` : "",
          others ? `Boshqa nashrlar:\n${others}` : "",
        ].filter(Boolean).join("\n");
      })
      .join("\n\n");

    // Modelga oxirgi chiqqan xabarlarni sarlavhasi va xulosasining boshi bilan
    // ko'rsatamiz. Yolg'iz sarlavha yetarli emas: "AI global iqtisodiy inqirozga
    // sabab bo'lishi mumkin" va "Angliya banki rahbari AI kiberxavflaridan
    // ogohlantirdi" bir odamning bir chiqishi haqida, lekin sarlavhalari
    // umuman kesishmaydi. Xulosada esa ikkalasida ham uning ismi turadi.
    const recent = posts
      .slice(0, 30)
      .map((p) => `- ${p.title} — ${p.summary.split(/\s+/).slice(0, 16).join(" ")}`)
      .join("\n");
    const full = recent
      ? `${prompt}\n\n### ALLAQACHON CHIQQAN\n${recent}`
      : prompt;

    let parsed;
    try {
      parsed = extractJson(await call(full));
    } catch (e) {
      console.error(`  ✗ LLM xatosi: ${e.message}`);
      continue;
    }

    for (const r of parsed) {
      const c = batch.find((x) => x.items[0].id === r.id);
      if (!c) continue;
      // Nima rad etilgani ko'rinib tursin: filtr juda qattiq bo'lib qolsa
      // yoki aksincha o'tkazib yuborsa, buni logdan bilamiz.
      if (r.skip) {
        console.error(`  · model o'tkazmadi: ${c.items[0].title.slice(0, 70)}`);
        continue;
      }
      if (!r.title || !r.summary) continue;

      const sourceText = c.items.map((x) => `${x.title} ${x.summary || ""}`).join(" ");
      if (!numbersAreGrounded(`${r.title} ${r.summary}`, sourceText)) {
        console.error(`  ✗ tashlandi (raqam manbada yo'q): ${r.title}`);
        continue;
      }

      const key = storyKey(r);
      if (publishedKeys.some((prev) => sameStory(key, prev))) {
        console.error(`  ✗ tashlandi (bu voqea chiqib bo'lgan): ${r.title}`);
        continue;
      }
      publishedKeys.push(key);

      const lead = c.items[0];
      written.push({
        id: lead.id,
        slug: `${slugify(r.title)}-${lead.id.slice(0, 6)}`,
        title: r.title.trim(),
        summary: r.summary.trim(),
        tags: normalizeTags(r.tags),
        importance: Math.min(5, Math.max(1, Number(r.importance) || 3)),
        score: c.score,
        published: lead.published,
        created: new Date().toISOString(),
        // coverage — nechta nashr bu voqea haqida yozgani. Sahifada chiziq
        // bo'lib ko'rinadi, shuning uchun to'liq son bo'lishi shart.
        coverage: c.items.length,
        source: {
          name: lead.sourceName,
          url: lead.url,
          title: lead.title,
          indirect: !!lead.indirect,
        },
        // Boshqa nashrlar — nomi va havolasi bilan. Xabar sahifasida
        // o'quvchi bir voqeani bir necha manbadan tekshira olishi uchun.
        also: (() => {
          const seenName = new Set([lead.sourceName]);
          const out = [];
          for (const x of c.items.slice(1)) {
            if (seenName.has(x.sourceName) || x.indirect) continue;
            seenName.add(x.sourceName);
            out.push({ name: x.sourceName, url: x.url });
            if (out.length >= 6) break;
          }
          return out;
        })(),
        model: PROVIDER,
      });
    }
  }

  // Voqea nashr etilganda uning BARCHA nashrlaridagi sarlavhalarni eslab qolamiz.
  // Faqat bosh manbani eslasak, keyingi yugurishda o'sha voqeaga boshqa nashr
  // bosh bo'lib qoladi va xabar ikkinchi marta chiqib ketadi.
  const flat = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  for (const p of written) {
    const c = clusters.find((x) => x.items[0].id === p.id);
    for (const it of (c ? c.items : []).slice(0, 12)) {
      seen.urls.push(it.url);
      seen.titles.push(flat(it.title));
    }
  }
  seen.urls = seen.urls.slice(-12000);
  seen.titles = seen.titles.slice(-6000);

  posts = [...written, ...posts];

  await writeAtomic(join(ROOT, "data/posts.json"), JSON.stringify(posts, null, 2));
  await writeAtomic(join(ROOT, "data/seen.json"), JSON.stringify(seen, null, 2));

  // Shu yugurishda nima chiqqani — Telegram shu ro'yxatdan yuboradi.
  await writeAtomic(
    join(ROOT, "data/last-run.json"),
    JSON.stringify({ at: new Date().toISOString(), slugs: written.map((p) => p.slug) }, null, 2)
  );

  console.log(`Yozildi: ${written.length} ta xabar (jami ${posts.length})`);
  for (const p of written) console.log(`  [${p.importance}] ${p.title}`);
}

// To'g'ridan-to'g'ri ishga tushirilgandagina bajariladi. Modul import qilinganda
// (masalan testda) quvur o'z-o'zidan ishlab ketmasligi kerak.
if (process.argv[1] && process.argv[1].endsWith("write.mjs")) main();
