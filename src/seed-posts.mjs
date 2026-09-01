// seed-posts.mjs — dizayn maketlari uchun bir martalik urug'.
//
// LLM kaliti hali yo'q. Bu skript klasterlarning haqiqiy metama'lumotini
// (manba, havola, sana, nechta nashr yozgani) qo'lda yozilgan o'zbekcha matn
// bilan qo'shib, write.mjs chiqaradigan aynan shu shakldagi posts.json quradi.
// Kalit ulangach bu fayl kerak bo'lmaydi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Klaster indeksi → o'zbekcha matn. Faqat manbadagi faktlar.
const UZ = {
  0: {
    title: "Anthropic tashqi xavfsizlik sinovlarini qayta boshladi",
    summary: "Claude bilan bog'liq xavfsizlik hodisalaridan so'ng to'xtatilgan tashqi sinovlar yana yo'lga qo'yildi. Kompaniya moslashtirish va sandbox himoyasi bo'yicha amaliyotini kuchaytirganini aytdi.",
    tags: ["Anthropic", "xavfsizlik"], importance: 4,
  },
  1: {
    title: "Anthropic 35 milliard dollarlik bulut shartnomasi imzoladi",
    summary: "Manbalarga ko'ra shartnoma Nvidia qo'llab-quvvatlaydigan Lambda kompaniyasi bilan tuzilgan. Bu Anthropic'ning hisoblash quvvatiga bo'lgan ehtiyoji qanchalik o'sganini ko'rsatadi.",
    tags: ["Anthropic", "bulut"], importance: 5,
  },
  2: {
    title: "Sony va Warner Anthropic ustidan sudga ariza berdi",
    summary: "Musiqa nashriyotlari Claude'ni o'rgatishda o'n minglab qo'shiqdan ruxsatsiz foydalanilganini da'vo qilmoqda. Da'voda har bir qo'shiq uchun 150 ming dollar talab qilinmoqda.",
    tags: ["Anthropic", "sud"], importance: 5,
  },
  3: {
    title: "MediaTek aksiyalari Nvidia kelishuvidan keyin 10% ko'tarildi",
    summary: "Nvidia tayvanlik chip ishlab chiqaruvchiga 3,5 milliard dollar sarmoya kiritishini e'lon qilgach, MediaTek aksiyalari keskin qimmatlashdi. Kompaniya endi Qualcomm bilan bevosita raqobatga chiqmoqda.",
    tags: ["Nvidia", "chiplar"], importance: 4,
  },
  4: {
    title: "Anthropic o'g'irlangan akkauntlarga qarshi chora ko'rdi",
    summary: "Buzib kirilgan foydalanuvchi akkauntlari orqali AI tokenlari ruxsatsiz sarflanayotgani aniqlandi. Kompaniya bunday akkauntlarni bloklashni kuchaytirdi.",
    tags: ["Anthropic", "xavfsizlik"], importance: 3,
  },
  5: {
    title: "Salesforce foydasi oshdi, Claude bilan hamkorlik kengaydi",
    summary: "Kompaniyaning foydasi va tushumi o'sganini e'lon qildi. Shu bilan birga Anthropic'ning Claude modeli bilan hamkorligini kengaytirayotganini bildirdi.",
    tags: ["Salesforce", "biznes"], importance: 3,
  },
  6: {
    title: "Nvidia'ning MediaTek kelishuvi ortidagi hisob-kitob",
    summary: "Yirik texnologiya kompaniyalari o'z AI chiplarini qura boshlagan paytda Nvidia 3,5 milliard dollarlik sarmoya bilan zanjirda zarur bo'lib qolishga harakat qilmoqda.",
    tags: ["Nvidia", "chiplar"], importance: 4,
  },
  7: {
    title: "Xitoy Anthropic'ni tanqid qilib, muzokara shartlarini qo'ydi",
    summary: "Xitoy tomoni kompaniyaga nisbatan norozilik bildirdi va AQSh bilan bo'ladigan AI muzokaralari uchun o'z shartlarini e'lon qildi.",
    tags: ["Anthropic", "siyosat"], importance: 4,
  },
  8: {
    title: "Yaponiyada davlat xizmatlari uchun AI infratuzilma qurilmoqda",
    summary: "Polimill kompaniyasi OpenAI'ning GPT modellari va Codex yordamida munitsipalitetlar uchun tizim yaratmoqda. Maqsad — ma'muriy bilimlarni qidirish va ishlatishni osonlashtirish.",
    tags: ["OpenAI", "davlat"], importance: 2,
  },
  9: {
    title: "OpenAI reklama biznesi yillik 1 milliard dollarga chiqdi",
    summary: "Kompaniyaning reklama yo'nalishi tez sur'atda o'smoqda va yillik hisobda 1 milliard dollar darajasiga yetdi.",
    tags: ["OpenAI", "biznes"], importance: 4,
  },
  10: {
    title: "Claude ruxsatsiz harakat qilgach, ba'zi o'qitishlar to'xtatildi",
    summary: "Anthropic model ruxsat berilmagan amallarni bajargani aniqlangach, o'qitish jarayonining bir qismini vaqtincha to'xtatgan.",
    tags: ["Anthropic", "xavfsizlik"], importance: 4,
  },
  11: {
    title: "Tramp ma'lumot markazlariga qarshi noroziliklarni tanqid qildi",
    summary: "Prezident ma'lumot markazlari qurilishiga qarshi chiqayotgan jamoalarni tanqid qildi va bunday qarshilik hududlarni orqada qoldirishi mumkinligini aytdi.",
    tags: ["siyosat", "ma'lumot markazi"], importance: 3,
  },
  12: {
    title: "OpenAI Kaliforniyadagi bolalar xavfsizligi qonunini qo'llab-quvvatladi",
    summary: "Kompaniya SB 1119 loyihasini ma'qulladi. Loyiha o'smirlar uchun yoshga mos himoya choralarini joriy etib, o'rganish imkoniyatini saqlab qolishni ko'zlaydi.",
    tags: ["OpenAI", "qonun"], importance: 2,
  },
  13: {
    title: "Angliya bank rahbari AI tufayli tanazzul xavfidan ogohlantirdi",
    summary: "Andrew Bailey G20 doirasida sun'iy intellekt global iqtisodiy pasayishga sabab bo'lishi mumkinligini aytdi.",
    tags: ["iqtisod", "AI"], importance: 4,
  },
};

const slugify = (s) =>
  s.toLowerCase().replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const clusters = JSON.parse(await readFile(join(ROOT, "data/clusters.json"), "utf8"));

const posts = Object.entries(UZ).map(([idx, uz]) => {
  const c = clusters[Number(idx)];
  const lead = c.items[0];
  return {
    id: lead.id,
    slug: `${slugify(uz.title)}-${lead.id.slice(0, 6)}`,
    title: uz.title,
    summary: uz.summary,
    tags: uz.tags,
    importance: uz.importance,
    score: c.score,
    coverage: c.items.length,
    published: lead.published,
    created: new Date().toISOString(),
    source: { name: lead.sourceName, url: lead.url, title: lead.title, indirect: !!lead.indirect },
    also: [...new Set(c.items.slice(1).map((x) => x.sourceName))].slice(0, 4),
    model: "seed",
  };
}).sort((a, b) => b.published.localeCompare(a.published));

await writeFile(join(ROOT, "data/posts.json"), JSON.stringify(posts, null, 2));
console.log(`${posts.length} ta xabar yozildi.`);
for (const p of posts) console.log(`  [${p.importance}] ${p.title}  — ${p.source.name} +${p.coverage - 1}`);
