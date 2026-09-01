// Dizayn A — "Lenta": jonli oqim, dispetcher ekrani uslubi.

export function render(posts, u) {
  const { tashkent, ago, esc, via } = u;
  const now = tashkent(new Date().toISOString());
  const top = posts.slice().sort((a, b) => b.importance - a.importance || b.published.localeCompare(a.published));
  const lead = top[0];
  const rest = posts.filter((p) => p.id !== lead.id);

  const row = (p) => {
    const t = tashkent(p.published);
    return `
      <article class="row imp-${p.importance}">
        <div class="row-time">
          <span class="t">${t.hhmm}</span>
          <span class="d">${t.date}</span>
        </div>
        <div class="row-body">
          <h3><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
          <p>${esc(p.summary)}</p>
          <div class="row-meta">
            <span class="src">${esc(p.source.name)}</span>
            ${p.coverage > 1 ? `<span class="cov">${p.coverage} nashr yozdi</span>` : ""}
            ${p.tags.map((tg) => `<span class="tag">${esc(tg)}</span>`).join("")}
            <span class="host">${esc(via(p))}</span>
          </div>
        </div>
      </article>`;
  };

  return `<!doctype html>
<html lang="uz" data-design="lenta">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Lenta — sun'iy intellekt yangiliklari o'zbekcha</title>
<meta name="description" content="Dunyodagi AI yangiliklari o'zbek tilida. Har uch soatda yangilanadi, har xabarda manba havolasi.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
  :root{
    --bg:#0A0C10; --panel:#11151C; --panel2:#161B23; --line:#232A34;
    --fg:#E2E7EE; --dim:#8A94A3; --faint:#5D6673;
    --signal:#FF6B4A; --live:#4ADE80; --cool:#6EA8FF;
    --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
    --sans:"IBM Plex Sans",-apple-system,Segoe UI,sans-serif;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0;background:var(--bg);color:var(--fg);
    font-family:var(--sans);font-size:15px;line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;text-decoration:none}
  a:focus-visible{outline:2px solid var(--signal);outline-offset:3px;border-radius:2px}

  /* ---- yuqori panel ---- */
  .bar{
    position:sticky;top:0;z-index:20;background:rgba(10,12,16,.92);
    backdrop-filter:blur(10px);border-bottom:1px solid var(--line);
  }
  .bar-in{
    max-width:1080px;margin:0 auto;padding:.7rem 1.1rem;
    display:flex;align-items:center;gap:1.1rem;flex-wrap:wrap;
  }
  .logo{font-family:var(--mono);font-weight:600;font-size:.95rem;letter-spacing:-.02em}
  .logo b{color:var(--signal)}
  .live{
    font-family:var(--mono);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
    color:var(--live);display:flex;align-items:center;gap:.42em;
  }
  .pulse{width:6px;height:6px;border-radius:50%;background:var(--live);animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
  @media (prefers-reduced-motion:reduce){.pulse{animation:none}}
  .clock{margin-left:auto;font-family:var(--mono);font-size:.72rem;color:var(--dim);font-variant-numeric:tabular-nums}

  /* ---- sarlavha bloki ---- */
  .hero{max-width:1080px;margin:0 auto;padding:2.4rem 1.1rem 1.4rem}
  .kicker{
    font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
    color:var(--faint);margin-bottom:1rem;display:flex;gap:1.1rem;flex-wrap:wrap;
  }
  .kicker .on{color:var(--signal)}
  .lead{
    display:grid;grid-template-columns:minmax(0,1fr) 15rem;gap:2rem;align-items:start;
    border:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));
    padding:1.6rem;border-left:3px solid var(--signal);
  }
  .lead h1{
    font-size:clamp(1.65rem,3.6vw,2.5rem);line-height:1.12;letter-spacing:-.028em;
    font-weight:700;margin:0 0 .7rem;text-wrap:balance;
  }
  .lead h1 a:hover{color:var(--signal)}
  .lead p{margin:0;color:var(--dim);font-size:1.02rem;max-width:54ch}
  .lead-side{
    display:flex;flex-direction:column;gap:.75rem;font-family:var(--mono);font-size:.72rem;
    border-left:1px solid var(--line);padding-left:1.2rem;
  }
  .lead-side div{display:flex;flex-direction:column;gap:.15rem}
  .lead-side span:first-child{color:var(--faint);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase}
  .lead-side span:last-child{color:var(--fg)}

  /* ---- oqim ---- */
  .feed{max-width:1080px;margin:0 auto;padding:0 1.1rem 4rem}
  .feed-head{
    display:flex;align-items:center;gap:.9rem;margin:2.6rem 0 .4rem;
    font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);
  }
  .feed-head::after{content:"";flex:1;height:1px;background:var(--line)}

  .row{
    display:grid;grid-template-columns:5.2rem minmax(0,1fr);gap:1.4rem;
    padding:1.15rem 0 1.15rem .9rem;border-top:1px solid var(--line);
    border-left:2px solid transparent;transition:border-color .15s,background .15s;
  }
  .row:hover{background:var(--panel);border-left-color:var(--line)}
  .row.imp-5{border-left-color:var(--signal)}
  .row.imp-4{border-left-color:#8A4433}
  .row-time{font-family:var(--mono);display:flex;flex-direction:column;gap:.1rem;padding-top:.15rem}
  .row-time .t{font-size:.86rem;color:var(--cool);font-variant-numeric:tabular-nums}
  .row-time .d{font-size:.66rem;color:var(--faint)}
  .row-body{min-width:0;display:flex;flex-direction:column;gap:.35rem}
  .row h3{margin:0;font-size:1.06rem;line-height:1.35;font-weight:600;letter-spacing:-.012em}
  .row h3 a:hover{color:var(--signal)}
  .row p{margin:0;color:var(--dim);font-size:.93rem;max-width:68ch}
  .row-meta{
    display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.25rem;
    font-family:var(--mono);font-size:.65rem;letter-spacing:.03em;
  }
  .src{color:var(--fg);background:var(--panel2);border:1px solid var(--line);padding:.12rem .45rem}
  .cov{color:var(--cool)}
  .tag{color:var(--faint);border:1px dashed var(--line);padding:.12rem .4rem}
  .host{color:var(--faint);margin-left:auto}

  .note{
    margin:2.4rem 0 0;padding:1rem 1.1rem;border:1px dashed var(--line);
    font-family:var(--mono);font-size:.72rem;color:var(--faint);line-height:1.7;
  }
  .note b{color:var(--dim);font-weight:500}

  footer{border-top:1px solid var(--line);margin-top:3rem;padding:1.4rem 0 0}
  footer .f{
    max-width:1080px;margin:0 auto;padding:0 1.1rem;display:flex;flex-wrap:wrap;gap:1.4rem;
    font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);
  }

  @media (max-width:760px){
    .lead{grid-template-columns:1fr;gap:1.2rem;padding:1.2rem}
    .lead-side{border-left:0;border-top:1px solid var(--line);padding:1rem 0 0;flex-direction:row;flex-wrap:wrap;gap:1.4rem}
    .row{grid-template-columns:1fr;gap:.5rem;padding-left:.7rem}
    .row-time{flex-direction:row;gap:.6rem;align-items:baseline}
    .host{margin-left:0}
  }
</style>
</head>
<body>

<div class="bar">
  <div class="bar-in">
    <span class="logo">ai<b>.</b>lenta</span>
    <span class="live"><span class="pulse"></span>jonli</span>
    <span class="clock">Toshkent ${now.hhmm}</span>
  </div>
</div>

<div class="hero">
  <div class="kicker">
    <span>Sun'iy intellekt yangiliklari, o'zbekcha</span>
    <span class="on">Har 3 soatda yangilanadi</span>
    <span>${posts.length} ta xabar</span>
  </div>

  <div class="lead">
    <div>
      <h1><a href="${esc(lead.source.url)}" target="_blank" rel="noopener">${esc(lead.title)}</a></h1>
      <p>${esc(lead.summary)}</p>
    </div>
    <div class="lead-side">
      <div><span>Manba</span><span>${esc(lead.source.name)}</span></div>
      <div><span>Qamrov</span><span>${lead.coverage} ta nashr</span></div>
      <div><span>Vaqt</span><span>${ago(lead.published)}</span></div>
    </div>
  </div>
</div>

<div class="feed">
  <div class="feed-head">Oqim</div>
  ${rest.map(row).join("")}

  <p class="note">
    <b>Bu sahifa avtomat to'ldiriladi.</b> Xabarlar ochiq manbalardan yig'iladi, xulosalar sun'iy
    intellekt yordamida o'zbekchada yoziladi va har birida asl manbaga havola turadi.
    Tahlil va sharh maqolalari qo'lda yoziladi va alohida belgilanadi.
  </p>
</div>

<footer>
  <div class="f">
    <span>ai.lenta</span>
    <span>${now.day}-${now.month}, ${new Date().getUTCFullYear()}</span>
    <span>Manbalar: ${[...new Set(posts.map((p) => p.source.name))].length} ta nashr</span>
  </div>
</footer>

</body>
</html>`;
}
