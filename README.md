# AI Lenta

Sun'iy intellekt yangiliklarini ochiq manbalardan yig'ib, o'zbekchada saytga
chiqaradigan avtomat quvur. Server kerak emas — hamma narsa GitHub Actions
ustida ishlaydi va GitHub Pages'ga chiqadi.

## Quvur

```
collect.mjs  →  filter.mjs  →  write.mjs  →  build.mjs
   yig'ish       saralash       yozish       qurish
```

| Bosqich | Nima qiladi | Chiqishi |
| --- | --- | --- |
| `collect.mjs` | 19 ta RSS/Atom feed, Hacker News API va Google News so'rovlaridan xabar oladi. Oxirgi 72 soat bilan cheklanadi, birja shovqinini bloklaydi. | `data/raw.json` |
| `filter.mjs` | Ko'rilganlarni tashlaydi, AI'ga aloqasini baholaydi, bir voqea haqidagi turli xabarlarni bitta klasterga yig'adi (IDF vektor + markazga bog'lash), muhimini tanlaydi. | `data/clusters.json` |
| `write.mjs` | Har klaster uchun LLM'dan o'zbekcha sarlavha va xulosa oladi. Xulosadagi raqamlar manba matnida borligini tekshiradi. | `data/posts.json`, `data/seen.json` |
| `build.mjs` | `posts.json`dan statik HTML quradi. | `site/<dizayn>/index.html` |

## Ishga tushirish

```bash
node src/collect.mjs && node src/filter.mjs && node src/write.mjs && node src/build.mjs
```

`write.mjs` uchun kalit kerak:

```bash
export GEMINI_API_KEY=...        # standart provayder
# yoki
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=...
```

GitHub'da kalit `Settings → Secrets and variables → Actions` ichiga qo'yiladi.
Provayderni almashtirish uchun `AI_PROVIDER` degan repository variable yetarli —
kodga tegish shart emas.

## Dizaynlar

**Tanlangan: `katta.mjs`** — oq maydon, yirik tipografiya, yorug'/to'q rejim.

Unda har bir vizual belgi ma'lumot tashiydi:

| Belgi | Nimani bildiradi |
| --- | --- |
| Sarlavha o'lchami | Xabar muhimligi (uch daraja) |
| Qamrov chizig'i | Nechta nashr bu voqea haqida yozgani |
| Chapdagi vaqt | Toshkent bo'yicha e'lon vaqti |
| Kun ajratgichi | Bugun / Kecha / sana |
| Manba qutisi | Nashr nomi; havola bilvosita bo'lsa yonida belgisi |

`templates/` ichida solishtirish uchun qurilgan yana ikkitasi turibdi
(`lenta.mjs` — to'q fon, jonli oqim; `gazeta.mjs` — bosma gazeta terishi).
Ular endi kerak emas, o'chirsa bo'ladi.

```bash
node src/build.mjs lenta      # bittasini qurish
node src/compare.mjs          # uchalasini taqqoslash sahifasi
```

Sahifani Artifact sifatida chiqarish uchun:

```bash
node src/to-artifact.mjs katta /yo'l/sahifa.html
```

## Qoidalar

Bular kodga kiritilgan, shunchaki niyat emas:

1. Xulosa faqat manba matnidan yoziladi — model o'zidan fakt qo'shmaydi.
2. Xulosadagi har bir raqam manba matnida borligi tekshiriladi, bo'lmasa xabar chiqmaydi
   (`numbersAreGrounded`).
3. Har bir xabarda manba nomi va havolasi ko'rinadi.
4. Reuters, WSJ va Bloomberg'da ochiq RSS yo'q — ular Google News orqali topiladi.
   Bunday havolalar "Google News orqali" deb belgilanadi, yashirilmaydi.
5. Manba rasmlari olinmaydi.
6. Aimastava kanali va sayti manba sifatida ishlatilmaydi.

## Hozircha yo'q

- `write.mjs` haqiqiy kalit bilan hali sinovdan o'tmagan (`data/posts.json` ni
  vaqtincha `src/seed-posts.mjs` to'ldirgan — kalit ulangach u fayl o'chiriladi)
- Alohida xabar sahifalari, teglar, kompaniya sahifalari
- Kunlik dayjest va Telegram bot
- RSS, sitemap, JSON-LD
