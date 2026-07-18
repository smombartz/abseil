// Abseil · Behance — popup view.
//
// Same shape and UX as the Pinterest view (a thin control/status surface over a
// declared content script + service worker that survive the popup closing). It
// shares the gallery-downloader panel styles (.gal*) defined in popup.css.
"use strict";

// Matches the content_scripts host in manifest.json. On any non-behance page the
// shell falls through to the Fonts fallback.
const BEHANCE_HOST = /(^|\.)behance\.net$/i;

const VIEW_HTML = `
  <div class="gal">
    <div class="gal-hero card">
      <div class="gal-hero-title">Behance project</div>
      <div class="gal-hero-sub">
        Download every image in this project at full resolution. Related
        projects, “more by” thumbnails, and avatars are skipped.
      </div>
    </div>
    <div class="gal-actions">
      <button id="bh-start" class="btn btn-primary gal-btn"
              title="Scroll the project and download every image at full resolution">Download this project</button>
      <button id="bh-stop" class="btn gal-btn" hidden aria-label="Stop downloading this project">Stop</button>
    </div>
    <div id="bh-status" class="gal-status" role="status" aria-live="polite"></div>
  </div>
`;

function mount({ view, tab }) {
  view.innerHTML = VIEW_HTML;

  const startBtn = view.querySelector("#bh-start");
  const stopBtn = view.querySelector("#bh-stop");
  const statusEl = view.querySelector("#bh-status");

  function render(state) {
    if (!state) return;
    const phase = state.phase || "idle";
    const busy = phase === "collecting" || phase === "downloading";

    if (state.message) statusEl.textContent = state.message;
    statusEl.classList.toggle("busy", busy);
    statusEl.classList.toggle("done", phase === "done");

    startBtn.disabled = busy;
    startBtn.textContent = busy ? "Working…" : "Download this project";
    stopBtn.hidden = !busy;
  }

  // Show current state on open, then live-update from background broadcasts.
  chrome.runtime
    .sendMessage({ module: "behance", type: "getState" })
    .then(render)
    .catch(() => {});

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.module === "behance" && msg.type === "state") render(msg.state);
  });

  startBtn.addEventListener("click", async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { module: "behance", type: "start" });
      statusEl.textContent = "Starting… keep this tab open.";
      statusEl.classList.add("busy");
      startBtn.disabled = true;
      startBtn.textContent = "Working…";
      stopBtn.hidden = false;
    } catch {
      statusEl.textContent =
        "Couldn’t reach this Behance page. Reload the tab and try again.";
      statusEl.classList.remove("busy");
    }
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ module: "behance", type: "cancel" }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { module: "behance", type: "cancel" }).catch(() => {});
  });
}

export default {
  id: "behance",
  label: "Behance",
  match: ({ host }) => BEHANCE_HOST.test(host || ""),
  mount,
};
