// Abseil · Behance — background handler.
// Receives the collected image list from the content script and downloads each
// file via chrome.downloads into Downloads/Abseil/Behance/<project>/.
// Each image carries a primary /source/ URL plus the displayed-rendition URL as
// a fallback; if /source/ is interrupted (missing for some older modules) we
// retry once with the fallback.

const DOWNLOAD_DELAY = 150; // ms between queued downloads

const state = {
  phase: "idle",
  message: "Open a Behance project, then hit download.",
  done: 0,
  failed: 0,
  total: 0,
};
let cancelled = false;
// downloadId -> { fallbackUrl, filename, retried }
const tracked = new Map();

function broadcast() {
  chrome.runtime.sendMessage({ module: "behance", type: "state", state }).catch(() => {});
}

async function downloadAll(project, images) {
  cancelled = false;
  state.phase = "downloading";
  state.total = images.length;
  state.done = 0;
  state.failed = 0;
  state.message = `Downloading 0/${images.length}…`;
  broadcast();

  for (const img of images) {
    if (cancelled) break;
    const name = (img.key || "").split("/").pop() || "image";
    const filename = `Abseil/Behance/${project}/${name}`;
    try {
      const id = await chrome.downloads.download({ url: img.url, filename, conflictAction: "uniquify" });
      tracked.set(id, {
        fallbackUrl: img.fallbackUrl && img.fallbackUrl !== img.url ? img.fallbackUrl : "",
        filename,
        retried: false,
      });
    } catch {
      state.failed += 1;
      broadcast();
    }
    await new Promise((r) => setTimeout(r, DOWNLOAD_DELAY));
  }

  if (cancelled) {
    state.phase = "idle";
    state.message = `Stopped after queueing ${state.done + state.failed} files.`;
    broadcast();
  }
}

function checkFinished() {
  if (state.phase === "downloading" && state.done + state.failed >= state.total) {
    state.phase = "done";
    state.message = `Done — ${state.done}/${state.total} images${
      state.failed ? `, ${state.failed} failed` : ""
    }.`;
  }
}

chrome.downloads.onChanged.addListener((delta) => {
  // Guarded on ids THIS module created, so it ignores other modules' downloads.
  const info = tracked.get(delta.id);
  if (!info || !delta.state) return;

  if (delta.state.current === "complete") {
    tracked.delete(delta.id);
    state.done += 1;
    state.message = `Downloading… ${state.done}/${state.total}`;
    checkFinished();
    broadcast();
  } else if (delta.state.current === "interrupted") {
    tracked.delete(delta.id);
    if (!info.retried && info.fallbackUrl) {
      // /source/ didn't exist — retry once with the displayed rendition
      chrome.downloads
        .download({ url: info.fallbackUrl, filename: info.filename, conflictAction: "uniquify" })
        .then((newId) => tracked.set(newId, { ...info, retried: true }))
        .catch(() => {
          state.failed += 1;
          checkFinished();
          broadcast();
        });
    } else {
      state.failed += 1;
      checkFinished();
      broadcast();
    }
  }
});

// Routed here by background.js for messages where msg.module === "behance".
export function handle(msg, _sender, sendResponse) {
  if (msg.type === "getState") {
    sendResponse(state);
    return false;
  }
  if (msg.type === "progress") {
    state.phase = "collecting";
    state.message = `${msg.status}${msg.found ? ` ${msg.found} found.` : ""}`;
    broadcast();
    return false;
  }
  if (msg.type === "download") {
    // Fire-and-forget (see pinterest/background.js for why we return false).
    downloadAll(msg.project, msg.images).catch(() => {});
    return false;
  }
  if (msg.type === "cancel") {
    cancelled = true;
    return false;
  }
  return false;
}
