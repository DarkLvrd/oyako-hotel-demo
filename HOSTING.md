# Hosting the Oyako Hotel demo

This is for putting the demo on the internet so a hotel can open a link instead
of a file. Nothing here has been done yet: **publishing is the captain's
decision**, and this document is only the how.

Everything you need to upload is already in one folder:

```
clients/hotel-demo/deploy/
```

That folder is built to be uploaded exactly as it is. It contains **the main
site only** — `index.html`, its settings/script/style, and an `assets/` folder
with the fonts and photographs. The presentation showcase (`showcase.html`) is
deliberately *not* in it: that is a file you present from on your own machine,
not something a hotel opens on the link. Every link inside the folder is
relative, so it works from any web address and from a subfolder. It also carries
a `robots.txt` and a "do not index" tag, because this is a private pitch demo
and should not turn up in Google.

The site is fully responsive: a hotel manager opening the link on a phone gets a
mobile layout with a wrapped section nav, thumb-sized controls and lighter
images, and a desktop browser gets the full layout.

To rebuild that folder after editing `site.config.js` (for example, to re-badge
for another hotel), run this once from `clients/hotel-demo/`:

```sh
node tools/build-deploy.mjs
```

## Which option to pick

| | Netlify Drop | Cloudflare Pages | GitHub Pages |
| --- | --- | --- | --- |
| Account needed | No, to start | Yes (free) | Yes (free) |
| Link stays alive | Yes once claimed | Yes | Yes |
| Custom domain | Yes | Yes | Yes |
| Private / password | Not on the free plan | Yes, with Cloudflare Access (free) | No — always public |
| Cost | Free | Free | Free |
| Effort | Lowest | Low | Highest (needs a repository) |

**My recommendation: Netlify Drop.** It is the fastest way to get the demo in
front of a hotel, it needs no account to begin, and the free tier is enough for
a pitch. If the hotel must be kept behind a login, use Cloudflare Pages with
Cloudflare Access instead — that is the only one of the three with real
protection on a free plan.

---

## Option A — Netlify Drop (recommended)

1. Open **https://app.netlify.com/drop** in your browser.
2. Open the `deploy` folder in Finder (in `clients/hotel-demo/deploy/`).
3. Drag the **deploy folder itself** onto the dashed drop area on the page.
4. Wait for the upload bar to finish. Netlify shows a link like
   `https://sunny-panda-123456.netlify.app` — that is the live site.
5. Click the link and check: the hotel name, the five room cards, the date
   picker and the *Chat to book* button should all be there. Open the same link
   on a phone as well — the layout, the wrapped section nav and the
   *Chat to book* button are all built for it.
6. **Claim the site so the link does not expire.** Click *Sign up* / *Log in*
   in the top right and create the free account. Then in *Team overview →
   Sites*, find the dropped site and choose **Claim site**. Once it is on your
   account it stays live. Until it is claimed, treat the link as temporary.

Notes: the free plan gives you a `netlify.app` address and HTTPS. A custom
domain (like `demo.youragency.com`) is free to add, but you must own the domain
and change its DNS records. A shared site **password** is a paid feature on
Netlify.

## Option B — Cloudflare Pages with direct upload

1. Create a free account at **https://dash.cloudflare.com/sign-up**.
2. In the left sidebar choose **Workers & Pages**, then **Create**, then the
   **Pages** tab, then **Upload assets**.
3. Give the project a name, for example `oyako-hotel-demo`.
4. Drag the **deploy folder** into the upload box, or click *select from your
   computer* and choose it. Click **Deploy site**.
5. Cloudflare gives you `https://oyako-hotel-demo.pages.dev`.
6. **To keep it private**, in the sidebar choose **Zero Trust → Access →
   Applications**, add a new *Self-hosted* application for the `pages.dev`
   address, and create a policy that allows only the email addresses that should
   see it. Visitors then get a one-time code by email instead of a password.
   This is free for a small number of users, but it is more steps than it looks.

Notes: free, HTTPS included, custom domains supported. "Password protection"
here means Cloudflare's email login, not a single shared password. Uploading a
new version means running the build again and uploading the folder again.

## Option C — GitHub Pages

Choose this only if the demo belongs in a repository anyway.

1. Create a free account at **https://github.com** and make a new **public**
   repository, for example `oyako-hotel-demo`. (On the free plan Pages only
   publishes from a public repository, so the files are readable by anyone.)
2. Upload the **contents of the deploy folder** (not the folder itself) to the
   repository — GitHub's web upload accepts a folder by dragging it in.
3. Open the repository's **Settings → Pages**. Under *Build and deployment*,
   set *Source* to **Deploy from a branch**, branch **main**, folder **/ (root)**,
   and click **Save**.
4. Wait a minute or two. The address appears at the top of the same settings
   page: `https://yourname.github.io/oyako-hotel-demo/`.
5. To update it later, upload the changed files again.

Notes: free and stable, custom domains supported. **There is no way to make a
GitHub Pages site private** — anyone with the link can open it, and search
engines can index it (the `noindex` tag in the pages asks them not to).

---

## Two things to remember

- **The photo credits must stay with the site.** `assets/CREDITS.md` lists where
  every photograph and typeface came from and its licence. It is already inside
  the `deploy` folder. Do not delete it, and do not remove it from the folder
  before uploading — that is what keeps the free stock photos properly
  attributed.
- **Re-badging means rebuilding.** Edit `site.config.js` (and swap the images in
  `assets/img/` if needed), run `node tools/build-deploy.mjs`, then upload the
  `deploy` folder again. Nothing else changes.
