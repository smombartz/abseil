# Abseil 🧗

One Chrome (Manifest V3) extension that rappels into the current page and brings
back what you need. Click the toolbar icon and Abseil shows the right tool for
where you are:

- **Pinterest board** → download every pin at full resolution.
- **Behance project** → download every image in the project at full resolution.
- **Any other website** → list and download the page's fonts (woff2, woff, ttf, otf, eot).

> *Abseil* = to descend on a rope. Abseil rappels down into a page, grabs what's
> worth keeping, and brings it back up.

It merges the former **Font Abseil** and **Pinterest Board Downloader** into a
single tool with one icon and one uniform UI — plus a **Behance** image
downloader — and is built to grow: adding a new capability is a drop-in.

## Install (unpacked / developer mode)

1. Open **`chrome://extensions`**.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this **`extension/`** folder.
4. Pin **Abseil** to the toolbar.

Works in Chrome, Edge, Brave, and other Chromium browsers.

## How it picks a tool

When you open the popup, the shell (`popup.js`) looks at the active tab's URL and
asks each registered module whether it handles this page. Specific tools are
tried first; **Fonts** is the `fallback` module, so it runs anywhere a more
specific tool doesn't claim the page. A small badge in the header shows which tool is
active. Browser-internal pages (`chrome://`, the Web Store, `view-source:`) show
a friendly "can't run here" note instead.

| Page | Tool shown | Downloads to |
|---|---|---|
| `*.pinterest.*` board | Pinterest | `Downloads/Abseil/Pinterest/<board>/` |
| `*.behance.net` project | Behance | `Downloads/Abseil/Behance/<project>/` |
| any other website | Fonts | `Downloads/Abseil/Fonts/` |

## Architecture

```
extension/
  manifest.json            MV3 manifest (action popup, content script, SW)
  popup.html / popup.css   shared shell + uniform "Abseil" dark theme
  popup.js                 shell: detect context, mount the right module view
  background.js            unified service worker; routes messages by module
  modules/
    registry.js            ordered list of modules (priority + fallback)
    fonts/
      view.js              popup UI (the universal fallback)
      collector.js         injected into each page frame; finds the fonts
      background.js        download handler
    pinterest/
      view.js              popup UI (start / stop / progress)
      content.js           declared content script; scrolls + harvests pins
      background.js        download handler (+ 736x fallback)
    behance/
      view.js              popup UI (start / stop / progress) — shares .gal* styles
      content.js           declared content script; scrolls + harvests images
      background.js        download handler (/source/ + displayed-rendition fallback)
  icons/                   toolbar icons (Font Abseil's icon, reused)
```

**Message protocol.** Every runtime message carries a `module` field
(`"fonts"` / `"pinterest"` / `"behance"`). `background.js` is a thin router that
dispatches to that module's `handle()`, so modules never collide on a `type`.
Two injection styles are used deliberately:

- **Fonts** injects `collector.js` on demand (`chrome.scripting.executeScript`)
  so it works on any site without a persistent footprint.
- **Pinterest** and **Behance** use *declared* content scripts, because
  harvesting a large board/project is a long-running, cancellable job that must
  keep running after the popup closes. They share the gallery-downloader UI
  (`.gal*` styles) and the same start/stop/progress shape.

### Adding a new capability (e.g. a Dribbble shot downloader)

1. Create `modules/dribbble/view.js` exporting the module shape:
   `export default { id, label, match({url, host, path}), mount({view, barActions, badge, tab, url, host, path}) }`.
   (For a gallery-style tool, copy `modules/behance/view.js` and swap the host
   regex, labels, and `module` id — it already uses the shared `.gal*` styles.)
2. If it needs page access, add either an injected collector
   (`chrome.scripting`, like Fonts) or a declared content script in
   `manifest.json` (like Pinterest/Behance), plus a `modules/dribbble/background.js`
   exporting `handle(msg, sender, sendResponse)`. Namespace every message with
   `module: "dribbble"`. If it tracks downloads, register its own
   `chrome.downloads.onChanged` listener but guard it on the download ids *it*
   created (as `behance/background.js` does) so module listeners don't collide.
3. Register it in `modules/registry.js` (add to `MODULES`) and in
   `background.js`'s `HANDLERS` table. Order doesn't matter for correctness:
   specific modules are tried before the single `{ fallback: true }` module
   (Fonts), so a catch-all can't shadow a specific tool.

No other file needs to change — the shell, theme, and router are module-agnostic.

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Inject the font collector into the page you're looking at, on demand. |
| `downloads` | Save the files you choose. |
| `host_permissions: <all_urls>` | Read `@font-face` rules from cross-origin frames/stylesheets, preview fonts, and (for Pinterest/Behance) read image grids. Nothing is sent anywhere — all processing is local. |

Abseil has no servers, no analytics, and no network calls of its own. It only
acts when you open the popup (or, on Pinterest/Behance, when you press **Download**).

## Notes & limitations

- **Fonts:** sizes show only for same-origin fonts and cross-origin fonts whose
  server sends `Timing-Allow-Origin` (many CDNs, incl. Google's, don't — the file
  still downloads). Live previews need the font server to permit the extension's
  cross-origin request.
- **Pinterest:** Pinterest changes its DOM regularly. If the popup reports "No
  pin grid found" on a valid board, check the selectors in `getBoardGrid()` in
  `modules/pinterest/content.js`. Keep the tab open (it needn't be focused) while
  large boards scroll. Add your country's Pinterest domain to **both** the
  manifest `content_scripts.matches` and `PINTEREST_HOST` in `view.js` if it's
  missing.
- **Behance:** works on **project (gallery) pages** — open
  `behance.net/gallery/<id>/<slug>` and press **Download this project**. Related
  projects, "more by" thumbnails, and avatars are skipped. Each image is fetched
  at `/source/` (the original upload) with the displayed rendition as a fallback.
  If Behance changes its CDN/DOM, the URL rewrite and selectors live in
  `modules/behance/content.js`.

For personal archiving — fonts and images belong to their creators.
```
