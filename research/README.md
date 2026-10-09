# Oyako Hotel demo — Phase 1 research

Research for a single-file, offline, rebrandable luxury hotel demo site for
**Oyako Hotel Limited** (brand shown as "Oyako Hotel", Lagos).

Read this together with:

- `screenshots/` — reference captures of real five-star hotel sites.
- `directions/` — three concrete style directions, each as a hero mockup and a
  rooms mockup, with the HTML source and desktop + phone screenshots.
- `fonts/` — three candidate font pairings rendered on every direction hero, plus
  a rooms page each, with the generated comparison pages in `fonts/build/`.
- `../assets/CREDITS.md` — where the placeholder photography and fonts come from.

The decision this phase exists to produce is recorded at the bottom.

---

## 1. How the reference screenshots were made

Headless Google Chrome 154 driven over the DevTools protocol by two small
dependency-free Node scripts (no npm packages), kept in `tools/`:

| Tool | What it does |
| --- | --- |
| `tools/shot.mjs` | Full-page screenshot at a chosen viewport. Scrolls the page to trigger lazy content, hides cookie/consent overlays, nudges autoplay video into frame, and warns on horizontal overflow. |
| `tools/probe.mjs` | Reports `document.scrollWidth` vs viewport width and lists any element sticking out past the viewport. Used to prove there is no horizontal overflow at 390 / 768 / 1024 / 1440. |
| `tools/probe-fonts.mjs` | Reports the typefaces a page really renders with: every declared `@font-face`, the computed stack per role, and whether the intended face actually loaded. This is how section 6 checked what the reference hotels use. |
| `tools/compress-shots.py` | Downscales and slices the raw captures into the committed JPEGs (needs Pillow). |
| `tools/fetch-fonts.mjs` | Downloads the candidate font pairings and writes `assets/fonts/fonts-pairings.css`. |
| `tools/make-font-comparison.mjs` | Generates the font-comparison variants in `research/fonts/build/` by swapping only the two families in each direction page. |

```sh
node tools/shot.mjs  --url <url> --out shot.png --w 1440 --h 900 --full
node tools/shot.mjs  --url <url> --out shot.png --mobile --w 390 --h 844 --full --max-h 20000
node probe.mjs       --url <url> --w 390 --h 844 --mobile
python3 tools/compress-shots.py <raw-dir> <out-dir> 1100 480 1400 64
```

**Never attach to a running desktop Chrome.** Each script spawns its own
headless instance on a random debug port with a throwaway profile and kills it
on exit.

### Dimensions

| | Viewport | Device pixel ratio | Full page |
| --- | --- | --- | --- |
| Desktop | 1440 × 900 | 1 | 1440 px wide, 900 – 9 979 px tall |
| Phone | 390 × 844 | 2 (780 px) for the iPhone-UA captures | 390 – 780 px wide, up to 28 000 px tall |

### Why the committed files are JPEGs, not the raw PNGs

The raw captures were 44 PNGs totalling **175 MB** (individual files 0.4 – 10.7 MB).
That is not something a pitch repository should carry, so the committed
references are downscaled and sliced:

- desktop → 1100 px wide; phone → downscaled to 480 px wide, except the four
  captures made at DPR 1 (Mandarin Oriental, Ritz Paris home), which stay at
  their native 390 px;
- pages taller than 1400 px are cut into vertical tiles of 1400 px, numbered from
  the top: `09-wheatbaker-lagos-rooms-phone--p01of09.jpg`;
- pages that fit in one tile keep a plain name with no `--pNN` suffix
  (for example `06-ritz-paris-home-desktop.jpg`);
- JPEG, progressive, quality 64 – 66.

The committed set is **231 files / 16 MB**. Original PNGs are deliberately not in
git; re-running `shot.mjs` regenerates them.

### Limits worth knowing before you trust a shot

- `mandarinoriental.com`, `ritzparis.com` and `thewheatbakerlagos.com` render
  inside a scroll-jacked shell, so those home captures stop after the first
  screen. They still document the hero, navigation and booking bar.
- Aman's and Burj Al Arab's *accommodation* URLs redirect back to the hotel
  landing page in a headless browser, so those two `rooms` sets repeat the home
  screenshot. The room-card pattern is instead covered by Rosewood, Four
  Seasons, Peninsula, Raffles, Mandarin Oriental, Ritz Paris, The Silo, The
  Wheatbaker and The Lagos Continental.
- `06-ritz-paris-rooms-phone` is a 28 000 px page — an unusually long, scroll-heavy
  layout; treat its later tiles as representative of repetition, not of detail.

---

## 2. Sites captured

Braced numbers are committed as `screenshots/NN-slug-page-viewport…`.

| # | Hotel / group | Home | Rooms & suites | Why it is in the set |
| --- | --- | --- | --- | --- |
| 01 | Aman | <https://www.aman.com/> | `/resorts/aman-tokyo/accommodation` | The extreme of restraint: near-white space, tiny tracked wordmark, almost no chrome. |
| 02 | Four Seasons | <https://www.fourseasons.com/> | `/london/accommodations/` | Cinematic dark hero with the booking bar laid straight over it; the reference for a "film still + reservations" opening. |
| 03 | Rosewood | <https://www.rosewoodhotels.com/> | `/en/hong-kong/accommodation` | Best room-card pattern of the set: photo, letter-spaced room name, spec line, one solid + one ghost button. |
| 04 | Mandarin Oriental | <https://www.mandarinoriental.com/> | `/en/hong-kong/victoria-harbour/stay` | Cleanest luxury grid; proof that a light palette can still read as expensive. |
| 05 | The Peninsula | <https://www.peninsula.com/> | `/en/hong-kong/hotel-rooms/rooms-and-suites` | Full-bleed city hero with a *white* booking bar docked under it, then a "book direct" reassurance line. |
| 06 | Ritz Paris | <https://www.ritzparis.com/> | `/hotel/paris` | The heritage/editorial end of the spectrum: quiet type, gold accents, gallery pacing. |
| 07 | Burj Al Arab (Jumeirah) | <https://www.jumeirah.com/en/stay/dubai/burj-al-arab-jumeirah> | `/rooms-and-suites` | Ivory-and-gold centred layout with a mosaic image grid; how much ornament a demo can carry. |
| 08 | Raffles | <https://www.raffles.com/> | `/singapore/suites/` | Overlay booking bar with icon field labels, plus a sticky header that appears on scroll with a "Check rates" CTA. |
| 09 | The Wheatbaker, Lagos | <https://thewheatbakerlagos.com/> | `/luxury-hotel-rooms/` | Local benchmark for the Lagos market the pitch is aimed at. |
| 10 | The Lagos Continental | <https://www.thelagoscontinental.com/> | `/rooms-suites/king-club-room` | Second Lagos benchmark; a big business hotel, usefully un-luxurious to compare against. |
| 11 | The Silo, Cape Town | <https://www.theroyalportfolio.com/the-silo-hotel/> | `/accommodation/rooms/` | African five-star that is closer to international standard — the realistic ambition level. |

None of the eleven blocked headless capture; every URL returned a usable render.

---

## 3. What the best sites share

### Palette — neutral ground, one accent, colour comes from the photographs

Not one of the eight international sites uses a saturated brand colour in its
layout. They pick either a warm off-white (Ritz, Burj Al Arab, Mandarin,
Rosewood) or a near-black (Aman, Four Seasons, Raffles, Peninsula's hero), and
put a single metallic or earth accent on top: gold, bronze or clay, used almost
exclusively for the primary button and small eyebrow text. Photographs supply all
the remaining colour.

### Type — a serif for display, a tracked sans for everything small

Two families, doing clearly different jobs:

- **Display:** a serif set very large with tight leading, and — contrary to the
  stereotype — at **regular or medium weight**, not a hairline light cut. Probe
  the sites and you get Lyon Text 400 at Aman, Bressay 400 at Burj Al Arab,
  Baskerville URW 400 at The Silo, Engravers Gothic Bold at Rosewood and Futura PT
  Medium at Mandarin Oriental; only Raffles' Canela Thin at 250 is a hairline.
  One word of the headline is often italicised. Section 6 has the full reading.
- **Utility:** a neutral sans, uppercase, with heavy letter-spacing (0.16 – 0.34 em)
  at 9 – 11 px, for navigation, field labels, eyebrows, badges and buttons.

Type does the luxury signalling; there is no decoration.

### Imagery — one idea per screen, cinematic grade, huge negative space

Full-bleed photography, muted and slightly desaturated, usually warm or blue-hour.
Screens hold one image and let it breathe; the section after it is often just a
line of serif text on empty ground. Video loops are common (Aman, Four Seasons,
Peninsula, Raffles). Nothing is decorated with borders or shadows.

### Navigation — five or six words, one call to action

Top-level items stay at five or six (`Stay`, `Rooms & Suites`, `Dining`, `Spa`,
`Gallery`), uppercase and widely tracked. The only thing that ever looks like a
button is a single `Reserve` / `Check Rates` in the top right; several sites hide
everything else behind a `Menu` label. Language and login sit furthest right and
smallest.

### Rooms & suites — image, name, spec line, one sentence, two actions

The pattern is remarkably consistent, and it is the thing this demo has to get
right:

1. one dominant photograph per room;
2. the room name as small letter-spaced serif caps;
3. a compact spec line — size, bed configuration, occupancy
   ("570 ft² (53 m²) · 1 king (or 2 twins) · Up to 3 guests");
4. one or two sentences of description, never more;
5. a solid `Reserve` / `Book` plus an outlined `Details`;
6. and — the surprise — **almost never a price**. Rates are hidden behind the
   booking flow. Where a number appears it is a "From" figure on the hero
   (Burj Al Arab, Raffles' `CHECK RATES`), not on the room card.

Two columns on desktop, one on phone, with the card's photo and text aligned to a
shared baseline grid.

### Booking — a three-or-four-field bar, docked or overlaid, with a reassurance line

Every site puts the same widget high on the page: check-in, check-out, guests,
sometimes a promotional code, and one accent-coloured submit. It sits either
overlaid on the bottom of the hero (Four Seasons, Raffles) or docked immediately
below it, full width (Peninsula). Directly underneath there is usually one line
of small text doing the selling: "Book direct for the best rates and offers…".
Default dates are always a near-future pair a few nights apart.

### Motion and restraint

Fades and slow parallax only. Nothing bounces, nothing blinks, no carousel dots.
Whitespace is the main tool, and the page is comfortable being mostly empty.

### Where the Lagos benchmarks differ

The Wheatbaker and The Lagos Continental are competent but template-shaped:
heavier colour, busier hero, price-first copy, weaker photography, and grids that
fill every pixel. The opportunity for this pitch is precisely the gap between
those and the international set — the same information, staged with restraint.
The Silo sits between the two and is the most realistic target.

---

## 4. Decision — one page, not a multi-page site

**Decision: one HTML document, sectioned, with in-page anchor navigation.**
Rooms are a section of that page, not a separate page; "Details" reveals content
in place rather than navigating.

Reasons, in the order they mattered:

1. **The no-build, double-click, offline rule makes a single document the only
   clean answer.** Every page must open by double-clicking a file with no server.
   With one document there is no routing to fake, no relative-path breakage when
   the folder is moved, and no risk that the sent-to-the-hotel single file shows
   a viewer only part of the site.
2. **The single-file export is a stated deliverable, and it is trivially correct
   for one page.** Inlining CSS, JS and images into one HTML file gives a
   complete site. For a multi-page site the same export would have to reimplement
   navigation as toggled sections — that is the single-page design, done later
   and worse.
3. **This is a pitch, not a website a guest books on.** The hotel is briefed in a
   meeting: one continuous scroll shows the hero, the rate ladder, the facilities
   and the reviews in a single gesture. Five pages makes the reviewer click, lose
   the thread, and form an opinion from whichever page they happened to open.
4. **The styling that carries the "five-star" signal lives on the landing page.**
   Real luxury sites are, in practice, one long home page plus deep detail pages,
   and the home page is where every decision in section 3 above is visible. For
   an MVP the home page *is* the product.
5. **Re-badging has to stay a ten-minute job.** One settings file feeding one
   document means one place to change and one artefact to re-export. With
   sibling pages, each new client risks leaving a page half-rebranded.
6. **QA cost.** One page at four widths plus phone/desktop proof shots is
   tractable; every layout fix otherwise multiplies across pages and viewports.

Consequences accepted:

- A sticky header with anchor links becomes the site's navigation
  (`Stay`, `Rooms & Suites`, `Dining`, `Spa`, `Gallery`, `Contact`).
- Sections: hero + booking bar, rooms & suites (five tiers), dining and bar, spa
  and gym, gallery, guest reviews, location and map, footer with the full legal
  name "Oyako Hotel Limited".
- Every section is deep-linkable through its `#id`, so the page can be opened
  mid-scroll from a slide or a WhatsApp message.

---

## 5. Three style directions

Each direction is a real, working static mockup — not a description. Every one
has a hero page (navigation, headline, booking bar) and a rooms page (the five
tiers with availability badges and prices), and both were screenshotted at
desktop 1440 × 900 and phone 390 × 844 and checked for horizontal overflow at
390 / 768 / 1024 / 1440.

All three share the same content, the same bundled fonts (Cormorant Garamond +
Jost, the pair that has since been rejected — see section 6) and the same
placeholder photography, so the comparison isolates style rather than content.
The typeface choice is a separate decision, compared in section 6.

### Direction A — Midnight Bronze

**[`directions/a-hero-desktop.jpg`](directions/a-hero-desktop.jpg)** ·
[`a-hero-phone.jpg`](directions/a-hero-phone.jpg) ·
[`a-rooms-desktop.jpg`](directions/a-rooms-desktop.jpg) ·
[`a-rooms-phone.jpg`](directions/a-rooms-phone.jpg) ·
[HTML source](directions/a-hero.html)

- **Palette:** ink black `#0B0B0C`, warm bone type `#F2EDE4`, bronze `#C8A464`.
- **Type:** Cormorant serif at display size with an italic accent word; Jost in
  wide-tracked uppercase for everything small.
- **Hero:** a full-bleed night-skyline photograph at 52 % brightness behind a
  vertical gradient, with the booking bar floating over it as a translucent
  bronze-bordered panel.
- **Rooms:** a single-column rate list — one room per row, photo left, spec and
  one sentence centre, price and availability badge right, solid bronze
  `Book this room`.
- **If it wins:** reads as the most obviously expensive option, hides the CTAs'
  smallness behind contrast, and the bronze-on-black pairing is the safest bet
  for a hotel that wants to look international rather than local.
- **Risk:** dark sites photograph badly in a slide deck projector and can look
  heavy on a phone in daylight; the rate list is long, so the five tiers need
  about four phone screens of scrolling.

### Direction B — Ivory Champagne

**[`directions/b-hero-desktop.jpg`](directions/b-hero-desktop.jpg)** ·
[`b-hero-phone.jpg`](directions/b-hero-phone.jpg) ·
[`b-rooms-desktop.jpg`](directions/b-rooms-desktop.jpg) ·
[`b-rooms-phone.jpg`](directions/b-rooms-phone.jpg) ·
[HTML source](directions/b-hero.html)

- **Palette:** paper `#FAF8F4`, ink `#1E1B17`, champagne bronze `#9C7B4A`,
  hairline rules `#E6DFD3`.
- **Type:** same two families, but the serif is used at book-page sizes and the
  utility sans never exceeds a whisper.
- **Hero:** an asymmetric split — copy on the left, the lobby photograph filling
  the right half — with the booking fields in a white hairline card and a
  full-width ink `Check availability` row.
- **Rooms:** a two-column editorial card grid with generous gutters; coloured
  availability badges (green / amber / grey), solid `Book` plus outlined
  `Details`, and a grayscale photograph on the sold-out tier.
- **If it wins:** closest to Ritz Paris and Mandarin Oriental, prints and
  projects well, and the light ground makes the rooms grid feel calm rather than
  long. It is the direction that most obviously looks like a real hotel site.
- **Risk:** without genuine, well-lit photography the light palette exposes weak
  images; it is also the least "Lagos" of the three.

### Direction C — Lagos Nocturne

**[`directions/c-hero-desktop.jpg`](directions/c-hero-desktop.jpg)** ·
[`c-hero-phone.jpg`](directions/c-hero-phone.jpg) ·
[`c-rooms-desktop.jpg`](directions/c-rooms-desktop.jpg) ·
[`c-rooms-phone.jpg`](directions/c-rooms-phone.jpg) ·
[HTML source](directions/c-hero.html)

- **Palette:** lagoon ink `#0A1614`, terracotta `#D98A50`, bone `#F5EFE6`.
- **Type:** the serif is pushed hardest here — up to 102 px, with the city name
  itself as the italic accent — and the wordmark switches to letter-spaced
  geometric sans.
- **Hero:** the photograph is forced to duotone (grayscale plus a green tint
  multiplied over it), with a live "Tonight from $240 / Classic room, per night"
  rate panel overlaid on the image and a full-width terracotta booking bar.
- **Rooms:** rate-led cards — each card is a dark panel with a solid terracotta
  price rail on the right carrying `From`, the amount, the availability badge and
  the action; the sold-out tier drops to a muted slate rail with `Join waitlist`.
- **If it wins:** the only direction with a specific sense of place, the only one
  that puts price on the card (this is an MVP *for* pitching, and the brief asks
  for visible tiers), and the duotone treatment makes stock photography look
  deliberate and consistent.
- **Risk:** duotone is a strong stylistic bet; a hotel that wants its own imagery
  shown faithfully would have to drop that treatment, and the terracotta is the
  furthest from the neutral palette the international set favours.

> Two bugs were found by looking at these screenshots and fixed before committing:
> in Direction B the `Check availability` button wrapped out of its card (and, on
> phone, forced a 718 px-wide document inside a 390 px viewport), and in Direction
> C the `Sold out` badge was dark ink on a dark rail and effectively invisible.

---

## 6. Fonts

The first pair — Cormorant Garamond for headings, Jost for body — was rejected as
too thin and not professional enough for a hotel. Rather than guess at a
replacement, the reference sites were probed for the typefaces they actually
render with (`tools/probe-fonts.mjs`, reading computed styles and the CSSOM
`@font-face` rules rather than trusting the CSS source).

### What the reference hotels actually use

| Hotel | Display face as rendered | Weight / size | Sans |
| --- | --- | --- | --- |
| Aman | Lyon Text / Lyon Display (Commercial Type) | **400** at 31 px, 0.5 px tracking | Whitney SSm 400 at 14 px, 0.7 px tracking |
| Rosewood | Engravers Gothic Bold | **700** at 48 px, 4.8 px tracking | system sans |
| Mandarin Oriental | Futura PT Medium | **500** at 40 px | AvenirNext LT Pro 400 |
| Burj Al Arab | Bressay Display | **400** at 32 px | Avenir Next 400 |
| The Silo, Cape Town | Baskerville URW | **400** at 86 px | Gotham Light 300 |
| The Wheatbaker, Lagos | Edensor (custom) | 400 at 53 px | **Inter** 300 |
| The Lagos Continental | **Playfair Display** | 400 at 40 px | Poppins 200/400 |
| Raffles | Canela Thin | 250 at 56 px — the outlier | Lato Regular 400 |

Three things follow, and they are the brief for the replacements:

1. **Regular weight is the norm, not a light cut.** Lyon Text 400, Bressay 400,
   Baskerville 400, Edensor 400, Playfair 400 — one outlier (Raffles' Canela Thin
   at 250) against seven. The rejection of the original pair was well founded.
2. **Baskerville and Playfair are both attested** — Baskerville URW on The Silo at
   86 px for its h1, Playfair Display on The Lagos Continental, a direct Lagos
   competitor.
3. **The sans is a workhorse, not a display face.** Whitney SSm, AvenirNext,
   Avenir Next, Gotham, Lato — and **Inter**, on The Wheatbaker in Lagos. Small,
   high legibility, wide-tracked uppercase.

Four Seasons, The Peninsula and Ritz Paris served bot-protection pages to the
probe (`Access Denied`, a Cloudflare challenge, and "Accès non autorisé"), so they
contributed no reading.

### The three candidate pairings

All six families are free and OSI-compatible: SIL Open Font License 1.1 via
Google Fonts, bundled locally in `assets/fonts/`, recorded in
[`../assets/CREDITS.md`](../assets/CREDITS.md). Nothing is fetched at view time.

The comparison isolates type and nothing else: `tools/make-font-comparison.mjs`
copies each direction page and swaps only the two family names, so layout,
palette and photography are byte-identical across variants. All variants were
captured at 1440 × 900, checked for horizontal overflow, and each font was
verified to have genuinely loaded rather than silently fallen back.

#### Pairing 1 — Libre Baskerville + Inter — "Baskerville classic"

[`fonts/a-hero-p1.jpg`](fonts/a-hero-p1.jpg) ·
[`b-hero-p1.jpg`](fonts/b-hero-p1.jpg) ·
[`c-hero-p1.jpg`](fonts/c-hero-p1.jpg) ·
[`b-rooms-p1.jpg`](fonts/b-rooms-p1.jpg)

A Baskerville — the same genre The Silo Hotel sets its 86 px h1 in — with a real
400 italic. Wide, upright, moderate contrast, no hairline strokes, generous
x-height. Body and labels in Inter, which is not a guess: The Wheatbaker in Lagos
runs its body text in Inter at 300.

*Fits because* it is the sturdiest of the three at every size, it survives being
projected in a meeting room, and it is the pairing a hotelier is most likely to
read as "established" rather than "fashion".

#### Pairing 2 — Playfair Display + Source Sans 3 — "Editorial contrast"

[`fonts/a-hero-p2.jpg`](fonts/a-hero-p2.jpg) ·
[`b-hero-p2.jpg`](fonts/b-hero-p2.jpg) ·
[`c-hero-p2.jpg`](fonts/c-hero-p2.jpg) ·
[`b-rooms-p2.jpg`](fonts/b-rooms-p2.jpg)

Playfair Display, which is what The Lagos Continental already uses for its
headings, so it is a known quantity in this market. Noticeably higher stroke
contrast than pairing 1, with a calligraphic italic that is the most decorative of
the three. Body in Source Sans 3, Adobe's neutral humanist sans.

*Fits because* it has the most editorial, magazine-like presence and the most
elegant italic, and the price figures sit beautifully in it. It is the closest to
the high-contrast look hotels reach for.

#### Pairing 3 — Marcellus + Work Sans — "Inscriptional"

[`fonts/a-hero-p3.jpg`](fonts/a-hero-p3.jpg) ·
[`b-hero-p3.jpg`](fonts/b-hero-p3.jpg) ·
[`c-hero-p3.jpg`](fonts/c-hero-p3.jpg) ·
[`b-rooms-p3.jpg`](fonts/b-rooms-p3.jpg)

Marcellus is a Roman inscriptional face — the register of Rosewood's Engravers
Gothic Bold and Burj Al Arab's Bressay Display. Low contrast, flared serifs, one
weight only, and **no italic at all**: where it is used the headline italics are
switched off rather than synthesised, so the accent word is carried by colour
alone. Body in Work Sans.

*Fits because* it is the most distinctively "hotel" of the three — it reads like
signage over a porte-cochère — and it removes italics entirely, which is where the
original pair was weakest.

### Recommendation

**Pairing 1, Libre Baskerville + Inter.** It answers the feedback most directly:
the serif is sturdy at 400, italics are real rather than faked, and the sans is
more legible than Jost at the 9 – 14 px sizes the booking bar, nav, badges and
spec lines live at. Both choices are attested in the reference set, one of them on
a Lagos competitor. It is also the least risky in a slide deck or on a projector,
and luxury-hotel type is a conservative genre where the safest strong choice
usually wins.

Pairing 2 is the pick if the direction chosen is A or C and you want more drama;
pairing 3 is the pick if you want the site to feel unmistakably like a hotel and
are happy to give up italics.

> The direction mockups in `research/directions/` still render in the original
> Cormorant + Jost pair, so the screenshots there remain an honest record of what
> was reviewed. The chosen pairing is applied in Phase 2.

---

## 7. What happened next

The decision came back as **direction B (Ivory Champagne) with font pairing 1
(Libre Baskerville + Inter)**, and Phase 2 was built against it — see
[`../README.md`](../README.md) for the site itself and the re-badge checklist.

What the directions in section 5 were used for, and what changed on the way:

- The site is one page, sectioned, as decided in section 4. It became a single
document rendered from `site.config.js`, with the room ladder, dining, spa and
gym, gallery, reviews and the location panel as anchor sections.
- The direction-B mockups here still render in the original Cormorant + Jost
pair, so these screenshots remain an honest record of what was reviewed. The
shipped site uses pairing 1.
- Two things the mockups did not cover had to be solved during the build: the
locator map (section 5 assumed a map; bundled map tiles turned out to be
impossible — see `../README.md` section 6) and the empty half-row left by five
room tiers in a two-column grid.
