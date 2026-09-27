# Change log

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
