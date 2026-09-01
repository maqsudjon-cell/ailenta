// marks.mjs — brend belgisi, mavzu ranglari va mavzu piktogrammalari.
//
// Hammasi qo'lda chizilgan oddiy geometriya: sun'iy intellekt yaratgan rasm ham,
// birovning logotipi ham ishlatilmaydi. Har bir shakl mavzuni bildiradi.

// ---------- brend belgisi ----------

// Lenta — qatorlar oqimi. Eng yuqorigi eng yangisi, shuning uchun u urg'uli.
// Qatorlar uzunligi turlicha: teng bo'lsa menyu belgisiga o'xshab qoladi.
export function brandMark({ size = 64, ground = "#0A0A0B", accent = "#1F2BFF", ink = "#FFFFFF" } = {}) {
  const r = size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" rx="${(r / size) * 64}" fill="${ground}"/>
  <rect x="12" y="17" width="40" height="7" rx="3.5" fill="${accent}"/>
  <rect x="12" y="28.5" width="30" height="7" rx="3.5" fill="${ink}" opacity="0.85"/>
  <rect x="12" y="40" width="19" height="7" rx="3.5" fill="${ink}" opacity="0.5"/>
</svg>`;
}

// ---------- mavzu ranglari ----------
//
// Bitta ohang darajasida turli rang tonlari: yonma-yon turganda oila bo'lib
// ko'rinadi, lekin bir-biridan ajraladi.
const HUES = {
  anthropic: "#B45309",
  openai: "#0F766E",
  google: "#1D4ED8",
  nvidia: "#4D7C0F",
  meta: "#1E40AF",
  microsoft: "#0E7490",
  apple: "#3F3F46",
  xavfsizlik: "#C2410C",
  maxfiylik: "#7E22CE",
  sud: "#6D28D9",
  qonun: "#5B21B6",
  chiplar: "#0369A1",
  biznes: "#15803D",
  iqtisod: "#A16207",
  siyosat: "#475569",
  tadqiqot: "#4338CA",
  robototexnika: "#BE185D",
  tibbiyot: "#047857",
  bulut: "#0284C7",
  agentlar: "#1F2BFF",
  "mehnat bozori": "#B45309",
  "ochiq model": "#0D9488",
  "o'zbekiston": "#0E7490",
};

const DEFAULT_HUE = "#1F2BFF";

export function topicColor(tags = []) {
  for (const t of tags) {
    const hit = HUES[String(t).toLowerCase()];
    if (hit) return hit;
  }
  return DEFAULT_HUE;
}

// ---------- mavzu piktogrammalari ----------
//
// 24×24 maydonda, faqat to'g'ri chiziq va aylanadan yasalgan. Murakkab shakl
// kichraytirilganda loyqalanadi, bular esa 20 pikselda ham o'qiladi.
const GLYPHS = {
  xavfsizlik: `<path d="M12 3 L20 6 V12 C20 16.5 16.6 20 12 21.5 C7.4 20 4 16.5 4 12 V6 Z" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  maxfiylik: `<rect x="5" y="10.5" width="14" height="9.5" rx="1.5" fill="none" stroke="CLR" stroke-width="2"/><path d="M8.5 10.5 V7.5 a3.5 3.5 0 0 1 7 0 V10.5" fill="none" stroke="CLR" stroke-width="2"/>`,
  sud: `<path d="M12 4 V20 M6 20 H18 M4 9 H20 M7 9 L4.5 14.5 H9.5 Z M17 9 L14.5 14.5 H19.5 Z" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  qonun: `<path d="M5 4 H15 L19 8 V20 H5 Z M15 4 V8 H19 M8 12 H16 M8 16 H14" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  chiplar: `<rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke="CLR" stroke-width="2"/><path d="M10 3 V7 M14 3 V7 M10 17 V21 M14 17 V21 M3 10 H7 M3 14 H7 M17 10 H21 M17 14 H21" stroke="CLR" stroke-width="2" stroke-linecap="round"/>`,
  biznes: `<path d="M4 20 H20 M7 20 V13 M12 20 V8 M17 20 V4" fill="none" stroke="CLR" stroke-width="2" stroke-linecap="round"/>`,
  iqtisod: `<path d="M4 17 L9 11 L13 14 L20 5" fill="none" stroke="CLR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 5 H20 V10" fill="none" stroke="CLR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  siyosat: `<path d="M3 20 H21 M5 20 V10 M9.5 20 V10 M14.5 20 V10 M19 20 V10 M12 3 L21 8 H3 Z" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  tadqiqot: `<path d="M9.5 3 V9 L4.5 18.5 A1.6 1.6 0 0 0 6 21 H18 A1.6 1.6 0 0 0 19.5 18.5 L14.5 9 V3 M8 3 H16 M7.4 14 H16.6" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  robototexnika: `<rect x="4" y="8" width="16" height="12" rx="2.5" fill="none" stroke="CLR" stroke-width="2"/><circle cx="9" cy="14" r="1.6" fill="CLR"/><circle cx="15" cy="14" r="1.6" fill="CLR"/><path d="M12 4 V8 M2 12 V16 M22 12 V16" stroke="CLR" stroke-width="2" stroke-linecap="round"/>`,
  tibbiyot: `<path d="M3 12 H7 L9.5 5.5 L14 18.5 L16.5 12 H21" fill="none" stroke="CLR" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  bulut: `<path d="M7 18 A4.4 4.4 0 0 1 7.4 9.2 A5.6 5.6 0 0 1 18 10.4 A3.8 3.8 0 0 1 17.4 18 Z" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  agentlar: `<circle cx="12" cy="12" r="3" fill="none" stroke="CLR" stroke-width="2"/><circle cx="5" cy="6" r="2" fill="CLR"/><circle cx="19" cy="6" r="2" fill="CLR"/><circle cx="5" cy="18" r="2" fill="CLR"/><circle cx="19" cy="18" r="2" fill="CLR"/><path d="M6.6 7.4 L9.9 10.3 M17.4 7.4 L14.1 10.3 M6.6 16.6 L9.9 13.7 M17.4 16.6 L14.1 13.7" stroke="CLR" stroke-width="1.6"/>`,
  "mehnat bozori": `<rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="CLR" stroke-width="2"/><path d="M9 8 V6 a1.6 1.6 0 0 1 1.6-1.6 h2.8 A1.6 1.6 0 0 1 15 6 V8 M3 13.5 H21" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  "ochiq model": `<path d="M4 9 L12 4 L20 9 L12 14 Z M4 9 V16 L12 21 L20 16 V9" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  "o'zbekiston": `<circle cx="12" cy="12" r="8" fill="none" stroke="CLR" stroke-width="2"/><path d="M12 4 V20 M4 12 H20 M6.3 6.3 A11 11 0 0 0 6.3 17.7 M17.7 6.3 A11 11 0 0 1 17.7 17.7" fill="none" stroke="CLR" stroke-width="1.4"/>`,
  // Kompaniya teglari uchun umumiy belgi — logotip ishlatilmaydi.
  kompaniya: `<rect x="4" y="7" width="16" height="13" rx="1.5" fill="none" stroke="CLR" stroke-width="2"/><path d="M8 7 V4 H16 V7 M8 11.5 H16 M8 15.5 H13" fill="none" stroke="CLR" stroke-width="2" stroke-linejoin="round"/>`,
  umumiy: `<circle cx="6" cy="6" r="2" fill="CLR"/><circle cx="12" cy="6" r="2" fill="CLR"/><circle cx="18" cy="6" r="2" fill="CLR"/><circle cx="6" cy="12" r="2" fill="CLR"/><circle cx="12" cy="12" r="2" fill="CLR"/><circle cx="6" cy="18" r="2" fill="CLR"/>`,
};

const COMPANY_TAGS = new Set([
  "anthropic", "openai", "google", "nvidia", "meta", "microsoft", "apple", "amazon",
  "hugging face", "salesforce", "instagram", "vmware", "amd", "intel", "qualcomm",
  "mediatek", "xai", "mistral", "deepseek", "pentagon", "ibm", "tesla",
]);

export function topicGlyph(tags = [], color = DEFAULT_HUE, size = 24) {
  // Avval mavzu belgisi qidiriladi: "Anthropic, sud" bo'lsa sud bolg'asi
  // kompaniya belgisidan ko'ra ko'proq narsa aytadi.
  let key = null;
  for (const t of tags) {
    const k = String(t).toLowerCase();
    if (GLYPHS[k]) { key = k; break; }
  }
  if (!key) {
    key = tags.some((t) => COMPANY_TAGS.has(String(t).toLowerCase())) ? "kompaniya" : "umumiy";
  }
  const body = GLYPHS[key].replaceAll("CLR", color);
  return { key, inner: body, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${body}</svg>` };
}

export { DEFAULT_HUE };
