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

// Ikki matn bir voqea haqidami? Kamida uchta jiddiy so'z umumiy bo'lishi va
// qisqarog'ining yarmidan ko'pi mos kelishi shart.
export function sameStory(a, b) {
  const shared = overlap(a, b);
  if (shared < 3) return false;
  return shared / Math.min(a.size, b.size) >= 0.45;
}

export const storyKey = (post) => tokens(`${post.title} ${post.summary}`);
