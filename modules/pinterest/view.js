// Abseil · Pinterest — popup view.
//
// Thin status/control surface over the long-running work that actually happens
// in the page (content.js, which scrolls + harvests) and the service worker
// (background.js, which downloads). Because both survive the popup closing, this
// view just kicks things off, then mirrors live state on each open.
"use strict";

// Matches the content_scripts host list in manifest.json. On a Pinterest TLD we
// don't cover, this returns false and the shell falls back to the Fonts tool —
// still useful, just no board download.
const PINTEREST_HOST =
  /(^|\.)pinterest\.(com|de|at|ch|fr|es|it|co\.uk|ca|com\.au|com\.mx|jp|se|dk|nz|ie|pt)$/i;

const VIEW_HTML = `
  <div class="gal">
    <div class="gal-hero card">
      <div class="gal-hero-title">Pinterest board</div>
      <div class="gal-hero-sub">
        Download every pin at full resolution. Avatars, UI images, and
        “more like this” suggestions are skipped.
      </div>
    </div>
    <div class="gal-actions">
      <button id="pt-start" class="btn btn-primary gal-btn"
              title="Scroll the board and download every pin at full resolution">Download this board</button>
      <button id="pt-stop" class="btn gal-btn" hidden aria-label="Stop downloading this board">Stop</button>
    </div>
    <div id="pt-status" class="gal-status" role="status" aria-live="polite"></div>
  </div>
`;

function mount({ view, tab }) {
  view.innerHTML = VIEW_HTML;

  const startBtn = view.querySelector("#pt-start");
  const stopBtn = view.querySelector("#pt-stop");
  const statusEl = view.querySelector("#pt-status");

  function render(state) {
    if (!state) return;
    const phase = state.phase || "idle";
    const busy = phase === "collecting" || phase === "downloading";

    if (state.message) statusEl.textContent = state.message;
    statusEl.classList.toggle("busy", busy);
    statusEl.classList.toggle("done", phase === "done");

    startBtn.disabled = busy;
    startBtn.textContent = busy ? "Working…" : "Download this board";
    stopBtn.hidden = !busy;
  }

  // Show current state on open, then live-update from background broadcasts.
  chrome.runtime
    .sendMessage({ module: "pinterest", type: "getState" })
    .then(render)
    .catch(() => {});

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.module === "pinterest" && msg.type === "state") render(msg.state);
  });

  startBtn.addEventListener("click", async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { module: "pinterest", type: "start" });
      statusEl.textContent = "Starting… keep this tab open.";
      statusEl.classList.add("busy");
      startBtn.disabled = true;
      startBtn.textContent = "Working…";
      stopBtn.hidden = false;
    } catch {
      statusEl.textContent =
        "Couldn’t reach this Pinterest page. Reload the tab and try again.";
      statusEl.classList.remove("busy");
    }
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ module: "pinterest", type: "cancel" }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { module: "pinterest", type: "cancel" }).catch(() => {});
  });
}

export default {
  id: "pinterest",
  label: "Pinterest",
  match: ({ host }) => PINTEREST_HOST.test(host || ""),
  mount,
};
