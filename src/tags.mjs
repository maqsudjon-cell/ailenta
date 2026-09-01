// tags.mjs — teglarni tartibga solish.
//
// Model erkin teg qo'ysa, "AI", "texnologiya" kabi hech nimani ajratmaydigan
// teglar va "xavfsizlik" / "kiberxavfsizlik" kabi ikkilanishlar paydo bo'ladi.
// Natijada mavzu sahifalari bo'linib ketadi va har biri bo'm-bo'sh qoladi.

// Butun saytga tegishli bo'lgani uchun ajratuvchi kuchi yo'q.
const BANNED = new Set([
  "ai", "a i", "sun'iy intellekt", "suniy intellekt", "sun'iy idrok",
  "texnologiya", "texnologiyalar", "yangilik", "yangiliklar", "model", "modellar",
]);

// Bir ma'noni bildiruvchi teglar bitta shaklga keltiriladi.
const MERGE = new Map(Object.entries({
  "kiberxavfsizlik": "xavfsizlik",
  "kiberhujum": "xavfsizlik",
  "xakerlik": "xavfsizlik",
  "maxfiylik": "maxfiylik",
  "qonunchilik": "qonun",
  "qonun loyihasi": "qonun",
  "sud jarayoni": "sud",
  "da'vo": "sud",
  "mualliflik huquqi": "sud",
  "chip": "chiplar",
  "yarimo'tkazgich": "chiplar",
  "yarimo'tkazgichlar": "chiplar",
  "gpu": "chiplar",
  "investitsiya": "biznes",
  "sarmoya": "biznes",
  "moliya": "biznes",
  "iqtisodiyot": "iqtisod",
  "ish o'rinlari": "mehnat bozori",
  "ishsizlik": "mehnat bozori",
  "tadqiqot": "tadqiqot",
  "ilmiy tadqiqot": "tadqiqot",
  "robot": "robototexnika",
  "robotlar": "robototexnika",
  "sog'liqni saqlash": "tibbiyot",
  "ta'lim": "ta'lim",
  "o'zbekiston": "O'zbekiston",
  "google": "Google",
  "openai": "OpenAI",
  "anthropic": "Anthropic",
  "nvidia": "Nvidia",
  "meta": "Meta",
  "microsoft": "Microsoft",
  "apple": "Apple",
  "amazon": "Amazon",
  "claude": "Anthropic",
  "chatgpt": "OpenAI",
  "gemini": "Google",
}));

export function normalizeTags(tags = []) {
  const out = [];
  for (const raw of tags) {
    const t = String(raw).trim();
    if (!t) continue;
    const key = t.toLowerCase().replace(/[’]/g, "'");
    if (BANNED.has(key)) continue;
    const clean = MERGE.get(key) || t;
    if (!out.some((x) => x.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }
  return out.slice(0, 2);
}

// Promptga qo'yiladigan yo'riqnoma.
export const TAG_GUIDE = `Teg sifatida quyidagilardan tanla:
- kompaniya nomi: Anthropic, OpenAI, Google, Nvidia, Meta, Microsoft, Apple,
  Amazon, Hugging Face, xAI, Mistral, DeepSeek, Salesforce, Qualcomm, Intel, AMD
- mavzu: xavfsizlik, maxfiylik, chiplar, sud, qonun, biznes, iqtisod, siyosat,
  tadqiqot, robototexnika, tibbiyot, ta'lim, mehnat bozori, bulut, agentlar,
  ochiq model, O'zbekiston
"AI", "sun'iy intellekt", "texnologiya", "model" kabi teg qo'yma — ular hamma
xabarda bor va hech nimani ajratmaydi.`;
