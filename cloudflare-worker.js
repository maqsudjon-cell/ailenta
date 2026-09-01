// cloudflare-worker.js — GitHub jadvali o'rniga ishonchli soat.
//
// GitHub Actions jadvalni kafolatlamaydi: 20-50 daqiqa kechiktiradi va
// vaqtlarning ko'pini tashlab yuboradi (o'lchandi: kuniga 8 tadan 3 tasi).
// Cloudflare'ning cron triggeri esa aniq ishlaydi va bepul tarifga kiradi.
//
// Bu Worker har uch soatda GitHub'ga so'rov yuborib, "Lenta" ish oqimini
// majburan boshlaydi.
//
// SOZLASH:
//   1. Cloudflare → Workers → yangi Worker, shu kodni qo'ying
//   2. Settings → Variables → Secret: GITHUB_TOKEN
//      (GitHub'da fine-grained token, faqat ailenta repozitoriyasiga,
//       faqat "Actions: write" huquqi bilan)
//   3. Settings → Triggers → Cron: 0 */3 * * *
//
// Token faqat Cloudflare secret'ida turadi, kodda emas.

const REPO = "maqsudjon-cell/ailenta";
const WORKFLOW = "lenta.yml";

async function dispatch(env) {
  if (!env.GITHUB_TOKEN) {
    return { ok: false, status: 0, text: "GITHUB_TOKEN secret qo'yilmagan" };
  }
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "ailenta-cron",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  // GitHub muvaffaqiyatda 204 qaytaradi va tanasi bo'sh bo'ladi.
  const text = res.ok ? "" : (await res.text()).slice(0, 300);
  return { ok: res.ok, status: res.status, text };
}

export default {
  // Cloudflare cron shu yerni chaqiradi.
  async scheduled(event, env, ctx) {
    const r = await dispatch(env);
    console.log(`dispatch ${r.status}${r.text ? " — " + r.text : ""}`);
  },

  // Brauzerdan ochilganda holatni ko'rsatadi; ?run=1 bilan qo'lda ishga tushadi.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("run") === "1") {
      const r = await dispatch(env);
      return new Response(
        r.ok ? "ishga tushirildi" : `xato ${r.status}: ${r.text}`,
        { status: r.ok ? 200 : 500, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response(
      `ailenta cron\nrepo: ${REPO}\nish oqimi: ${WORKFLOW}\n` +
      `token: ${env.GITHUB_TOKEN ? "qo'yilgan" : "QO'YILMAGAN"}\n\n` +
      `qo'lda sinash: ?run=1`,
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  },
};
