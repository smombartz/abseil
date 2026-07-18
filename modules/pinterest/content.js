// Abseil · Pinterest — page content script (declared for pinterest.* hosts).
// On "start", auto-scrolls the board so every pin lazy-loads, collects
// full-resolution image URLs from the board's own grid (excluding avatars, UI
// images, and related-pin sections), then hands the list to the background
// service worker for downloading. Long-running and cancellable; it survives the
// popup closing because it lives in the page, not the popup.

const SCROLL_DELAY = 1500; // ms between scroll steps

let running = false;
let cancelled = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.module !== "pinterest") return;
  if (msg.type === "start") {
    if (!running) collect();
    sendResponse({ ok: true });
  } else if (msg.type === "cancel") {
    cancelled = true;
    sendResponse({ ok: true });
  }
});

function report(status, found) {
  chrome.runtime
    .sendMessage({ module: "pinterest", type: "progress", status, found })
    .catch(() => {});
}

function boardNameFromUrl() {
  // Board URLs look like /<username>/<board-slug>/
  const parts = location.pathname.split("/").filter(Boolean);
  const slug = parts.length >= 2 ? parts[1] : parts[0] || "board";
  return decodeURIComponent(slug).replace(/[\\/:*?"<>|.]+/g, "-").trim() || "board";
}

// The board's own pins live in the FIRST masonry grid on the page.
// "More like this" / "More ideas" are separate grids further down,
// so anchoring to the first grid excludes them.
function getBoardGrid() {
  return (
    document.querySelector('[data-test-id="board-feed"] [role="list"]') ||
    document.querySelector('[role="list"]')
  );
}

// Avatars and UI chrome use small square renditions or the avatars path.
function isUiImage(src) {
  return (
    src.includes("/avatars/") ||
    /\/\d+x\d+_RS\//.test(src) ||
    /\/(30|60|75|140|280)x\1\//.test(src)
  );
}

function harvest(collected) {
  const grid = getBoardGrid();
  if (!grid) return;
  grid.querySelectorAll('[role="listitem"]').forEach((item) => {
    // A real pin card always links to /pin/<id>/
    if (!item.querySelector('a[href*="/pin/"]')) return;
    item.querySelectorAll('img[src*="pinimg.com"]').forEach((img) => {
      if (isUiImage(img.src)) return;
      const m = img.src.match(/pinimg\.com\/[^/]+\/(.+)$/);
      if (!m) return;
      const key = m[1];
      if (!collected.has(key)) {
        collected.set(key, `https://i.pinimg.com/originals/${key}`);
      }
    });
  });
}

async function collect() {
  running = true;
  cancelled = false;
  const collected = new Map();

  if (!getBoardGrid()) {
    report("No pin grid found — open a board page first.", 0);
    running = false;
    return;
  }

  let lastHeight = 0;
  let stuck = 0;
  while (stuck < 3 && !cancelled) {
    harvest(collected);
    report("Scrolling to load all pins…", collected.size);
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, SCROLL_DELAY));
    const h = document.body.scrollHeight;
    if (h === lastHeight) stuck += 1;
    else {
      stuck = 0;
      lastHeight = h;
    }
  }
  harvest(collected);
  running = false;

  if (cancelled) {
    report("Stopped.", collected.size);
    return;
  }

  chrome.runtime
    .sendMessage({
      module: "pinterest",
      type: "download",
      board: boardNameFromUrl(),
      images: [...collected].map(([key, url]) => ({ key, url })),
    })
    .catch(() => {});
}
