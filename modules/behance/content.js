// Abseil · Behance — page content script (declared for behance.net hosts).
// On "start", auto-scrolls the project so every lazy-loaded image module loads,
// collects full-resolution image URLs (rewriting the CDN rendition to /source/),
// then hands the list to the background service worker for downloading. Related
// projects, "more by" thumbnails, and avatars are excluded. Long-running and
// cancellable; it survives the popup closing because it lives in the page.

const SCROLL_DELAY = 1200; // ms between scroll steps
const MAX_STEPS = 60; // hard cap so endless "recommended projects" can't run forever

let running = false;
let cancelled = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.module !== "behance") return;
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
    .sendMessage({ module: "behance", type: "progress", status, found })
    .catch(() => {});
}

function projectNameFromUrl() {
  // Project URLs look like /gallery/<id>/<slug>.
  const parts = location.pathname.split("/").filter(Boolean);
  const gi = parts.indexOf("gallery");
  const slug = gi >= 0 && parts[gi + 2] ? parts[gi + 2] : parts[parts.length - 1] || "project";
  return decodeURIComponent(slug).replace(/[\\/:*?"<>|.]+/g, "-").trim() || "project";
}

function currentGalleryId() {
  return (location.pathname.match(/\/gallery\/(\d+)/) || [])[1] || "";
}

// Behance serves project images from .../project_modules/<rendition>/<id>.<ext>.
// The <id>.<ext> tail is shared across renditions, so it's our dedupe key.
const MODULE_RE = /\/project_modules\/[^/]+\/([^/?#]+)/;

// /source/ is the original upload; keep the displayed URL as a guaranteed
// fallback in case /source/ 404s for some older modules.
function toSource(url) {
  return url.replace(/\/project_modules\/[^/]+\//, "/project_modules/source/");
}

// A real project image is served from a Behance CDN host (today
// mir-s3-cdn-cf.behance.net and mir-cdn.behance.net) under /project_modules/.
// We accept ANY *.behance.net host deliberately: pinning to today's CDN names
// would silently drop images if Behance moves to a new CDN host, whereas the
// /project_modules/ path already keeps non-image subdomains (api/static/…) out.
// Bounding the host to behance.net still means we never download an off-origin URL.
function isModuleUrl(u) {
  if (!u) return false;
  try {
    const x = new URL(u, location.href);
    return /(^|\.)behance\.net$/i.test(x.hostname) && x.pathname.includes("/project_modules/");
  } catch {
    return false;
  }
}

// Pull the best loaded URL off a (possibly lazy-loaded, responsive) <img>.
function imgUrl(img) {
  const cands = [img.currentSrc, img.src, img.dataset && img.dataset.src];
  if (img.srcset) {
    // last srcset entry is the largest rendition
    const last = img.srcset.split(",").pop();
    if (last) cands.push(last.trim().split(/\s+/)[0]);
  }
  return cands.find(isModuleUrl) || "";
}

function harvest(collected) {
  const galleryId = currentGalleryId();
  for (const img of document.images) {
    // Skip thumbnails that link to a DIFFERENT gallery (related / "more by"
    // sections); the project's own content images aren't wrapped that way.
    const a = img.closest && img.closest('a[href*="/gallery/"]');
    if (a) {
      const id = (a.getAttribute("href").match(/\/gallery\/(\d+)/) || [])[1];
      if (id && id !== galleryId) continue;
    }
    const url = imgUrl(img);
    if (!url) continue;
    const m = url.match(MODULE_RE);
    if (!m) continue;
    const key = m[1];
    if (!collected.has(key)) {
      collected.set(key, { key, url: toSource(url), fallbackUrl: url });
    }
  }
}

async function collect() {
  running = true;
  cancelled = false;
  const collected = new Map();

  let lastHeight = 0;
  let stuck = 0;
  let lastCount = 0;
  let stall = 0;
  let steps = 0;
  // Stop when the page stops growing OR no new images appear for a few steps
  // (Behance keeps loading recommended projects below the real content forever).
  while (stuck < 3 && stall < 4 && steps < MAX_STEPS && !cancelled) {
    harvest(collected);
    report("Scrolling to load all images…", collected.size);
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, SCROLL_DELAY));
    steps += 1;
    const h = document.body.scrollHeight;
    if (h === lastHeight) stuck += 1;
    else {
      stuck = 0;
      lastHeight = h;
    }
    if (collected.size === lastCount) stall += 1;
    else {
      stall = 0;
      lastCount = collected.size;
    }
  }
  harvest(collected);
  running = false;

  if (cancelled) {
    report("Stopped.", collected.size);
    return;
  }
  if (collected.size === 0) {
    report("No project images found — open a Behance project (gallery) page.", 0);
    return;
  }

  chrome.runtime
    .sendMessage({
      module: "behance",
      type: "download",
      project: projectNameFromUrl(),
      images: [...collected.values()],
    })
    .catch(() => {});
}
