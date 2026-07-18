// Abseil — popup shell.
//
// Figures out which capability fits the active tab, paints the right module
// badge, and hands the view over to that module. Each module renders its own UI
// into #view (and may add controls to the header's #barActions slot).
"use strict";

import { MODULES } from "./modules/registry.js";

const badgeEl = document.getElementById("moduleBadge");
const barActionsEl = document.getElementById("barActions");
const viewEl = document.getElementById("view");
const bootStatusEl = document.getElementById("bootStatus");

// Pages where no extension can inject or read — show a friendly note instead of
// silently failing. Mirrors the guard Font Abseil used before the merge.
function restrictedReason(url, host, path) {
  if (
    /^(chrome|edge|brave|opera|vivaldi|about|chrome-extension|moz-extension|devtools|view-source):/i.test(
      url
    )
  ) {
    return "Abseil can’t read browser pages.<br>Open a normal website and try again.";
  }
  const isWebStore =
    host === "chromewebstore.google.com" ||
    (host === "chrome.google.com" && /^\/webstore/.test(path));
  if (isWebStore) {
    return "Abseil can’t run on the Chrome Web Store.<br>Open a normal website and try again.";
  }
  return null;
}

function showBoot(html) {
  if (!bootStatusEl.isConnected) viewEl.appendChild(bootStatusEl);
  bootStatusEl.innerHTML = html;
  bootStatusEl.hidden = false;
}

async function main() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    /* ignore */
  }
  if (!tab || !tab.id) {
    showBoot("Couldn’t find the active tab.");
    return;
  }

  const url = tab.url || "";
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    /* not a parseable URL */
  }

  const blocked = restrictedReason(url, host, path);
  if (blocked) {
    showBoot(blocked);
    return;
  }

  const ctx = { url, host, path };
  const matches = (m) => {
    try {
      return m.match(ctx);
    } catch {
      return false;
    }
  };
  // Specific tools win; the fallback (Fonts) only runs when nothing else claims
  // the page, so a catch-all can't shadow a more specific module.
  const mod =
    MODULES.filter((m) => !m.fallback).find(matches) ||
    MODULES.find((m) => m.fallback && matches(m));
  if (!mod) {
    showBoot(
      "Abseil has nothing to grab here.<br><span style='color:var(--muted);font-size:11px'>Open a normal website (for fonts), a Pinterest board, or a Behance project (for images).</span>"
    );
    return;
  }

  // Hand the cleared view to the module.
  bootStatusEl.hidden = true;
  viewEl.innerHTML = "";
  barActionsEl.innerHTML = "";
  badgeEl.textContent = mod.label;
  badgeEl.hidden = false;

  try {
    mod.mount({ view: viewEl, barActions: barActionsEl, badge: badgeEl, tab, url, host, path });
  } catch (e) {
    showBoot(
      "Something went wrong starting this tool.<br><span style='color:var(--muted);font-size:11px'>" +
        (e && e.message ? e.message : "Unknown error") +
        "</span>"
    );
  }
}

main();
