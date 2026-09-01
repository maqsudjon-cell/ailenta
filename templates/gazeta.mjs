// Dizayn C — "Gazeta": ustunlar, ingichka chiziqlar, serif terish.

export function render(posts, u) {
  const { tashkent, ago, esc, via } = u;
  const now = tashkent(new Date().toISOString());
  const sorted = posts.slice().sort((a, b) => b.importance - a.importance || b.published.localeCompare(a.published));
  const lead = sorted[0];
  const col = sorted.slice(1, 4);
  const brief = sorted.slice(4);

  const colItem = (p) => `
    <article class="col-item">
      <h3><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
      <p>${esc(p.summary)}</p>
      <div class="credit">${esc(p.source.name)}${p.coverage > 1 ? ` · ${p.coverage} nashr` : ""}</div>
    </article>`;

  const briefItem = (p) => {
    const t = tashkent(p.published);
    return `
    <article class="brief">
      <span class="hh">${t.hhmm}</span>
      <div>
        <h4><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h4>
        <p>${esc(p.summary)}</p>
        <div class="credit">${esc(p.source.name)} · ${esc(via(p))}</div>
      </div>
    </article>`;
  };

  return `<!doctype html>
<html lang="uz" data-design="gazeta">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Lenta — sun'iy intellekt yangiliklari o'zbekcha</title>
<meta name="description" content="Dunyodagi AI yangiliklari o'zbek tilida. Har uch soatda yangilanadi, har xabarda manba havolasi.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{
    --paper:#F7F6F2; --ink:#15140F; --dim:#4A4840; --faint:#8B887E;
    --rule:#CFCCC2; --hair:#E2DFD6; --red:#A8231B;
    --serif:"Newsreader",Georgia,"Times New Roman",serif;
    --display:"Bodoni Moda",Georgia,serif;
    --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  }
  *{box-sizing:border-box}
  body{
    margin:0;background:var(--paper);color:var(--ink);
    font-family:var(--serif);font-size:17px;line-height:1.52;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;text-decoration:none}
  a:hover{color:var(--red)}
  a:focus-visible{outline:2px solid var(--red);outline-offset:2px}
  .sheet{max-width:1080px;margin:0 auto;padding:0 1.5rem 4rem}

  /* ---- bosh qism ---- */
  .top{
    display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
    padding:.9rem 0;font-family:var(--mono);font-size:.66rem;
    letter-spacing:.12em;text-transform:uppercase;color:var(--faint);
    border-bottom:1px solid var(--hair);flex-wrap:wrap;
  }
  .nameplate{text-align:center;padding:2.1rem 0 1.3rem;border-bottom:3px double var(--ink)}
  .nameplate h1{
    margin:0;font-family:var(--display);font-weight:700;
    font-size:clamp(2.6rem,9vw,5.4rem);line-height:.94;letter-spacing:-.015em;
  }
  .nameplate .tag{
    margin-top:.7rem;font-family:var(--mono);font-size:.66rem;
    letter-spacing:.24em;text-transform:uppercase;color:var(--dim);
  }

  /* ---- asosiy maqola ---- */
  .front{
    display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);
    gap:2.4rem;padding:2rem 0;border-bottom:1px solid var(--rule);
  }
  .front > .main{border-right:1px solid var(--hair);padding-right:2.4rem}
  .slug{
    font-family:var(--mono);font-size:.64rem;letter-spacing:.18em;
    text-transform:uppercase;color:var(--red);margin-bottom:.8rem;
  }
  .front h2{
    margin:0;font-family:var(--display);font-weight:700;
    font-size:clamp(1.9rem,4.4vw,3rem);line-height:1.06;letter-spacing:-.012em;text-wrap:balance;
  }
  .front .deck{
    margin:1rem 0 0;font-size:1.16rem;color:var(--dim);max-width:44ch;
  }
  .front .deck::first-letter{
    float:left;font-family:var(--display);font-size:3.1rem;line-height:.82;
    padding:.08em .12em 0 0;font-weight:700;color:var(--ink);
  }
  .byline{
    margin-top:1.3rem;padding-top:.7rem;border-top:1px solid var(--hair);
    font-family:var(--mono);font-size:.68rem;color:var(--faint);
    display:flex;gap:1.1rem;flex-wrap:wrap;
  }
  .byline b{color:var(--ink);font-weight:500}

  .rail{display:flex;flex-direction:column;gap:1.5rem}
  .col-item{padding-bottom:1.5rem;border-bottom:1px solid var(--hair)}
  .col-item:last-child{border-bottom:0;padding-bottom:0}
  .col-item h3{margin:0;font-size:1.16rem;line-height:1.24;font-weight:600;letter-spacing:-.008em;text-wrap:balance}
  .col-item p{margin:.5rem 0 0;font-size:.95rem;color:var(--dim)}
  .credit{
    margin-top:.55rem;font-family:var(--mono);font-size:.64rem;
    letter-spacing:.06em;color:var(--faint);text-transform:uppercase;
  }

  /* ---- qisqa xabarlar ---- */
  .section-rule{
    display:flex;align-items:center;gap:1rem;margin:2.2rem 0 1.2rem;
    font-family:var(--mono);font-size:.66rem;letter-spacing:.2em;
    text-transform:uppercase;color:var(--dim);
  }
  .section-rule::before,.section-rule::after{content:"";height:1px;background:var(--rule);flex:1}

  .briefs{columns:2;column-gap:2.6rem;column-rule:1px solid var(--hair)}
  .brief{
    break-inside:avoid;display:grid;grid-template-columns:3.1rem minmax(0,1fr);
    gap:.8rem;padding:0 0 1.35rem;margin-bottom:1.35rem;border-bottom:1px solid var(--hair);
  }
  .hh{
    font-family:var(--mono);font-size:.7rem;color:var(--red);
    padding-top:.24rem;font-variant-numeric:tabular-nums;
  }
  .brief h4{margin:0;font-size:1.02rem;line-height:1.28;font-weight:600;text-wrap:balance}
  .brief p{margin:.4rem 0 0;font-size:.9rem;color:var(--dim)}

  .colophon{
    margin-top:2rem;padding:1.2rem 1.4rem;border:1px solid var(--rule);
    background:#FFFDF8;font-size:.92rem;color:var(--dim);max-width:62ch;
  }
  .colophon b{color:var(--ink);font-weight:600}

  footer{
    margin-top:2rem;padding-top:1rem;border-top:3px double var(--ink);
    font-family:var(--mono);font-size:.64rem;letter-spacing:.1em;
    text-transform:uppercase;color:var(--faint);display:flex;gap:1.5rem;flex-wrap:wrap;
  }

  @media (max-width:840px){
    .front{grid-template-columns:1fr;gap:1.8rem}
    .front > .main{border-right:0;padding-right:0;border-bottom:1px solid var(--hair);padding-bottom:1.8rem}
    .briefs{columns:1}
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="top">
    <span>${now.day}-${now.month}, ${new Date().getUTCFullYear()}</span>
    <span>Toshkent ${now.hhmm}</span>
    <span>${posts.length} ta xabar</span>
  </div>

  <div class="nameplate">
    <h1>AI Lenta</h1>
    <div class="tag">Sun'iy intellekt yangiliklari · o'zbek tilida</div>
  </div>

  <div class="front">
    <div class="main">
      <div class="slug">Kunning asosiy xabari</div>
      <h2><a href="${esc(lead.source.url)}" target="_blank" rel="noopener">${esc(lead.title)}</a></h2>
      <p class="deck">${esc(lead.summary)}</p>
      <div class="byline">
        <span><b>${esc(lead.source.name)}</b></span>
        <span>${lead.coverage} ta nashr yozdi</span>
        <span>${ago(lead.published)}</span>
      </div>
    </div>
    <div class="rail">
      ${col.map(colItem).join("")}
    </div>
  </div>

  <div class="section-rule">Qisqa xabarlar</div>
  <div class="briefs">
    ${brief.map(briefItem).join("")}
  </div>

  <p class="colophon">
    <b>Bu sahifa avtomat to'ldiriladi.</b> Xabarlar ochiq manbalardan yig'iladi, xulosalar
    sun'iy intellekt yordamida o'zbekchada yoziladi va har birida asl manbaga havola turadi.
    Tahlil maqolalari qo'lda yoziladi, ular alohida belgilanadi.
  </p>

  <footer>
    <span>ai.lenta</span>
    <span>${[...new Set(posts.map((p) => p.source.name))].length} ta manba</span>
    <span>Har 3 soatda yangilanadi</span>
  </footer>

</div>
</body>
</html>`;
}
