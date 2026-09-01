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
  if (overlap(a.full, b.full) < 3) return false;
  return containment(a.full, b.full) >= 0.45;
}

export const storyKey = (post) => ({
  title: tokens(post.title),
  full: tokens(`${post.title} ${post.summary}`),
});
