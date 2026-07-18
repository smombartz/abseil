// Abseil · Pinterest — background handler.
// Receives the collected image list from the content script and downloads each
// file via chrome.downloads into Downloads/Abseil/Pinterest/<board>/.
// If the full-res /originals/ URL fails (some pins have none), retries once
// with the 736x rendition.

const DOWNLOAD_DELAY = 150; // ms between queued downloads

const state = {
  phase: "idle",
  message: "Open a Pinterest board, then hit download.",
  done: 0,
  failed: 0,
  total: 0,
};
let cancelled = false;
// downloadId -> { fallbackUrl, filename, retried }
const tracked = new Map();

function broadcast() {
  chrome.runtime.sendMessage({ module: "pinterest", type: "state", state }).catch(() => {});
}

async function downloadAll(board, images) {
  cancelled = false;
  state.phase = "downloading";
  state.total = images.length;
  state.done = 0;
  state.failed = 0;
  state.message = `Downloading 0/${images.length}…`;
  broadcast();

  for (const { key, url } of images) {
    if (cancelled) break;
    const name = key.split("/").pop();
    const filename = `Abseil/Pinterest/${board}/${name}`;
    try {
      const id = await chrome.downloads.download({ url, filename, conflictAction: "uniquify" });
      tracked.set(id, {
        fallbackUrl: url.replace("/originals/", "/736x/"),
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
    if (!info.retried) {
      // /originals/ didn't exist — retry with the 736x rendition
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

// Routed here by background.js for messages where msg.module === "pinterest".
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
    // Fire-and-forget: the content script doesn't await a reply. We deliberately
    // return false (not true) — returning true would promise a response we never
    // send, surfacing a "message port closed" rejection at the sender. The loop
    // keeps the worker alive on its own via the chrome.downloads calls it makes;
    // .catch keeps any failure inside it from becoming an unhandled rejection.
    downloadAll(msg.board, msg.images).catch(() => {});
    return false;
  }
  if (msg.type === "cancel") {
    cancelled = true;
    return false;
  }
  return false;
}
