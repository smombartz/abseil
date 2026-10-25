# Change log

## 2026-10-25 - Rounded-corner toolbar icon

**Session:** `efa3023f-d1bc-4e82-a4ea-20de4bfc61f2`

**What Changed:**
- New `icons/icon-rounded.svg`: the `icon.svg` mark on a `#F06543` square with rounded corners (`rx="80"` on the 360 canvas, about 22%), corners transparent
- `icons/icon16/32/48/128.png` regenerated from it with `rsvg-convert` (now RGBA), so the Chrome toolbar and extensions page show the rounded icon
- `icon.svg` (the square Figma favicon) and the popup header are unchanged
- README file tree updated
- First tried a fully round (circle) icon, then switched to rounded corners at the user's request

**Why:**
- Requested: the extension icon in Chrome's toolbar should have rounded corners

**Files Modified:**
- `icons/icon-rounded.svg` (new)
- `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`
- `README.md`

---

## 2026-10-25 - New logo, icon and accent colour from Figma

**Session:** `efa3023f-d1bc-4e82-a4ea-20de4bfc61f2`

**What Changed:**
- `icon.svg` replaced with the new Figma favicon (node 2:53): white mark on a `#F06543` square. The Figma canvas background rect and layer ids were stripped
- New `logo.svg` from Figma (node 2:55): the standalone mark in black on a transparent background
- `icons/icon16/32/48/128.png` regenerated from `icon.svg` with `rsvg-convert`
- Popup header now shows `icon.svg` directly (sharp at any DPI) instead of `icons/icon32.png`
- Accent colour `--accent` changed from `#ff6a3d` to the new brand `#f06543`. The primary button hover is now `#f37b5e`
- README file tree updated for the new assets

**Why:**
- New brand identity designed in Figma (https://www.figma.com/design/oshCnKabNZES8GjDQWn0Mm/Abseil)

**Files Modified:**
- `icon.svg`
- `logo.svg` (new)
- `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`
- `popup.html`
- `popup.css`
- `README.md`

---

## 2026-10-25 - "Show in Finder" after downloads complete

**Session:** `67ca3a97-a9aa-4991-88be-90b7667e014e`

**What Changed:**
- New shared popup helper `modules/reveal.js`: `whenComplete(id)` watches a download until it is written to disk (or fails), `lastCompleted(ids)` does the same for a batch, and `showRevealButton()` inserts a "Show in Finder" button (labelled "Show in folder" off macOS) that calls `chrome.downloads.show()`
- Fonts: the button appears next to a file's Download button, next to the family "Download all" in the card heading, and next to the footer "Download all", once that download finishes. Batches reveal their last completed file (they all share one folder)
- Images: same for row downloads and the footer "Download all"
- Pinterest/Behance: the background state now carries `lastId` (last completed download). The view shows a full-width "Show in Finder" button when a run isn't active and at least one file completed
- Footer buttons now sit in a `.foot-actions` group so the extra button lines up beside "Download all"

**Why:**
- Feature request: jump straight to downloaded files instead of hunting through Downloads/Abseil

**Files Modified:**
- `modules/reveal.js` (new)
- `modules/fonts/view.js`
- `modules/images/view.js`
- `modules/pinterest/view.js`, `modules/pinterest/background.js`
- `modules/behance/view.js`, `modules/behance/background.js`
- `popup.css`
- `docs/log.md`

---

## 2026-10-25 - Fonts: real typeface name when the CSS family is an alias

**Session:** `86723d30-f1e1-43e8-a761-78c5a890cc99`

**What Changed:**
- New `nameFromFile()` guesses a typeface name from a font's filename: splits CamelCase/separators, drops weight/style words (Light, SemiBold, Italic, 400…), version tags, hashes and generic words (font, webfont, latin…), e.g. `FoundersGrotesk-Light.woff2` → "Founders Grotesk"
- New `displayName()` uses that guess as the card title only when the CSS family looks like an alias: 3 characters or fewer, or the guess's initials (`fg`). Google Fonts families and unparseable/hashed filenames keep the CSS name
- When the title differs, a muted "CSS name: fg" line sits under it (new `.fam-alias` style); families now sort by the shown name

**Why:**
- On veleyross.wedding the site's minified CSS declares `font-family: fg` / `c`, so Abseil showed "fg" and "c" instead of Founders Grotesk and Canela

**Files Modified:**
- `modules/fonts/view.js`
- `popup.css`
- `docs/log.md`

---

## 2026-10-25 - Fonts: per-family "Download all" button

**Session:** `67ca3a97-a9aa-4991-88be-90b7667e014e`

**What Changed:**
- Each font family card with more than one file now has a small "Download all" button in its heading, next to the used/declared tags
- It sends just that family's files to the existing `downloadAll` background handler, then shows "Saved N" (or "Saved N/M" if some failed) before resetting
- New `.btn-fam` style (compact, sized to sit with the tag pills); `.tags` now centres its items vertically

**Why:**
- Feature request: grab every weight/style/format of one family at once, without downloading the whole page's fonts

**Files Modified:**
- `modules/fonts/view.js`
- `popup.css`
- `docs/log.md`

---

## 2026-10-15 - CLAUDE.md split into general CLAUDE.md + PROJECT.md

**Session:** `f8fad04b-426f-4cf7-8c39-ee01d8036b49`

**What Changed:**
- New `PROJECT.md` holds the project-specific part of the old `CLAUDE.md`, verbatim: the Project Overview and Key Features
- `CLAUDE.md` replaced with the new general template, which imports `PROJECT.md` (`@PROJECT.md`); its Documentation, Plans, Verification and Logging rules replace the older wording of the same rules
- Dropped the empty "Current Project State" placeholder section

**Why:**
- General working rules and project context were mixed in one file. With the split, the general rules can be updated in every project by replacing `CLAUDE.md` whole, while project context stays in `PROJECT.md` (which wins where the two disagree)

**Files Modified:**
- `CLAUDE.md`
- `PROJECT.md` (new)
- `docs/log.md`

---

## 2026-09-27 - Logo and screenshots in README

**What Changed:**
- README now opens with the centred Abseil logo (`icon.svg`)
- Added a Screenshots section: a 2×2 grid of the real toolbar popup (Fonts, Images, Pinterest, Behance)
- Screenshots captured with a puppeteer-core script that opens each sample page in Chrome for Testing and triggers the popup via `chrome.action.openPopup()` (smashingmagazine.com, a Behance curated project, a Pinterest search)

**Why:**
- The GitHub repo page had no visuals

**Files Modified:**
- `README.md`
- `docs/screenshots/fonts.png`, `images.png`, `pinterest.png`, `behance.png` (new)

---

## 2026-09-27 - Images tab, Fonts origin info, README update

**What Changed:**
- New Images module (`modules/images/`): lists every image on the page with thumbnails; open or download each
- Popup shell shows multiple fallback modules (Fonts, Images) as header tabs with keyboard nav, lazy mounting and a remembered last tab
- Fonts collector re-fetches and parses cross-origin stylesheets (following `@import`), so Google Fonts, Typekit and similar families are detected
- Fonts view summarises where families are served from and adds a Google tag linking to the specimen page
- README updated to cover all of the above; added `dev-browser.sh` and `IDEAS.md`

**Why:**
- Feature work: image grabbing on any site, better font detection on CDN-hosted fonts

**Files Modified:**
- `modules/images/*`, `modules/registry.js`, `background.js`
- `popup.html`, `popup.css`, `popup.js`
- `modules/fonts/collector.js`, `modules/fonts/view.js`
- `README.md`, `dev-browser.sh`, `IDEAS.md`, `CLAUDE.md`, `docs/log.md`

---

## 2026-09-27 - Added CLAUDE.md and change log

**What Changed:**
- Added `CLAUDE.md` from the standard project boilerplate, with a short Abseil overview and feature list
- Added this `docs/log.md` change log

**Why:**
- Bring Abseil in line with the other projects' agent instructions and logging conventions

**Files Modified:**
- `CLAUDE.md`
- `docs/log.md`

---
