# Oyako Hotel — pitch demo site

A single-page, offline, rebrandable website used to pitch hotel companies on
booking-site work. It is a **demonstration**: prices, availability and reviews
are illustrative, nothing is really booked, and no payment is ever taken.

The demo hotel is **Oyako Hotel Limited** — "Oyako Hotel" is the brand shown in
the header and headlines, and the full legal name appears in the footer and the
legal line.

- **Open it** by double-clicking `index.html`. No server, no build step, no
  framework, no network connection. Everything is bundled in this folder.
- **To present it,** double-click `showcase.html` — the same site inside a phone
  frame and a desktop frame, with a Desktop / Mobile / Side by side toggle. See
  section 6.
- **Style:** direction B, "Ivory Champagne" (paper ground, hairline rules,
  champagne accent), with font pairing 1, Libre Baskerville + Inter.
- **Research behind it:** `research/README.md` — the reference sites, the
  single-page vs multi-page decision, the three style directions and the font
  comparison.

---

## 1. Files

| Path | What it is |
| --- | --- |
| `index.html` | The page shell. Section containers only — content is rendered from the settings file. |
| `site.config.js` | **The settings file.** All brand, content and pricing data. |
| `app.js` | Rendering, the fake-availability model, the gallery, the dialogs. |
| `styles.css` | All styling, including the bundled `@font-face` rules. |
| `showcase.html` | **Presentation view.** The live site in a phone frame and a desktop frame, with a Desktop / Mobile / Side by side toggle. |
| `export-single.mjs` | Builds `dist/oyako-hotel.html` — the whole site in one file. |
| `export-showcase.mjs` | Builds `dist/oyako-hotel-showcase.html` — the showcase in one file, with the site embedded once. |
| `dist/oyako-hotel.html` | Generated. The site file you send to a hotel. |
| `dist/oyako-hotel-showcase.html` | Generated. The showcase file you present from. |
| `deploy/` | Generated. **The main site only** — the folder you upload to a static host. The presentation showcase is deliberately not part of it. See `HOSTING.md`. |
| `tools/build-deploy.mjs` | Rebuilds `deploy/` from the source files. |
| `tools/make-image-variants.sh` | Rebuilds the 900-px image variants in `assets/img/small/` (macOS `sips`). |
| `tools/smoke-test.mjs` | Regression check: loads every deliverable over `file://` and `http://` in headless Chrome (and optionally WebKit) and fails on any broken behaviour. |
| `HOSTING.md` | Plain-language steps for putting the demo online. |
| `assets/img/` | 28 bundled photographs, plus a 900-px variant of each in `assets/img/small/` for phones. |
| `assets/fonts/` | Bundled `woff2` files. |
| `assets/CREDITS.md` | Where every photograph and typeface comes from, and its licence. |
| `screenshots/` | Proof screenshots at phone 390 and desktop 1440, plus the three showcase modes. |
| `research/` | Phase 1 research, style directions and font comparison. |

Requires JavaScript: the page renders itself from `site.config.js` so that
re-badging means editing one file. It still loads nothing from the network.

---

## 2. Re-badging for a new hotel

Everything except the photographs lives in `site.config.js`. There is no other
file to edit.

1. **Identity** — `brand`: `name` (header and headlines), `legalName` (footer and
   legal line), `wordmark`, `wordmarkSub`, `cityLine`, and `markSvg` (the logo).
   Any inline SVG works; it inherits `currentColor` and is sized by CSS.
2. **Colours and fonts** — `theme`. The values are applied as CSS custom
   properties at runtime, so changing them re-skins the whole site. `rule`,
   `paperAlt` and the three badge colour triples are worth adjusting too.
3. **Contact and the WhatsApp number** — `contact.whatsapp` is digits only with
   the country code and no plus sign (`2348012345678`). `whatsappMessage` is the
   text pre-filled into the chat. Every "Chat to book" button, every "Book" and
   "Join waitlist" link in the room cards, and the room dialogs all build their
   `https://wa.me/...` link from this one value.
4. **Rooms** — `rooms[]`. Each entry carries `name`, `size`, `bed`, `maxGuests`,
   `pricePerNight` (US dollars), `image`, `imageAlt`, `description`, plus two
   numbers that drive availability: `inventory` (how many of this type exist,
   which is what "Only 2 left" counts against) and `rarity` (0–1, how quickly
   this room sells out).
5. **Facilities, gallery, reviews, location, footer** — the other top-level keys.
   `dining.venues[]` and `wellness.facilities[]` each take a lead image plus an
   optional small image strip. `gallery.images[]` takes 14 entries; the first and
   sixth tiles are wider than the rest.
6. **Photographs** — replace the files in `assets/img/`, keeping the same
   filenames, **or** point the `image` fields at new filenames. Keep the longest
   side at or under 2000 px and save as compressed JPEG. Then update
   `assets/CREDITS.md`.
7. **Phone-sized variants** — run `sh tools/make-image-variants.sh`. It writes a
   900 px copy of every photograph into `assets/img/small/`, which is what a
   phone downloads instead of the full file. Skip it and the site still works:
   the browser falls back to the full-size image, just a heavier one.
8. **Fonts** — to swap typefaces, add the `woff2` files to `assets/fonts/`,
   replace the `@font-face` blocks at the top of `styles.css`, and set
   `theme.fontDisplay` / `theme.fontSans`. The bundled families are all SIL Open
   Font License, which permits commercial use and embedding.
9. **Re-export** — run `node export-single.mjs`, then re-take the proof
   screenshots if you need them (section 5).
10. **Check it** — `node research/tools/probe.mjs --url "file://$PWD/index.html"
   --w 390 --h 844 --mobile` should report `overflow=false` at 390, 768, 1024
   and 1440. `node tools/smoke-test.mjs` runs the full cross-engine check.

Content strings may contain inline markup — the hero headline uses `<em>` for the
accented words and the footer legal line uses `<em>` for the copyright symbol.

---

## 3. Fake availability

Availability is a pure function of the room, the dates and the party size, so it
never changes between reloads.

```
availability(room, checkIn, checkOut, guests)
```

- A guest count above `room.maxGuests` returns `small`, and the card offers no
  booking — it says the room sleeps that many and no more.
- Otherwise a 32-bit FNV-1a hash of `room.id|checkIn|checkOut|guests` decides the
  outcome, compared against a "pressure" figure built from `room.rarity`, the
  length of stay, the party size, and whether the stay starts on a Friday or
  Saturday. Pressure sells the room out; below it, a second hash derives how many
  remain, against `room.inventory`.
- Three badge states come out of that: **Available**, **Only N left** (N ≤ 2) and
  **Sold out**. Sold-out cards go grayscale and offer a WhatsApp waitlist link
  instead of a booking link.

The model is exposed as `window.OYAKO_CORE.availability` so it can be checked
from a console or a headless browser. With the shipped defaults — 14–17 November
2026 for 2 adults — the five tiers read Available, Sold out, Available, Only 2
left, Sold out, which is why those dates are the defaults.

The booking bar validates its own input: both dates required, check-out after
check-in, and stays capped at `booking.maxNights`. Pressing **Check availability**
re-renders the room list and reports how many types are open.

---

## 4. The single-file exports

```sh
node export-single.mjs      # dist/oyako-hotel.html          — the site
node export-showcase.mjs    # dist/oyako-hotel-showcase.html — the presentation
```

Run them in that order: the showcase reads the site file produced by the first.
Both scripts use Node built-ins only.

`export-single.mjs` inlines `styles.css`, `site.config.js`, `app.js`, all 34
referenced fonts and images as data URIs, and then verifies that nothing in the
result still points at a local file — failing the build if anything does. The
output is **about 11 MB**, which is what 7 MB of photography looks like once
base64-encoded. It opens by double-click from anywhere, needs no folder beside
it, and renders identically to the multi-file site.

`export-showcase.mjs` embeds that file **once**, as a single JavaScript string,
and fills both frames from it at runtime via `iframe.srcdoc` — two copies would
have doubled the download. It also carries only the settings fields the
presentation chrome reads (brand, theme, demo notice) rather than the whole
settings file, and it fails the build if the output still has a real reference
to a local photograph (`app.js` names `assets/img/small/` in a comment, which is
prose, not a reference).

The result is **about 11.3 MB**, barely more than the site alone.

`export-single.mjs` also sets `window.OYAKO_INLINED`, which tells `app.js` that
every photograph is already inline as a data URI. `app.js` skips the
`srcset`/`sizes` attributes there — a set of separate files would be meaningless
and would double the export — and uses them as normal in the folder site and in
`deploy/`.

Things worth knowing if you edit these scripts:

- Replacement strings must be passed as functions. A plain `String.replace` with
  a string expands `$'`, and `app.js` contains `'$'` in its currency formatter,
  which silently splices the rest of the document into the output.
- Local asset paths are matched *after* the scripts are inlined, so the images
  that `app.js` copies out of the settings file at runtime are inlined too.
  Doing that to the *showcase* is what caused its first build to be 22 MB: it
  rewrote the image paths inside the embedded settings file into data URIs and
  added a second copy of every photograph. `export-showcase.mjs` now inlines its
  own assets first and injects the settings and the site afterwards.
- A `</script` or `<!--` inside the embedded site would break the host document,
  so every `<` in that string is escaped as `\u003c`.

### Checking the deliverables

`tools/smoke-test.mjs` launches its own headless Chrome (never the one you
already have open) and loads `index.html`, `showcase.html`, both files in
`dist/` and the deployable site (`deploy/index.html`), over `file://` and over
`http://`. It fails on any console error, uncaught exception or failed request,
on a missing room card, availability badge, date picker or WhatsApp link, on a
date change that does not move the badges, on horizontal overflow, and on a
showcase frame whose "Loading the site" overlay is still up after the page
settles. For `deploy/index.html` it also sweeps phone, tablet and landscape
widths (360, 390, 430, 768 and 844×390) and fails on horizontal overflow, a
section nav that is cut off or points at a missing section, a tap target under
44 px, a section that cannot be reached by tapping its link, or a missing card,
badge, date field or WhatsApp button.

```sh
node clients/hotel-demo/tools/smoke-test.mjs            # Chrome, both schemes
```

The stuck-overlay check matters: the first showcase load bug only appeared in
Safari's engine, not Chrome. To run the same checks through WebKit, install
Playwright once and pass the paths:

```sh
npm i playwright && npx playwright install webkit
node clients/hotel-demo/tools/smoke-test.mjs --engine webkit
# or point at an existing install:
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers \
  node clients/hotel-demo/tools/smoke-test.mjs --engine webkit
```

Why the showcase loads its two frames one at a time, and why the framed site
posts a ready message back, is explained in section 6.

---

## 5. Proof screenshots

`screenshots/` holds, in each case, a stitched full-page capture and
viewport-sized shots of every section:

| | Files |
| --- | --- |
| Desktop 1440 × 900 | `desktop-1440-fullpage.jpg`, `desktop-1440-hero.jpg`, `-rooms`, `-dining`, `-wellness`, `-gallery`, `-reviews`, `-location`, `-footer` |
| Phone 390 × 844 | `phone-390-fullpage.jpg`, and the same eight sections |

Re-take them with:

```sh
node research/tools/capture-proof.mjs --mode fullpage --url "file://$PWD/index.html" \
  --out /tmp/proof --prefix desktop-1440 --w 1440 --h 900 --dpr 1
python3 research/tools/stitch-proof.py /tmp/proof/desktop-1440--chunks.json out.jpg --width 1200
```

Chrome's own full-page capture (`captureBeyondViewport`) returns a corrupted
composite on a 17 000 px phone page — the tail comes back showing the hero — so
`capture-proof.mjs` scrolls and captures the real viewport in chunks, and
`stitch-proof.py` joins them. For the stitched shot it neutralises
`position: sticky`, `position: fixed` and the scroll-reveal transitions, so the
page reads as one document rather than repeating the header in every chunk.
Section shots are left exactly as a visitor sees them.

The three showcase modes are captured the same way, at 1440 × 900, as
`showcase-1440-desktop.jpg`, `showcase-1440-mobile.jpg` and
`showcase-1440-side-by-side.jpg` — the page links its mode in the URL hash, so
they are a plain viewport capture of `showcase.html#desktop`, `#mobile` and
`#side`.

---

## 6. Presentation showcase

`showcase.html` is a presenter's view of the same site: the real page inside a
phone frame (a true 390 × 844 viewport) and inside a desktop frame (1440 × 900),
with a **Desktop / Mobile / Side by side** toggle at the top. It is a separate
file from the site — the site itself is untouched by it, and `index.html` is
still what you send to a hotel.

- **It is the live site, not screenshots.** Each frame is an `<iframe>` loading
  `index.html` at full size and then scaled to fit the stage, so the responsive
  layout, the date picker, the availability badges, the room dialogs, the gallery
  and the WhatsApp links all work inside the frames. Clicking the phone frame's
  *Rooms & Suites* navigation scrolls and re-renders it exactly as it does on a
  real phone.
- **Defaults.** Side by side from 1100 px wide, Mobile alone below that. The
  choice is remembered in the URL, so `showcase.html#desktop`, `#mobile` and
  `#side` open straight into a mode — handy when a slide links to it. Pressing
  <kbd>1</kbd>, <kbd>2</kbd> or <kbd>3</kbd> switches during a talk.
- **Offline.** Open it by double-clicking; it needs no server. For sending, use
  `dist/oyako-hotel-showcase.html`, which is the same page with the site
  embedded once.
- **Branding.** The name, palette and fonts come from `site.config.js`, so a
  re-badge carries into the showcase. Its own typefaces are declared in the page
  against the same bundled `woff2` files.
- **Loading the two frames.** They are filled one after the other rather than at
  the same time. Safari's engine could drop the `load` event of the second of
  two ~11 MB frames loaded together, which left the phone frame's "Loading the
  site" overlay up over a frame that was actually working. On top of that, the
  framed site posts `{oyako:'ready'}` to the showcase as soon as it has booted,
  and an 8-second fallback clears the overlay anyway, so no single browser quirk
  can leave a spinner over the site.

The browser chrome (traffic lights, URL pill, dimension labels) is decorative:
the URL reads `oyako-hotel.example`, the reserved documentation domain used
throughout the demo, so it cannot be mistaken for a live address. The frame
sizes are the only real numbers in it.

Screenshots of all three modes are in `screenshots/` as
`showcase-1440-desktop.jpg`, `showcase-1440-mobile.jpg` and
`showcase-1440-side-by-side.jpg`.

---

## 7. Hosting it for a pitch

The `deploy/` folder is a self-contained copy of **the main site only** —
`index.html` plus its config, styles, script and assets, with `robots.txt` and
`_headers`. It is ready to upload to any static host. The presentation showcase
(`showcase.html`) stays in the project and in `dist/`; it is a file you present
from, not part of what a hotel opens on a link.

The deployed site is fully responsive and tuned for a phone: the section nav
wraps so every section is visible and tappable, controls are at least 44 px,
the form fields are 16 px so iOS does not zoom on focus, below-the-fold images
lazy-load, and each photograph has a 900-px variant a phone uses instead of the
full file.

`HOSTING.md` walks through the free options — Netlify Drop, Cloudflare Pages
and GitHub Pages — with the exact clicks, what each one costs, which ones can
keep the link private, and which to pick. Nothing has been published; that
decision is the captain's.

`tools/build-deploy.mjs` rebuilds `deploy/` from the source files, so re-badging
another hotel means editing `site.config.js`, running the build again, and
re-uploading the folder.

---

## 8. What this is not

Out of scope by design: real booking, payments, and a backend. Hosting is
described in `HOSTING.md` but nothing is published from here. There is
no per-client version for any named real hotel — the demo is neutral and
re-badged per pitch. The location panel is a stylised diagram rather than a real
map: third-party map tiles cannot be bundled into an offline file, and the
OpenStreetMap tile servers refuse the request outright, so the diagram is drawn
in SVG and labelled as not to scale. A "Get directions" link opens the real map
when the viewer has a connection.
