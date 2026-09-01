// cover.mjs — har bir xabar uchun muqova rasmi.
//
// Rasm sun'iy intellekt bilan yaratilmaydi va birovning suratidan olinmaydi.
// Hammasi kod bilan chiziladi: mavzudan kelib chiqqan rang, qo'lda chizilgan
// piktogramma va xabar identifikatoridan hosil bo'ladigan geometrik naqsh.
// Shu sababli har bir xabarning muqovasi boshqacha, lekin bittasi ham tasodifiy
// emas — bir xil xabar har doim bir xil rasm beradi.

import { topicColor, topicGlyph } from "../templates/marks.mjs";

// ---------- takrorlanadigan tasodif ----------

// Bir xil urug'dan har doim bir xil ketma-ketlik chiqadi (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- naqsh ----------

// Ustunlar bo'ylab joylashgan kataklar: to'ldirilgan doira, halqa yoki tayoqcha.
// Qaysi biri chiqishi xabar identifikatoriga bog'liq.
function pattern({ x, y, w, h, cols, rows, color, seed, precise = true }) {
  // Kichik rasmda kasr koordinata ko'zga tashlanmaydi, lekin sahifa vaznini
  // ikki barobar oshiradi — shuning uchun u yerda butun songa yaxlitlanadi.
  const f = (n) => (precise ? n.toFixed(1) : Math.round(n));
  const rand = rng(seed);
  const cw = w / cols;
  const ch = h / rows;
  const out = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const v = rand();
      if (v < 0.28) continue; // bo'sh katak — naqsh nafas olsin
      const cx = x + c * cw + cw / 2;
      const cy = y + r * ch + ch / 2;
      const s = Math.min(cw, ch);
      const op = (0.18 + rand() * 0.62).toFixed(precise ? 2 : 1);
      if (v < 0.55) {
        out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.3)}" fill="${color}" opacity="${op}"/>`);
      } else if (v < 0.8) {
        out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.29)}" fill="none" stroke="${color}" stroke-width="${f(s * 0.1)}" opacity="${op}"/>`);
      } else {
        const vertical = rand() < 0.5;
        const bw = vertical ? s * 0.16 : s * 0.62;
        const bh = vertical ? s * 0.62 : s * 0.16;
        out.push(`<rect x="${f(cx - bw / 2)}" y="${f(cy - bh / 2)}" width="${f(bw)}" height="${f(bh)}" rx="${f(Math.min(bw, bh) / 2)}" fill="${color}" opacity="${op}"/>`);
      }
    }
  }
  return out.join("");
}

// ---------- matnni qatorlarga bo'lish ----------

// resvg matn kengligini o'lchab bermaydi, shuning uchun harf kengligini
// taxminlaymiz. Archivo 800 uchun o'rtacha kenglik ~0.53em; keng harflar
// ko'p bo'lsa qator biroz uzayadi, shuning uchun zaxira qoldiramiz.
function wrap(text, maxWidth, fontSize, maxLines) {
  const perChar = fontSize * 0.53;
  const limit = Math.floor(maxWidth / perChar);
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > limit && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (words.join(" ").length > lines.join(" ").length) {
      lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
    }
  }
  return lines;
}

// ---------- katta muqova (ijtimoiy tarmoq uchun) ----------

export function coverSvg(post, { width = 1200, height = 630 } = {}) {
  const color = topicColor(post.tags);
  const glyph = topicGlyph(post.tags, color, 24);
  const seed = seedOf(post.slug || post.id || post.title);

  // Sarlavha uzun bo'lsa shrift kichrayadi — to'rt qatordan oshmasin.
  const pad = 64;
  const textWidth = 700;
  let fs = 66;
  let lines = wrap(post.title, textWidth, fs, 4);
  if (lines.length > 3) {
    fs = 56;
    lines = wrap(post.title, textWidth, fs, 4);
  }
  const lineH = fs * 1.06;
  const blockH = lines.length * lineH;
  const startY = height / 2 - blockH / 2 + fs * 0.62;

  // Belgi mavzudan olingan bo'lsa, yozuv ham o'sha mavzu bo'lsin — aks holda
  // sud bolg'asi yonida "ANTHROPIC" turadi va ikkisi bir-biriga mos kelmaydi.
  const tags = post.tags || [];
  const matching = tags.find((t) => String(t).toLowerCase() === glyph.key);
  const tag = matching || tags[0] || "yangilik";
  const src = post.source?.name || "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <g>${pattern({ x: 812, y: 0, w: 388, h: height, cols: 5, rows: 8, color, seed })}</g>
  <rect x="0" y="0" width="10" height="${height}" fill="${color}"/>

  <g transform="translate(${pad}, 62)">
    <rect x="0" y="-16" width="22" height="5" rx="2.5" fill="${color}"/>
    <rect x="0" y="-8" width="16" height="5" rx="2.5" fill="#0A0A0B" opacity="0.8"/>
    <rect x="0" y="0" width="10" height="5" rx="2.5" fill="#0A0A0B" opacity="0.45"/>
    <text x="34" y="3" font-family="Archivo" font-size="26" font-weight="800" fill="#0A0A0B" letter-spacing="-1">ai.lenta</text>
  </g>

  <g transform="translate(${pad}, ${height - 88}) scale(1.5)">${glyph.inner}</g>
  <text x="${pad + 50}" y="${height - 65}" font-family="IBM Plex Mono" font-size="25" font-weight="500" fill="${color}">${esc(String(tag).toUpperCase())}</text>
  <text x="${pad + 50}" y="${height - 65}" dx="${(String(tag).length * 15 + 26).toFixed(0)}" font-family="IBM Plex Mono" font-size="25" fill="#9CA3AF">${esc(src)}</text>

  ${lines
    .map((l, i) => `<text x="${pad}" y="${(startY + i * lineH).toFixed(0)}" font-family="Archivo" font-size="${fs}" font-weight="800" fill="#0A0A0B" letter-spacing="-2">${esc(l)}</text>`)
    .join("\n  ")}
</svg>`;
}

// ---------- kichik muqova (lentadagi qator uchun) ----------
//
// Sahifaga to'g'ridan-to'g'ri SVG bo'lib joylashadi: qo'shimcha so'rov ham,
// kattalashtirilganda loyqalanish ham bo'lmaydi.
export function thumbSvg(post, size = 64) {
  const color = topicColor(post.tags);
  const glyph = topicGlyph(post.tags, color, 24);
  const seed = seedOf((post.slug || post.title) + "t");
  // HTML ichida xmlns kerak emas; koordinatalar butun songa yaxlitlanadi.
  return `<svg class="thumb" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">`
    + `<rect width="64" height="64" rx="7" fill="${color}" opacity=".13"/>`
    + `<g opacity=".8">${pattern({ x: 0, y: 0, w: 64, h: 64, cols: 3, rows: 3, color, seed, precise: false })}</g>`
    + `<circle cx="32" cy="32" r="17" fill="#fff" opacity=".92"/>`
    + `<g transform="translate(17 17) scale(1.25)">${glyph.inner}</g></svg>`;
}

export { topicColor, topicGlyph };
