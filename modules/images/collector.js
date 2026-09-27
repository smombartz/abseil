// Abseil · Images — page collector.
// Injected with chrome.scripting.executeScript({ files: ['modules/images/collector.js'] }).
// Runs in the page's world, in every reachable frame, and RETURNS a data object
// (the value of the trailing IIFE becomes InjectionResult.result).
(() => {
  "use strict";

  const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?)(?:[?#]|$)/i;
  const MAX_DATA_URL = 2 * 1024 * 1024; // skip huge inline blobs — messaging cost
  const MAX_ELEMENTS = 25000; // safety cap for the computed-style walk

  const resolveUrl = (url) => {
    try {
      return new URL(url, document.baseURI).href;
    } catch {
      return "";
    }
  };

  // Resource Timing gives us byte sizes for same-origin / TAO-enabled files.
  const sizeByUrl = new Map();
  let perfEntries = [];
  try {
    perfEntries = performance.getEntriesByType("resource") || [];
  } catch {
    perfEntries = [];
  }
  for (const e of perfEntries) {
    const size = e.encodedBodySize || e.transferSize || e.decodedBodySize || 0;
    if (size && !sizeByUrl.has(e.name)) sizeByUrl.set(e.name, size);
  }

  const images = [];
  const byUrl = new Map();

  // kind: "img" (<img>/<picture>/<svg image>), "css" (background-image),
  // "meta" (icons, og:image), "network" (loaded but not found in the DOM)
  const add = (rawUrl, kind, extra = {}) => {
    if (!rawUrl) return;
    const lower = rawUrl.trim().toLowerCase();
    if (lower.startsWith("data:")) {
      if (!lower.startsWith("data:image/") || rawUrl.length > MAX_DATA_URL) return;
    } else if (lower.startsWith("blob:")) {
      return; // blob: URLs die with the page and can't be downloaded from the SW
    }
    const url = lower.startsWith("data:") ? rawUrl.trim() : resolveUrl(rawUrl.trim());
    if (!/^(https?:|data:)/i.test(url)) return;

    const prev = byUrl.get(url);
    if (prev) {
      // keep the most informative record (known dimensions, the more specific kind)
      if (!prev.width && extra.width) {
        prev.width = extra.width;
        prev.height = extra.height;
      }
      if (!prev.alt && extra.alt) prev.alt = extra.alt;
      return;
    }
    const rec = {
      url,
      kind,
      width: extra.width || 0,
      height: extra.height || 0,
      alt: (extra.alt || "").trim().slice(0, 200),
      isData: url.startsWith("data:"),
      size: sizeByUrl.get(url) || 0,
    };
    byUrl.set(url, rec);
    images.push(rec);
  };

  // Largest candidate from a srcset — "a.jpg 480w, b.jpg 1080w" / "a.jpg 1x, b.jpg 2x".
  const bestFromSrcset = (srcset) => {
    if (!srcset) return "";
    let best = "";
    let bestScore = -1;
    // Split on commas that are followed by whitespace so data: URLs survive.
    for (const part of srcset.split(/,\s+/)) {
      const [u, d] = part.trim().split(/\s+/);
      if (!u) continue;
      const n = parseFloat(d) || 1;
      const score = /w$/i.test(d || "") ? n : n * 1000;
      if (score > bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  };

  // ---- 1. <img> elements (incl. lazy-load data-* attributes) --------------
  for (const img of document.images) {
    const dims = { width: img.naturalWidth, height: img.naturalHeight, alt: img.alt };
    add(img.currentSrc || img.src, "img", dims);
    const big = bestFromSrcset(img.srcset || img.getAttribute("data-srcset"));
    if (big) add(big, "img", big === (img.currentSrc || img.src) ? dims : { alt: img.alt });
    for (const attr of ["data-src", "data-original", "data-lazy-src", "data-full", "data-zoom-src"]) {
      const v = img.getAttribute(attr);
      if (v) add(v, "img", { alt: img.alt });
    }
  }

  // ---- 2. <picture><source srcset> -----------------------------------------
  for (const source of document.querySelectorAll("picture source[srcset]")) {
    add(bestFromSrcset(source.getAttribute("srcset")), "img");
  }

  // ---- 3. SVG <image href> -------------------------------------------------
  for (const el of document.querySelectorAll("svg image")) {
    add(el.getAttribute("href") || el.getAttribute("xlink:href"), "img");
  }

  // ---- 4. CSS background-image (plus ::before / ::after) -------------------
  const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/gi;
  const addCssUrls = (value) => {
    if (!value || value === "none" || value.indexOf("url(") === -1) return;
    let m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(value))) add(m[1] ?? m[2] ?? m[3], "css");
  };
  try {
    let i = 0;
    for (const el of document.querySelectorAll("*")) {
      if (i++ >= MAX_ELEMENTS) break;
      addCssUrls(getComputedStyle(el).backgroundImage);
      addCssUrls(getComputedStyle(el, "::before").backgroundImage);
      addCssUrls(getComputedStyle(el, "::after").backgroundImage);
    }
  } catch {
    /* ignore */
  }

  // ---- 5. Icons and social preview images ----------------------------------
  for (const link of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="image_src"]')) {
    add(link.getAttribute("href"), "meta");
  }
  for (const meta of document.querySelectorAll(
    'meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"], meta[name="twitter:image:src"]'
  )) {
    add(meta.getAttribute("content"), "meta");
  }

  // ---- 6. Network-loaded image files we haven't seen in the DOM ------------
  for (const e of perfEntries) {
    if (e.initiatorType !== "img" && !IMG_EXT.test(e.name)) continue;
    if (!byUrl.has(e.name)) add(e.name, "network");
  }

  return {
    ok: true,
    frameUrl: location.href,
    isTop: window.top === window.self,
    images,
  };
})();
