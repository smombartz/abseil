// Abseil — capability registry.
//
// The popup tries every SPECIFIC module first (registry order = priority among
// them), then falls back to the modules marked { fallback: true } — the generic
// "page tools" (Fonts, Images) that work on any http(s) page. Those are shown
// together as header tabs, in registry order. Flagging them this way means a
// catch-all can never accidentally shadow a specific tool, no matter the order.
//
// To add a capability (e.g. a Behance image downloader): create
// modules/<name>/view.js exporting the same shape ({ id, label, match, mount }),
// import it here, and add it to MODULES. If it needs to run on the page, add a
// matching background handler + (content script or injected collector). If it
// tracks downloads, guard its chrome.downloads.onChanged on its own id set (see
// pinterest/background.js) so module listeners don't step on each other.

import fonts from "./fonts/view.js";
import pinterest from "./pinterest/view.js";
import behance from "./behance/view.js";
import images from "./images/view.js";

export const MODULES = [pinterest, behance, fonts, images];

// At least one fallback must exist, or ordinary pages get nothing. Logs in dev;
// harmless in production.
console.assert(
  MODULES.some((m) => m.fallback),
  "registry: at least one module must be marked { fallback: true }"
);
