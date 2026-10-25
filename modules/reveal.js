// Abseil — "Show in Finder" for finished downloads (popup side).
//
// Shared by the module views. The popup has the `downloads` permission, so it
// can watch a download and reveal it directly; no background round-trip needed.
"use strict";

export const REVEAL_LABEL = /Mac/i.test(navigator.platform) ? "Show in Finder" : "Show in folder";

// Resolves true once the download is fully written to disk, false if it fails.
export function whenComplete(id) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(ok);
    };
    const onChanged = (delta) => {
      if (delta.id !== id || !delta.state) return;
      if (delta.state.current === "complete") finish(true);
      else if (delta.state.current === "interrupted") finish(false);
    };
    chrome.downloads.onChanged.addListener(onChanged);
    // it may already be done (small files finish before we start listening)
    chrome.downloads
      .search({ id })
      .then(([item]) => {
        if (!item || item.state === "interrupted") finish(false);
        else if (item.state === "complete") finish(true);
      })
      .catch(() => finish(false));
  });
}

// Waits for every id, returns the last one that completed (or null if none did).
export async function lastCompleted(ids) {
  const oks = await Promise.all(ids.map(whenComplete));
  for (let i = ids.length - 1; i >= 0; i--) if (oks[i]) return ids[i];
  return null;
}

// Puts a "Show in Finder" button for download `id` just before `anchor`, reusing
// the one already there from an earlier download.
export function showRevealButton(anchor, id, className = "btn btn-dl") {
  let btn = anchor.previousElementSibling;
  if (!btn || !btn.classList.contains("btn-reveal")) {
    btn = document.createElement("button");
    btn.className = `${className} btn-reveal`;
    btn.textContent = REVEAL_LABEL;
    btn.addEventListener("click", () => {
      try {
        chrome.downloads.show(Number(btn.dataset.id));
      } catch {
        // the file was moved or deleted since; nothing to reveal
      }
    });
    anchor.before(btn);
  }
  btn.dataset.id = String(id);
  btn.title = "Reveal the downloaded file";
  return btn;
}
