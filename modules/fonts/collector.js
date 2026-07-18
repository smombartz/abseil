// Abseil · Fonts — page collector.
// Injected with chrome.scripting.executeScript({ files: ['modules/fonts/collector.js'] }).
// Runs in the page's world, in every reachable frame, and RETURNS a data object
// (the value of the trailing IIFE becomes InjectionResult.result).
(() => {
  "use strict";

  const FONT_EXT = /\.(woff2|woff|ttf|otf|eot)(?:[?#]|$)/i;

  // format() hint / file extension -> canonical extension
  const FORMAT_TO_EXT = {
    woff2: "woff2",
    woff: "woff",
    truetype: "ttf",
    ttf: "ttf",
    opentype: "otf",
    otf: "otf",
    "embedded-opentype": "eot",
    eot: "eot",
    fontobject: "eot", // application/vnd.ms-fontobject
    svg: "svg",
    "svg+xml": "svg",
  };

  const stripQuotes = (s) => (s || "").trim().replace(/^['"]+|['"]+$/g, "").trim();

  const resolveUrl = (url, base) => {
    try {
      return new URL(url, base || document.baseURI).href;
    } catch {
      return url;
    }
  };

  // Map of resolved URL -> transfer/decoded size, from the Resource Timing API.
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

  // ---- 1. @font-face rules from every readable stylesheet ----------------
  const faces = [];
  const seenFaceUrls = new Set();

  const extFromUrl = (url) => {
    const m = url.match(FONT_EXT);
    return m ? m[1].toLowerCase() : "";
  };

  const parseSrc = (srcText, base) => {
    const urls = [];
    // url("x.woff2") format("woff2") | url('x') | url(x). Quote-scoped so a double-quoted
    // URL may contain ' (and vice-versa) and survive parens/apostrophes in filenames.
    // local() has no url(), so it is naturally skipped.
    const re =
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)(?:\s*format\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\))?/gi;
    let m;
    while ((m = re.exec(srcText))) {
      const raw = (m[1] ?? m[2] ?? m[3] ?? "").trim();
      if (!raw) continue;
      // format() hint; tech() suffixes are dropped (the regex stops at the first ')').
      const fmtHint = (m[4] ?? m[5] ?? m[6] ?? "").toLowerCase().split(/\s+/)[0];
      if (raw.toLowerCase().startsWith("data:")) {
        // Cover legacy MIME spellings: application/font-woff2, application/x-font-woff,
        // application/vnd.ms-fontobject (eot), font/woff2, etc.
        const mimeToken = (raw.match(
          /^data:(?:application|font)\/(?:x-font-|font-|vnd\.ms-)?(woff2|woff|truetype|ttf|opentype|otf|embedded-opentype|eot|fontobject)/i
        ) || [])[1];
        const dataExt =
          FORMAT_TO_EXT[fmtHint] || FORMAT_TO_EXT[(mimeToken || "").toLowerCase()] || "bin";
        urls.push({ url: raw, ext: dataExt, format: fmtHint || "embedded", isData: true, size: 0 });
        continue;
      }
      const abs = resolveUrl(raw, base);
      // The real file extension is authoritative (authors often write inaccurate format()
      // hints); fall back to the hint only for extension-less / dynamic URLs.
      const ext = extFromUrl(abs) || FORMAT_TO_EXT[fmtHint] || "";
      urls.push({ url: abs, ext, format: fmtHint || "", isData: false, size: sizeByUrl.get(abs) || 0 });
    }
    return urls;
  };

  const handleFontFaceRule = (rule, sheetBase) => {
    const family = stripQuotes(rule.style.getPropertyValue("font-family"));
    const src = rule.style.getPropertyValue("src");
    if (!src) return;
    const urls = parseSrc(src, sheetBase).filter((u) => {
      if (seenFaceUrls.has(u.url)) return false;
      seenFaceUrls.add(u.url);
      return true;
    });
    if (!urls.length) return;
    faces.push({
      family: family || "(unnamed)",
      weight: stripQuotes(rule.style.getPropertyValue("font-weight")) || "normal",
      style: stripQuotes(rule.style.getPropertyValue("font-style")) || "normal",
      stretch: stripQuotes(rule.style.getPropertyValue("font-stretch")) || "",
      urls,
    });
  };

  const walkRules = (ruleList, sheetBase) => {
    if (!ruleList) return;
    for (const rule of ruleList) {
      // CSSFontFaceRule === type 5; constructor check is more reliable across nesting.
      if (rule.constructor && rule.constructor.name === "CSSFontFaceRule") {
        handleFontFaceRule(rule, sheetBase);
      } else if (rule.styleSheet) {
        // CSSImportRule (@import url(...)). The imported sheet is NOT listed in
        // document.styleSheets — it hangs off rule.styleSheet. Cross-origin imports
        // throw on cssRules access and fall through to the network-detection path.
        try {
          walkRules(rule.styleSheet.cssRules, rule.styleSheet.href || sheetBase);
        } catch {
          /* cross-origin imported sheet — unreadable */
        }
      } else if (rule.cssRules) {
        // @media / @supports / @layer / @container groups can wrap @font-face.
        walkRules(rule.cssRules, sheetBase);
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules = null;
    try {
      rules = sheet.cssRules; // throws for cross-origin sheets without CORS
    } catch {
      rules = null;
    }
    walkRules(rules, sheet.href || document.baseURI);
  }

  // ---- 2. Network-detected font files (catches cross-origin stylesheets) --
  const networkFonts = [];
  const seenNet = new Set();
  for (const e of perfEntries) {
    if (!FONT_EXT.test(e.name)) continue;
    const abs = resolveUrl(e.name, document.baseURI);
    if (seenFaceUrls.has(abs) || seenNet.has(abs)) continue;
    seenNet.add(abs);
    networkFonts.push({
      url: abs,
      ext: extFromUrl(abs) || "",
      size: sizeByUrl.get(e.name) || sizeByUrl.get(abs) || 0,
    });
  }

  // ---- 3. Which families are actually applied in the rendered DOM ---------
  const usedFamilies = new Set();
  try {
    // Only the declared families matter for the "used" flag, so we can stop as soon as
    // every one has been seen rendered — that removes the document-order truncation that
    // a fixed cap would cause on large pages, while still bounding the worst case.
    const remaining = new Set(
      faces.map((f) => (f.family || "").toLowerCase()).filter(Boolean)
    );
    if (remaining.size) {
      const els = document.querySelectorAll("*");
      const MAX = 25000; // safety cap for pathological pages
      let i = 0;
      for (const el of els) {
        if (i++ >= MAX || remaining.size === 0) break;
        const ff = getComputedStyle(el).fontFamily;
        if (!ff) continue;
        for (const part of ff.split(",")) {
          const name = stripQuotes(part).toLowerCase();
          if (!name) continue;
          usedFamilies.add(name);
          remaining.delete(name);
        }
      }
    }
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    frameUrl: location.href,
    isTop: window.top === window.self,
    faces,
    networkFonts,
    usedFamilies: Array.from(usedFamilies),
  };
})();
