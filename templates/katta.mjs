// Dizayn B — "Katta": oq maydon, juda katta tipografiya, kam rang.
//
// Sahifadagi har bir belgi biror ma'lumotni tashiydi:
//   sarlavha o'lchami  → xabar muhimligi
//   qamrov chizig'i    → nechta nashr yozgani
//   chapdagi vaqt      → Toshkent bo'yicha e'lon vaqti
//   kun ajratgichi     → xabar qaysi kunga tegishli

export function render(posts, u) {
  const { tashkent, ago, esc, via } = u;
  const nowIso = new Date().toISOString();
  const now = tashkent(nowIso);

  const sorted = posts.slice().sort(
    (a, b) => b.importance - a.importance || b.published.localeCompare(a.published)
  );
  const lead = sorted[0];
  const second = sorted.slice(1, 3);
  const rest = sorted.slice(3).sort((a, b) => b.published.localeCompare(a.published));

  const sources = [...new Set(posts.map((p) => p.source.name))].sort();

  // Qamrov chizig'i: 1 ta nashr = eng qisqa, 12+ = to'liq.
  const coverBar = (n) => {
    const pct = Math.min(100, Math.round((Math.min(n, 12) / 12) * 100));
    return `<span class="cover" title="${n} ta nashr bu voqea haqida yozdi">
      <span class="cover-track"><span class="cover-fill" style="width:${pct}%"></span></span>
      <span class="cover-n">${n} nashr</span>
    </span>`;
  };

  const tagChips = (p) => p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("");

  const sourceMark = (p) => `
    <span class="pub">${esc(p.source.name)}</span>
    ${p.source.indirect ? `<span class="viamark">${esc(via(p))}</span>` : ""}`;

  // Kun ajratgichi uchun sarlavha.
  const dayLabel = (ymd) => {
    const today = now.ymd;
    const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400_000)
      .toISOString().slice(0, 10);
    if (ymd === today) return "Bugun";
    if (ymd === y) return "Kecha";
    const t = tashkent(`${ymd}T12:00:00Z`);
    return `${t.day}-${t.month}`;
  };

  const tier = (p) => (p.importance >= 5 ? "t1" : p.importance === 4 ? "t2" : "t3");

  const feedItem = (p) => {
    const t = tashkent(p.published);
    return `
    <article class="item ${tier(p)}">
      <time class="when" datetime="${esc(p.published)}">${t.hhmm}</time>
      <div class="item-body">
        <h3><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
        <p>${esc(p.summary)}</p>
        <div class="meta">
          ${sourceMark(p)}
          ${p.coverage > 1 ? coverBar(p.coverage) : ""}
          ${tagChips(p)}
        </div>
      </div>
    </article>`;
  };

  // Xabarlarni kun bo'yicha guruhlaymiz.
  const groups = [];
  for (const p of rest) {
    const ymd = tashkent(p.published).ymd;
    const g = groups.find((x) => x.ymd === ymd);
    if (g) g.items.push(p);
    else groups.push({ ymd, items: [p] });
  }

  const secondCard = (p) => `
    <article class="twin-item">
      <h2><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h2>
      <p>${esc(p.summary)}</p>
      <div class="meta">
        ${sourceMark(p)}
        ${p.coverage > 1 ? coverBar(p.coverage) : ""}
        <span class="when-inline">${ago(p.published)}</span>
      </div>
    </article>`;

  return `<!doctype html>
<html lang="uz" data-design="katta">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Lenta — sun'iy intellekt yangiliklari o'zbekcha</title>
<meta name="description" content="Dunyodagi sun'iy intellekt yangiliklari o'zbek tilida. Har uch soatda yangilanadi, har bir xabarda asl manbaga havola.">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0B0D" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
  :root{
    --paper:#FFFFFF; --raise:#F6F7F9; --ink:#0A0A0B; --dim:#52565E; --faint:#8A9099;
    --line:#E4E6EA; --hair:#F0F1F4; --accent:#1F2BFF; --accent-soft:#E8EAFF;
    --sans:"Archivo",-apple-system,"Helvetica Neue",Arial,sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --paper:#0B0B0D; --raise:#141519; --ink:#F2F3F5; --dim:#A0A5AD; --faint:#71767E;
      --line:#25272D; --hair:#1A1C21; --accent:#8093FF; --accent-soft:#1A1E3A;
    }
  }
  :root[data-theme="dark"]{
    --paper:#0B0B0D; --raise:#141519; --ink:#F2F3F5; --dim:#A0A5AD; --faint:#71767E;
    --line:#25272D; --hair:#1A1C21; --accent:#8093FF; --accent-soft:#1A1E3A;
  }

  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0;background:var(--paper);color:var(--ink);
    font-family:var(--sans);font-size:16px;line-height:1.5;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;text-decoration:none}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}
  .wrap{max-width:1020px;margin:0 auto;padding:0 1.4rem}

  /* ---------- yuqori chiziq ---------- */
  .topbar{
    position:sticky;top:0;z-index:30;background:var(--paper);
    border-bottom:1px solid var(--line);
  }
  .topbar-in{
    max-width:1020px;margin:0 auto;padding:.75rem 1.4rem;
    display:flex;align-items:center;gap:1rem;
  }
  .brand{font-weight:900;font-size:1.15rem;letter-spacing:-.05em;line-height:1}
  .brand em{font-style:normal;color:var(--accent)}
  .status{
    display:flex;align-items:center;gap:.45rem;
    font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;
    text-transform:uppercase;color:var(--faint);
  }
  .dot{
    width:6px;height:6px;border-radius:50%;background:var(--accent);
    animation:blip 2.4s ease-in-out infinite;
  }
  @keyframes blip{0%,100%{opacity:1}50%{opacity:.25}}
  @media (prefers-reduced-motion:reduce){.dot{animation:none}}
  .toggle{
    margin-left:auto;font:inherit;font-family:var(--mono);font-size:.68rem;
    letter-spacing:.08em;text-transform:uppercase;color:var(--dim);
    background:none;border:1px solid var(--line);padding:.32rem .7rem;cursor:pointer;
  }
  .toggle:hover{border-color:var(--ink);color:var(--ink)}
  .toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  /* ---------- yetakchi xabar ---------- */
  .hero{padding:2.6rem 0 2.2rem}
  .eyebrow{
    font-family:var(--mono);font-size:.68rem;letter-spacing:.18em;
    text-transform:uppercase;color:var(--accent);display:block;margin-bottom:1.1rem;
  }
  .hero h1{
    margin:0;font-weight:900;letter-spacing:-.05em;line-height:.94;
    font-size:clamp(2.5rem,7.6vw,5.2rem);text-wrap:balance;
  }
  .hero h1 a{
    background-image:linear-gradient(var(--accent),var(--accent));
    background-size:0% 3px;background-position:0 100%;background-repeat:no-repeat;
    transition:background-size .22s ease;
  }
  .hero h1 a:hover{background-size:100% 3px}
  @media (prefers-reduced-motion:reduce){.hero h1 a{transition:none}}
  .hero .sum{
    margin:1.3rem 0 0;font-size:1.22rem;line-height:1.45;color:var(--dim);max-width:52ch;
  }
  .hero .meta{margin-top:1.5rem}

  /* ---------- shior ---------- */
  .creed{
    display:flex;gap:1.6rem;flex-wrap:wrap;align-items:baseline;
    padding:1.1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);
    font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;color:var(--faint);
  }
  .creed b{color:var(--ink);font-weight:500}

  /* ---------- ikkilik ---------- */
  .twin{
    display:grid;grid-template-columns:1fr 1fr;gap:2.6rem;
    padding:2.4rem 0;border-bottom:1px solid var(--line);
  }
  .twin-item h2{
    margin:0;font-weight:800;font-size:1.72rem;line-height:1.1;
    letter-spacing:-.035em;text-wrap:balance;
  }
  .twin-item h2 a:hover{color:var(--accent)}
  .twin-item p{margin:.75rem 0 0;color:var(--dim);font-size:.98rem;max-width:46ch}
  .twin-item .meta{margin-top:1rem}

  /* ---------- oqim ---------- */
  .daymark{
    display:flex;align-items:center;gap:1rem;padding:2.2rem 0 .3rem;
  }
  .daymark span{
    font-weight:800;font-size:1.05rem;letter-spacing:-.02em;
  }
  .daymark::after{content:"";flex:1;height:2px;background:var(--ink)}

  .item{
    display:grid;grid-template-columns:4.2rem minmax(0,1fr);gap:1.4rem;
    padding:1.5rem 0;border-top:1px solid var(--hair);
  }
  .item:first-of-type{border-top:0}
  .when{
    font-family:var(--mono);font-size:.78rem;color:var(--faint);
    padding-top:.42rem;font-variant-numeric:tabular-nums;
  }
  .item-body{min-width:0}
  .item h3{margin:0;font-weight:700;letter-spacing:-.028em;line-height:1.16;text-wrap:balance}
  .item.t1 h3{font-size:1.6rem}
  .item.t2 h3{font-size:1.45rem}
  .item.t3 h3{font-size:1.15rem;font-weight:600;letter-spacing:-.018em}
  .item h3 a:hover{color:var(--accent)}
  .item p{margin:.55rem 0 0;color:var(--dim);font-size:.96rem;max-width:64ch}
  .item.t3 p{font-size:.92rem}

  /* ---------- meta qatori ---------- */
  .meta{
    display:flex;align-items:center;gap:.62rem;flex-wrap:wrap;margin-top:.85rem;
    font-family:var(--mono);font-size:.68rem;letter-spacing:.03em;
  }
  /* Qo'shni belgilar qo'shilib o'qilmasligi uchun ajratgich nuqta. */
  .meta > * + *::before{
    content:"\\00B7";color:var(--faint);margin-right:.62rem;
  }
  .pub{
    color:var(--ink);font-weight:500;border:1px solid var(--line);
    padding:.16rem .5rem;white-space:nowrap;
  }
  .viamark{color:var(--faint)}
  .chip{color:var(--faint);text-transform:uppercase;letter-spacing:.1em;font-size:.62rem}
  .when-inline{color:var(--faint)}
  .cover{display:inline-flex;align-items:center;gap:.42rem;color:var(--faint)}
  .cover-track{
    display:block;width:3rem;height:3px;background:var(--line);position:relative;
  }
  .cover-fill{display:block;height:100%;background:var(--accent)}
  .cover-n{font-variant-numeric:tabular-nums}

  /* ---------- quyi qism ---------- */
  .note{
    margin-top:3rem;padding:1.5rem;background:var(--raise);
    font-size:.94rem;color:var(--dim);max-width:64ch;line-height:1.6;
  }
  .note b{color:var(--ink);font-weight:600}

  .sources{padding:2.2rem 0 0;border-top:1px solid var(--line);margin-top:2.4rem}
  .sources-label{
    font-family:var(--mono);font-size:.68rem;letter-spacing:.16em;
    text-transform:uppercase;color:var(--faint);margin-bottom:.9rem;
  }
  .sources-list{
    display:flex;flex-wrap:wrap;gap:.4rem .9rem;
    font-family:var(--mono);font-size:.74rem;color:var(--dim);
  }

  footer{
    margin-top:2.4rem;padding:1.2rem 0 3rem;border-top:3px solid var(--ink);
    font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;
    text-transform:uppercase;color:var(--faint);
    display:flex;gap:1.6rem;flex-wrap:wrap;
  }

  @media (max-width:720px){
    /* Tor ekranda meta satri o'ralganda ajratgich nuqta satr boshida
       yolg'iz qolib, ro'yxat belgisiga o'xshab ketadi — oraliq bilan ajratamiz. */
    .meta{gap:.35rem .95rem}
    .meta > * + *::before{content:none}
    .creed{gap:.3rem 1.1rem;padding:.9rem 0;font-size:.68rem}
    .creed b{display:block;width:100%}
    .hero{padding:2rem 0 1.6rem}
    .hero .sum{font-size:1.08rem}
    .twin{grid-template-columns:1fr;gap:2rem;padding:2rem 0}
    .item{grid-template-columns:1fr;gap:.45rem;padding:1.3rem 0}
    .when{padding:0;font-size:.72rem}
    .item.t1 h3{font-size:1.55rem}
    .item.t2 h3{font-size:1.28rem}
    .item.t3 h3{font-size:1.08rem}
  }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-in">
    <span class="brand">ai<em>.</em>lenta</span>
    <span class="status"><span class="dot"></span>${now.hhmm} da yangilandi</span>
    <button class="toggle" type="button" id="theme">Rejim</button>
  </div>
</div>

<div class="wrap">

  <section class="hero">
    <span class="eyebrow">Kunning asosiy xabari</span>
    <h1><a href="${esc(lead.source.url)}" target="_blank" rel="noopener">${esc(lead.title)}</a></h1>
    <p class="sum">${esc(lead.summary)}</p>
    <div class="meta">
      ${sourceMark(lead)}
      ${lead.coverage > 1 ? coverBar(lead.coverage) : ""}
      <span class="when-inline">${ago(lead.published)}</span>
    </div>
  </section>

  <div class="creed">
    <span><b>Sun'iy intellekt yangiliklari, o'zbekcha.</b></span>
    <span>Har 3 soatda yangilanadi</span>
    <span>${posts.length} ta xabar</span>
    <span>${sources.length} ta manba</span>
  </div>

  <section class="twin">
    ${second.map(secondCard).join("")}
  </section>

  ${groups.map((g) => `
  <section>
    <div class="daymark"><span>${dayLabel(g.ymd)}</span></div>
    ${g.items.map(feedItem).join("")}
  </section>`).join("")}

  <p class="note">
    <b>Bu sahifa avtomat to'ldiriladi.</b> Xabarlar ochiq manbalardan yig'iladi, xulosalar
    sun'iy intellekt yordamida o'zbekchada yoziladi va har birida asl manbaga havola turadi.
    Sarlavha o'lchami xabar muhimligini, yonidagi chiziq esa bu voqea haqida nechta nashr
    yozganini ko'rsatadi. Tahlil maqolalari qo'lda yoziladi va alohida belgilanadi.
  </p>

  <section class="sources">
    <div class="sources-label">Bugungi manbalar</div>
    <div class="sources-list">${sources.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
  </section>

  <footer>
    <span>ai.lenta</span>
    <span>${now.day}-${now.month}, ${new Date().getUTCFullYear()}</span>
    <span>Toshkent ${now.hhmm}</span>
  </footer>

</div>

<script>
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById("theme");
    try {
      var saved = localStorage.getItem("ailenta-theme");
      if (saved) root.setAttribute("data-theme", saved);
    } catch (e) {}
    btn.addEventListener("click", function () {
      var isDark = root.getAttribute("data-theme") === "dark"
        || (!root.hasAttribute("data-theme")
            && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = isDark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ailenta-theme", next); } catch (e) {}
    });
  })();
</script>

</body>
</html>`;
}
