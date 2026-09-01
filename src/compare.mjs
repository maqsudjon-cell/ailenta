// compare.mjs — uchala dizaynni bitta sahifada yonma-yon ko'rish uchun.
// Har bir dizayn haqiqiy HTML sifatida iframe ichida ochiladi.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DESIGNS = [
  {
    id: "lenta",
    name: "Lenta",
    tagline: "Jonli oqim",
    note: "To'q fon, monokenli vaqt belgilari, chapda muhimlik chizig'i. Sahifa hozir ishlab turgandek his qoldiradi: aimastavadan eng uzoq variant.",
  },
  {
    id: "katta",
    name: "Katta",
    tagline: "Yirik tipografiya",
    note: "Oq maydon, juda katta qalin sarlavhalar, deyarli rangsiz. Telefonda kuchli ko'rinadi. Yorug' va to'q rejim ikkalasi bor.",
  },
  {
    id: "gazeta",
    name: "Gazeta",
    tagline: "Bosma terish",
    note: "Ustunlar, ingichka chiziqlar, serif shrift, bosh harf tushirilgan. Jiddiy va ishonchli ohang.",
  },
];

// srcdoc ichidagi hujjat o'z <meta charset> ini emas, ota-sahifaning
// kodlanishini meros oladi. Shuning uchun ASCII bo'lmagan har bir belgini
// raqamli entity'ga o'giramiz — sahifa qanday uzatilishidan qat'i nazar to'g'ri o'qiladi.
const escAttr = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
   .replace(/[\u0080-\uFFFF]/g, (c) => `&#${c.codePointAt(0)};`);

const frames = await Promise.all(
  DESIGNS.map(async (d) => ({
    ...d,
    html: await readFile(join(ROOT, "site", d.id, "index.html"), "utf8"),
  }))
);

const page = `<title>AI Lenta dizayn tanlovi</title>
<style>
  :root{
    --bg:#EDEEF1; --card:#FFFFFF; --ink:#15181D; --dim:#5C636D; --faint:#8B929B;
    --line:#D3D7DD; --accent:#1B45E6;
    --sans:"Helvetica Neue",Arial,sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,monospace;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --bg:#0F1216; --card:#161A21; --ink:#E6E9EE; --dim:#9AA3AE; --faint:#6E7783;
      --line:#272D36; --accent:#8AA5FF;
    }
  }
  :root[data-theme="dark"]{
    --bg:#0F1216; --card:#161A21; --ink:#E6E9EE; --dim:#9AA3AE; --faint:#6E7783;
    --line:#272D36; --accent:#8AA5FF;
  }
  *{box-sizing:border-box}
  body{
    margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
    font-size:15px;line-height:1.55;padding:2rem 1.2rem 4rem;
  }
  .wrap{max-width:76rem;margin:0 auto;display:flex;flex-direction:column;gap:2rem}
  header{display:flex;flex-direction:column;gap:.7rem;border-bottom:2px solid var(--ink);padding-bottom:1.2rem}
  h1{margin:0;font-size:clamp(1.6rem,4vw,2.3rem);letter-spacing:-.03em;line-height:1.05}
  header p{margin:0;color:var(--dim);max-width:62ch}
  .eyebrow{
    font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;
    text-transform:uppercase;color:var(--faint);
  }
  .controls{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
  .controls .lbl{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-right:.3rem}
  button{
    font:inherit;font-size:.85rem;padding:.4rem .9rem;cursor:pointer;
    background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:0;
  }
  button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
  button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .design{display:flex;flex-direction:column;gap:.9rem}
  .design-head{display:flex;align-items:baseline;gap:.9rem;flex-wrap:wrap}
  .design-head h2{margin:0;font-size:1.25rem;letter-spacing:-.02em}
  .design-head .tag{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
  .design p.note{margin:0;color:var(--dim);max-width:70ch;font-size:.93rem}
  .stage{
    background:var(--card);border:1px solid var(--line);padding:.8rem;
    display:flex;justify-content:center;overflow:hidden;
  }
  iframe{
    border:0;width:100%;height:640px;display:block;background:#fff;
    transition:width .2s ease;
  }
  body[data-w="mobile"] iframe{width:390px;height:720px}
  @media (max-width:640px){ iframe{height:520px} }
</style>

<div class="wrap">
  <header>
    <span class="eyebrow">AI Lenta / dizayn tanlovi</span>
    <h1>Uchta yo'nalish, bitta kunning haqiqiy xabarlari</h1>
    <p>
      Uchala sahifada ham ayni bir ma'lumot: bugun 358 ta xabardan yig'ilib, 157 ta voqeaga
      ajratilgan va o'zbekchada yozilgan 14 ta xabar. Faqat dizayn farq qiladi.
      Sahifalar tirik: sarlavhani bossangiz asl manbaga o'tadi.
    </p>
    <div class="controls">
      <span class="lbl">Ekran</span>
      <button type="button" data-w="desktop" aria-pressed="true">Kompyuter</button>
      <button type="button" data-w="mobile" aria-pressed="false">Telefon</button>
    </div>
  </header>

  ${frames.map((d) => `
  <section class="design">
    <div class="design-head">
      <h2>${d.name}</h2>
      <span class="tag">${d.tagline}</span>
    </div>
    <p class="note">${d.note}</p>
    <div class="stage">
      <iframe title="${escAttr(d.name)} dizayni" loading="lazy" srcdoc="${escAttr(d.html)}"></iframe>
    </div>
  </section>`).join("")}
</div>

<script>
  const btns = document.querySelectorAll(".controls button");
  btns.forEach((b) => b.addEventListener("click", () => {
    document.body.dataset.w = b.dataset.w;
    btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
</script>
`;

await writeFile(join(ROOT, "site", "taqqoslash.html"), page);
console.log(`  ✓ site/taqqoslash.html  (${(page.length / 1024).toFixed(1)} KB)`);
