// Abseil · Fonts — background handler.
// Performs the actual file downloads via chrome.downloads, which bypasses the
// page CORS policy (it's a browser-level download, not a fetch).

const DOWNLOAD_DIR = "Abseil/Fonts";

// Only ever write font extensions — never honor a page-controlled extension like .exe.
const FONT_EXTS = new Set(["woff2", "woff", "ttf", "otf", "eot", "svg"]);

// Only these schemes are downloadable; reject anything a malicious page might inject.
function isAllowedUrl(url) {
  return /^(https?:|data:)/i.test(url || "");
}

// Sanitize a string into a safe filename component.
function sanitize(part) {
  return (part || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function basenameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last);
  } catch {
    return "";
  }
}

// Sanitize a name into one safe path segment (same guards as filenames).
function safeSegment(part) {
  let seg = sanitize(part).replace(/^[.\s]+|[.\s]+$/g, "");
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(seg)) seg = "_" + seg;
  return seg;
}

// Build "[folder/]Family-weight-style.ext", falling back to the URL basename.
function buildFilename({ url, family, weight, style, ext }, folder) {
  let name = "";
  if (family && family !== "(unnamed)") {
    const bits = [sanitize(family)];
    if (weight && weight !== "normal" && weight !== "400") bits.push(sanitize(String(weight)));
    if (style && style !== "normal") bits.push(sanitize(style));
    name = bits.filter(Boolean).join("-");
  }
  if (!name) {
    const base = basenameFromUrl(url);
    name = sanitize(base.replace(/\.[a-z0-9]+$/i, "")) || "font";
  }

  // Defense-in-depth: drop leading/trailing dots, guard reserved Windows device names.
  name = name.replace(/^[.\s]+|[.\s]+$/g, "");
  if (!name) name = "font";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name)) name = "_" + name;
  name = name.slice(0, 120);

  let finalExt = (ext || "").toLowerCase();
  if (!finalExt) {
    const base = basenameFromUrl(url);
    const m = base.match(/\.([a-z0-9]+)$/i);
    finalExt = m ? m[1].toLowerCase() : "";
  }
  if (!FONT_EXTS.has(finalExt)) finalExt = "bin"; // never honor a non-font extension
  const dir = folder ? `${DOWNLOAD_DIR}/${folder}` : DOWNLOAD_DIR;
  return `${dir}/${name}.${finalExt}`;
}

// folder: an already-sanitized subfolder of DOWNLOAD_DIR, or "" for none.
function downloadOne(item, folder = "") {
  return new Promise((resolve) => {
    if (!item || !isAllowedUrl(item.url)) {
      resolve({ ok: false, url: item && item.url, error: "unsupported URL scheme" });
      return;
    }
    let filename;
    try {
      filename = buildFilename(item, folder);
    } catch {
      filename = `${DOWNLOAD_DIR}/${folder ? folder + "/" : ""}font.bin`;
    }
    try {
      chrome.downloads.download(
        { url: item.url, filename, saveAs: false, conflictAction: "uniquify" },
        (id) => {
          const err = chrome.runtime.lastError;
          if (err || id === undefined) {
            resolve({ ok: false, url: item.url, error: err ? err.message : "download failed" });
          } else {
            resolve({ ok: true, url: item.url, id });
          }
        }
      );
    } catch (e) {
      resolve({ ok: false, url: item.url, error: String(e && e.message ? e.message : e) });
    }
  });
}

// Routed here by background.js for messages where msg.module === "fonts".
export function handle(msg, _sender, sendResponse) {
  if (msg.type === "download") {
    downloadOne(msg.item).then(sendResponse);
    return true; // keep the channel open for the async response
  }

  if (msg.type === "downloadAll") {
    (async () => {
      const items = Array.isArray(msg.items) ? msg.items : [];
      // A family download goes into its own Abseil/Fonts/<Family>/ subfolder.
      const folder = safeSegment(msg.folder);
      const results = [];
      for (const item of items) {
        // Sequential, so a flood of files doesn't trip download rate limits.
        results.push(await downloadOne(item, folder));
      }
      const okCount = results.filter((r) => r.ok).length;
      sendResponse({ ok: true, total: items.length, okCount, results });
    })();
    return true;
  }

  return false;
}
