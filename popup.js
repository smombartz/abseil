// Abseil — popup shell.
//
// Figures out which capability fits the active tab, paints the right module
// badge, and hands the view over to that module. Each module renders its own UI
// into #view (and may add controls to the header's #barActions slot).
"use strict";

import { MODULES } from "./modules/registry.js";

const badgeEl = document.getElementById("moduleBadge");
const tabsEl = document.getElementById("moduleTabs");
const barActionsEl = document.getElementById("barActions");
const viewEl = document.getElementById("view");
const bootStatusEl = document.getElementById("bootStatus");

// Remembers the last page-tool tab (Fonts / Images) across popup opens.
const TAB_KEY = "abseil:pageTab";

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
  // Specific tools win; the fallback page tools (Fonts, Images) only run when
  // nothing else claims the page, so a catch-all can't shadow a specific module.
  const specific = MODULES.filter((m) => !m.fallback).find(matches);
  const mods = specific ? [specific] : MODULES.filter((m) => m.fallback && matches(m));
  if (!mods.length) {
    showBoot(
      "Abseil has nothing to grab here.<br><span style='color:var(--muted);font-size:11px'>Open a normal website (for fonts and images), a Pinterest board, or a Behance project.</span>"
    );
    return;
  }

  bootStatusEl.hidden = true;
  viewEl.innerHTML = "";
  barActionsEl.innerHTML = "";
  const base = { tab, url, host, path };

  if (mods.length === 1) {
    badgeEl.textContent = mods[0].label;
    badgeEl.hidden = false;
    mountInto(mods[0], viewEl, barActionsEl, base);
    return;
  }
  mountTabs(mods, base);
}

// Mount a module into its own view + header-action containers, reporting a
// startup error inside that view instead of blanking the popup.
function mountInto(mod, view, barActions, base) {
  try {
    mod.mount({ ...base, view, barActions, badge: badgeEl });
  } catch (e) {
    view.innerHTML =
      "<div class='status'>Something went wrong starting this tool.<br><span style='color:var(--muted);font-size:11px'>" +
      (e && e.message ? e.message : "Unknown error") +
      "</span></div>";
  }
}

// Several page tools share the page: show them as header pills that act like
// tabs. Each tool gets its own pane + header-action slot, mounted lazily on
// first visit and kept alive after, so switching back doesn't rescan the page.
function mountTabs(mods, base) {
  const panes = new Map(); // id -> { pane, slot, btn }
  let saved = null;
  try {
    saved = localStorage.getItem(TAB_KEY);
  } catch {
    /* storage unavailable */
  }

  function select(id) {
    for (const [mid, p] of panes) {
      const on = mid === id;
      p.btn.setAttribute("aria-selected", String(on));
      p.btn.tabIndex = on ? 0 : -1;
      p.pane.hidden = !on;
      p.slot.hidden = !on;
      if (on && !p.mounted) {
        p.mounted = true;
        mountInto(p.mod, p.pane, p.slot, base);
      }
    }
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }

  for (const mod of mods) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "badge tab";
    btn.id = `tab-${mod.id}`;
    btn.textContent = mod.label;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", `pane-${mod.id}`);
    btn.addEventListener("click", () => select(mod.id));
    tabsEl.appendChild(btn);

    const pane = document.createElement("div");
    pane.className = "pane";
    pane.id = `pane-${mod.id}`;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", btn.id);
    pane.hidden = true;
    viewEl.appendChild(pane);

    const slot = document.createElement("div");
    slot.className = "bar-slot";
    slot.hidden = true;
    barActionsEl.appendChild(slot);

    panes.set(mod.id, { mod, btn, pane, slot, mounted: false });
  }

  // Arrow keys move between tabs, as in any tablist.
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const ids = mods.map((m) => m.id);
    const cur = ids.indexOf(document.activeElement && document.activeElement.id.replace(/^tab-/, ""));
    if (cur < 0) return;
    const next = ids[(cur + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
    select(next);
    panes.get(next).btn.focus();
    e.preventDefault();
  });

  tabsEl.hidden = false;
  select(panes.has(saved) ? saved : mods[0].id);
}

main();
