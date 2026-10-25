# Abseil

Project-specific context and rules for Claude. `CLAUDE.md` imports this file and holds the general
rules shared by every project; where the two disagree, this file wins.

## Project Overview

Abseil — one Chrome (Manifest V3) extension that pulls assets out of the current page. The popup shows the right tool for where you are. Unpacked extension, no build step; `./dev-browser.sh` launches Chrome for Testing with it loaded. See README.md.

**Key Features:**
- Pinterest board → download every pin at full resolution
- Behance project → download every project image at full resolution
- Any other site → Fonts tab (list/download woff2, woff, ttf, otf, eot) and Images tab (thumbnails, open or download)
- Pluggable capability modules in `modules/` (registered in `modules/registry.js`)
