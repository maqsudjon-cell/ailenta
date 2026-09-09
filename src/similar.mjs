// similar.mjs — o'zbekcha matnlarning bir voqea haqidaligini aniqlash.
//
// Inglizcha sarlavhalarni solishtirish yetarli emas: nashrlar bir voqeani
// butunlay boshqa so'zlar bilan yozadi. Model esa hammasini bitta o'zbekcha
// shaklga keltiradi, shuning uchun oxirgi tekshiruv aynan shu matn ustida
// bo'lishi kerak.

const STOP = new Set(
  ("va bilan uchun ham bu shu uni unga ular bir ikki har qanday keyin oldin"
   + " kompaniyasi kompaniyani kompaniya haqida bo'yicha ustidan orqali"
   + " mumkin kerak bo'lgan bo'ldi qildi etdi hisoblanadi degan").split(" ")
);

// O'zbekchada qo'shimcha so'z OXIRIGA qo'shiladi: "xavf" matnda "xavfi",
// "xavfidan", "xavflari" bo'lib keladi. To'liq so'z bo'yicha solishtirish
// ularni boshqa-boshqa deb hisoblaydi va bir voqea haqidagi ikki xabar
// bir-birini tanimay qoladi (o'lchandi: "Anthropic xodimi ... xavfi tufayli
// ketdi" va "Anthropic yetakchisi ... xavfidan ogohlantirdi" — umumiy so'z 1 ta).
//
// So'z boshi bo'yicha solishtirish buni tuzatadi: qamrov 0.25 dan 0.50 ga
// ko'tariladi.
const STEM_LEN = 5;
export const stems = (s) => new Set([...tokens(s)].map((w) => w.slice(0, STEM_LEN)));

export const tokens = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9Ѐ-ӿ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );

export function overlap(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

const containment = (a, b) => overlap(a, b) / Math.min(a.size, b.size || 1);

// Ikki xabar bir voqea haqidami?
//
// Sarlavha va to'liq matn alohida solishtiriladi. Sarlavha aniqroq signal:
// "OpenAI reklama biznesi 1 milliard dollarga yetdi" va "ChatGPT reklama
// daromadi 1 milliard dollarga yetdi" — bir voqea, lekin xulosalari boshqacha
// yozilgani uchun to'liq matn bo'yicha o'xshashlik 0.44 ga tushib qoladi.
// Sarlavhalar bo'yicha esa 0.67.
export function sameStory(a, b) {
  if (overlap(a.title, b.title) >= 3 && containment(a.title, b.title) >= 0.6) return true;
  // Ildiz qavati: qo'shimchalar tufayli o'tib ketgan aniq takrorlar uchun.
  // Chegara o'shanday qat'iy qoladi — bu qo'shimcha imkoniyat, yumshatish emas.
  if (a.titleStem && b.titleStem
      && overlap(a.titleStem, b.titleStem) >= 3
      && containment(a.titleStem, b.titleStem) >= 0.6) return true;
  if (overlap(a.full, b.full) < 3) return false;
  return containment(a.full, b.full) >= 0.45;
}

export const storyKey = (post) => ({
  title: tokens(post.title),
  full: tokens(`${post.title} ${post.summary}`),
  titleStem: stems(post.title),
  fullStem: stems(`${post.title} ${post.summary}`),
  // Ishora matnida ko'rsatish uchun
  label: post.title,
});

// IKKI QAVAT.
//
// Qat'iy to'siq (sameStory) faqat aniq takrorni ushlaydi. Lekin nashrlar bir
// voqeani chinakam boshqa so'zlar bilan yozadi va o'sha to'siq ularni
// o'tkazib yuboradi — kanalga bitta xabar uch marta chiqqani shundan.
//
// So'z solishtirish bu masalani YECHA OLMAYDI. Shuning uchun zaif signal
// qaror emas, MODELGA ISHORA sifatida ishlatiladi: "bu quyidagilarga
// o'xshashi mumkin, tekshir". Model esa ma'noni tushunadi.
//
// Chegara 0.30 o'lchab tanlangan: 40 xabarlik sinovda o'rtacha 0.4 ta
// ishora, eng ko'pi 3 ta — shovqin deyarli yo'q.
// Chegara va rejim o'lchab tanlangan. Uchta ma'lum takror juftida:
//
//   rejim        chegara  ushlandi  ishora/xabar
//   sarlavha     0.33     3/3       0.45
//   sarlavha     0.35     2/3       0.28
//   sarlavha+matn 0.30    3/3       0.70
//
// Sarlavha bo'yicha 0.33 — hammasini ushlaydi va shovqini eng kam.
// To'liq matnni qo'shish ushlashni oshirmaydi, faqat shovqin beradi.
const HINT_MIN = 0.33;

export function similarCandidates(key, keys, limit = 3) {
  const out = [];
  for (const prev of keys) {
    const c = containment(key.titleStem, prev.titleStem);
    if (c >= HINT_MIN) out.push({ score: c, label: prev.label });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
