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
| `collect.mjs` | 50 ta RSS/Atom feed (jumladan Xitoy, Yevropa va O'zbekiston nashrlari), Hacker News API va Google News so'rovlaridan xabar oladi. Oxirgi 72 soat bilan cheklanadi, birja shovqinini bloklaydi. | `data/raw.json` |
| `filter.mjs` | Ko'rilganlarni tashlaydi, AI'ga aloqasini baholaydi, bir voqea haqidagi turli xabarlarni bitta klasterga yig'adi (IDF vektor + markazga bog'lash), muhimini tanlaydi. | `data/clusters.json` |
| `write.mjs` | Har klaster uchun LLM'dan o'zbekcha sarlavha va xulosa oladi. Xulosadagi raqamlar manba matnida borligini tekshiradi. | `data/posts.json`, `data/seen.json` |
| `build.mjs` | `posts.json`dan butun saytni quradi: sahifalar, sitemap, RSS, qidiruv indeksi, llms.txt. | `docs/` |

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

## Takrorni to'xtatish — uch qavat

Bir voqea ikki marta chiqib ketmasligi eng qiyin qism bo'ldi. Uchta to'siq bor:

1. **Havola** — ko'rilgan URL boshqa chiqmaydi (`data/seen.json`).
2. **Sarlavha** — voqea chiqqanda uning *barcha* nashrlaridagi inglizcha
   sarlavhalar eslab qolinadi; keyingi klaster shular bilan solishtiriladi.
3. **Ma'no** — modelga oxirgi 40 ta chiqqan o'zbekcha sarlavha ko'rsatiladi va
   voqea ro'yxatda bo'lsa u `skip` qaytaradi.
4. **O'zbekcha matn** — nashrdan oldin sarlavha va xulosa chiqib bo'lganlari
   bilan solishtiriladi (`src/similar.mjs`). Sarlavha alohida tekshiriladi:
   bir voqeaning ikki xil xulosasi chegaradan o'tib ketishi mumkin, sarlavhalari
   esa baribir o'xshab qoladi.

Uchinchisi shart: nashrlar bir voqeani shunchalik boshqacha yozadiki, so'z
solishtirish ushlamaydi. Angliya banki rahbarining bitta chiqishi uch xil
sarlavha bilan chiqib ketdi — o'xshashlik 0.32 va 0.46 bo'lgan, chegara esa 0.45.

Chiqib bo'lgan takrorlarni tozalash uchun:

```bash
node src/dedupe-posts.mjs          # nimani o'chirishini ko'rsatadi
node src/dedupe-posts.mjs --apply  # o'chiradi
```

## Sayt tuzilishi

| Manzil | Nima |
| --- | --- |
| `/` | Bosh sahifa — so'nggi 60 ta xabar, kun bo'yicha ajratilgan |
| `/x/<slug>/` | Bitta xabar: xulosa, manba havolasi, boshqa nashrlar, shu mavzudagilar |
| `/mavzu/<teg>/` | Mavzu sahifasi (1 ta xabarlisi `noindex`) |
| `/kun/<sana>/` | O'sha kunning barcha xabari |
| `/arxiv/`, `/mavzular/` | Kunlar va mavzular ro'yxati |
| `/sitemap.xml`, `/rss.xml` | Qidiruv tizimlari va o'quvchilar uchun |

Har bir sahifada JSON-LD (`NewsArticle`, `ItemList`, `BreadcrumbList`,
`CollectionPage`), canonical, Open Graph va GoatCounter kodi bor.
`src/indexnow.mjs` yangi manzillarni Bing va Yandex'ga darhol bildiradi
(kalit fayli `docs/<kalit>.txt` — **o'chirmang**, bu egalik isboti).

## Rasmlar

Ikki qatlam: haqiqiy suratlar va kod bilan chizilgan muqovalar.

### Haqiqiy suratlar

**Boshqa nashrlarning surati olinmaydi.** CNBC yoki TechCrunch'dagi suratlar
ularning mulki (ko'pincha Getty yoki matbuot xizmatidan, litsenziya bilan);
ko'chirib chiqarish mualliflik huquqini buzadi.

O'rniga **Wikimedia Commons** — erkin litsenziyali, qonuniy va tekin. Sharti
muallif va litsenziyani ko'rsatish: har suratning tagida yozuv bor,
`/rasmlar/` sahifasi hammasini bir joyga yig'adi.

Fayllar `assets/photos.json` da **qo'lda** tanlangan. Avtomatik qidiruv
sinovdan o'tmadi: MediaTek so'ralganda Bundesarchiv arxividagi aloqasiz
suratni, AMD so'ralganda AQSh armiyasi askarlarini qaytardi. Xabar yonidagi
noto'g'ri surat suratsizlikdan yomonroq.

```bash
node src/photos.mjs     # suratlarni yuklab olish va qamrovni ko'rish
```

Hozir 59 xabardan 41 tasida haqiqiy surat bor. Qolganlari chizilgan muqovada.

### Chizilgan muqovalar

**Sun'iy intellekt bilan yaratilmaydi** — hammasi kod bilan chiziladi:

| Bo'lak | Nima qiladi |
| --- | --- |
| `templates/marks.mjs` | Brend belgisi, 23 ta mavzu rangi, 17 ta qo'lda chizilgan piktogramma |
| `src/cover.mjs` | Muqova (1200×630) va lentadagi kichik rasm |
| `src/images.mjs` | PNG chizish (`@resvg/resvg-js`), favicon, kanal logotipi |

Rasm tarkibi: mavzudan kelib chiqqan rang, mavzu piktogrammasi (qalqon =
xavfsizlik, bolg'a = sud, chip = chiplar...) va xabar identifikatoridan hosil
bo'ladigan geometrik naqsh. Bir xil xabar har doim bir xil rasm beradi.

Kompaniya logotiplari ishlatilmadi: Simple Icons to'plamida OpenAI, Microsoft,
Amazon, Salesforce va IBM yo'q (brendlar so'rovi bilan olib tashlangan), ya'ni
eng ko'p yozadigan kompaniyalarimiz rasmsiz qolardi.

Shriftlar (`assets/fonts/`) repo ichida turadi — natija mahalliy kompyuterda
ham, GitHub Actions ichida ham bir xil chiqadi.

## Telegram

`src/telegram.mjs` shu yugurishda saytga chiqqan xabarlarni kanalga yuboradi
(`data/last-run.json` dan oladi, `data/telegram-sent.json` bilan takrorlamaydi).
Ikkita secret kerak: `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID`. Ular bo'lmasa
qadam jimgina o'tkazib yuboriladi.

Muhimlik 4+ bo'lgan xabarlar darhol chiqadi, qolganlari ertalab 09:00 dagi
dayjestga (`src/digest.mjs`). Rasm **havola bilan emas, fayl bo'lib** yuboriladi:
bu qadam saytga chiqishdan oldin ishlaydi va havola hali mavjud bo'lmaydi.

## Instagram

`src/instagram.mjs` muhim xabarlarni (4+) Instagram tasmasiga joylaydi.
Rasm alohida chiziladi: 1080×1350 (4:5), JPEG — `docs/ig/<slug>.jpg`.

**Telegramdan muhim farqi:** Telegramga rasmni fayl bo'lib yuborsak bo'ladi,
Instagram esa faqat HAVOLA qabul qiladi va rasmni o'zi yuklab oladi. Shuning
uchun bu qadam sayt chiqqandan keyin turadi va rasm ochilishini o'zi kutadi.

Ikkita secret kerak: `IG_USER_ID` va `IG_ACCESS_TOKEN`. Ular bo'lmasa qadam
jimgina o'tkazib yuboriladi.

Akkaunt tomonidagi shartlar (bir martalik):

1. Instagram akkaunti **professional** (Business yoki Creator) bo'lishi
2. Facebook sahifasiga ulangan bo'lishi
3. `developers.facebook.com` da ilova yaratilishi va
   `instagram_business_content_publish` ruxsati olinishi
4. Uzoq muddatli token olinishi — u **60 kun** ishlaydi, keyin yangilash kerak

Chegara: sutkasiga 100 ta post. Bizniki kuniga 8-10 ta.

## Domenni ko'chirish

Manzil bitta joyda — `templates/shell.mjs` dagi `SITE.url`. Canonical, og:url,
sitemap, RSS va muqova rasmidagi yozuv hammasi o'shandan olinadi.

```bash
node src/set-domain.mjs ailenta.uz
node src/build.mjs && node src/audit.mjs
```

Skript avval DNS haqiqatan GitHub Pages'ga qarab turganini tekshiradi —
noto'g'ri ulangan domenga ko'chsak sayt butunlay ochilmay qoladi.

Kerakli A yozuvlari: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
`185.199.111.153`.

Diqqat: GitHub Pages bitta repoga bitta domen beradi — ko'chgach eski manzil
ishlamay qoladi.

## Jonli

- Sayt: https://ai.maqsudjon.com
- Repo: https://github.com/maqsudjon-cell/ailenta
- Ish oqimi har 3 soatda o'zi ishlaydi; qo'lda: Actions → Lenta → Run workflow

## Audit

```bash
node src/audit.mjs
```

Har bir sahifada meta teglar, canonical, JSON-LD, `h1` soni, ichki havolalar,
sitemap mosligi va sahifa vaznini tekshiradi. CI'da har yugurishda ishlaydi,
lekin nashrni to'xtatmaydi (`continue-on-error`) — kosmetik xato tufayli
yangilik chiqmay qolmasligi kerak.

Nimalarni tutadi: takrorlangan sarlavha va tavsif, 60 belgidan uzun sarlavha,
155 belgidan uzun tavsif, bo'sh joyga olib boradigan ichki havola, sitemapda
bor-u sahifasi yo'q manzil, buzuq JSON-LD, `h1` yo'qligi yoki bir nechtaligi.

## Bepul tarif chegarasi

Gemini bepul tarifida kunlik so'rov chegarasi bor va u **har bir model uchun
alohida** hisoblanadi. Chegara tugasa `write.mjs` keyingi modelga o'tadi:
`gemini-3.5-flash` → `gemini-2.5-flash` → `gemini-flash-latest`. Aks holda
o'sha yugurishdagi xabarlar butunlay yo'qolardi.

## Yordamchi skriptlar

| Skript | Vazifasi | Qachon ishlaydi |
| --- | --- | --- |
| `watchdog.mjs` | 6 soatdan beri yangi xabar bo'lmasa xato qaytaradi — GitHub egaga xat yuboradi | har yugurishda, oxirida |
| `photo-pool.mjs` | Commons kategoriyalaridan surat havzasini yig'adi | qo'lda, kerak bo'lganda |
| `digest.mjs` | Kunlik dayjestni Telegramga yuboradi | kechqurun |
| `indexnow.mjs` | Bing va Yandex'ga yangi manzillarni bildiradi | har yugurishda |
| `set-domain.mjs` | Saytni yangi domenga ko'chiradi | qo'lda |

## Ma'lumot fayllari

| Fayl | Nima uchun |
| --- | --- |
| `assets/nomlar.json` | Ismlar lug'ati — LLM chiqarishini yagona shaklga keltiradi (Sem Altman → Sam Altman) |
| `assets/atamalar.json` | AI atamalari o'zbekcha izohi; `/lugat/` sahifasi va promptda ishlatiladi |
| `assets/photos.json` | Qo'lda tanlangan suratlar va Commons kategoriyalari |
| `assets/photo-pool.json` | Kategoriyalardan yig'ilgan surat havzasi |

## Sozlamalar

Muhim qiymatlar env orqali o'zgartiriladi, kodga tegmasdan:

| O'zgaruvchi | Standart | Nima |
| --- | --- | --- |
| `TELEGRAM_TOP_PER_DAY` | 5 | kuniga nechta alohida post |
| `TELEGRAM_TOP_GAP_MIN` | 150 | postlar orasidagi eng kam oraliq |
| `WRITE_BATCH` | 14 | bir LLM so'roviga nechta klaster |
| `PHOTO_MIN_GAP` | 60 | surat necha xabar oralab takrorlanishi mumkin |
| `WATCHDOG_HOURS` | 6 | nazorat chegarasi |

## Hozircha yo'q

- Qo'lda yoziladigan tahlil maqolalari
- Kompaniya sahifalari (`/kompaniya/openai/`)
- O'zbekcha AI lug'ati
- Haftalik xulosa
