# Change log

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
