// Abseil · Images — background handler.
// Downloads page images via chrome.downloads into Downloads/Abseil/Images/<site>/.
// Like Fonts, this is a browser-level download, so page CORS doesn't apply.

const DOWNLOAD_DIR = "Abseil/Images";

// Only ever write image extensions — never honor a page-controlled extension like .exe.
const IMG_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "ico", "tif", "tiff"]);

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/apng": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
};

// Only these schemes are downloadable; reject anything a malicious page might inject.
function isAllowedUrl(url) {
  return /^(https?:|data:image\/)/i.test(url || "");
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

function safeName(name, fallback) {
  name = sanitize(name).replace(/^[.\s]+|[.\s]+$/g, "");
  if (!name) name = fallback;
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name)) name = "_" + name;
  return name.slice(0, 120);
}

// Extension-less CDN URLs (…/photo?id=123) — ask the server what it is.
async function extFromHead(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, credentials: "include" });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    return MIME_TO_EXT[type] || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function buildFilename({ url, site }) {
  const folder = `${DOWNLOAD_DIR}/${safeName(site, "page")}`;

  if (/^data:/i.test(url)) {
    const mime = (url.match(/^data:([^;,]+)/i) || [])[1] || "";
    const ext = MIME_TO_EXT[mime.toLowerCase()] || "png";
    return `${folder}/image.${ext}`;
  }

  const base = basenameFromUrl(url);
  const m = base.match(/^(.*)\.([a-z0-9]+)$/i);
  let stem = m ? m[1] : base;
  let ext = m ? m[2].toLowerCase() : "";
  if (!IMG_EXTS.has(ext)) {
    // "photo.php" / "image" — the tail wasn't an image extension, keep it in the name
    stem = base;
    ext = (await extFromHead(url)) || "jpg";
  }
  if (ext === "jpeg") ext = "jpg";
  return `${folder}/${safeName(stem, "image")}.${ext}`;
}

async function downloadOne(item) {
  if (!item || !isAllowedUrl(item.url)) {
    return { ok: false, url: item && item.url, error: "unsupported URL scheme" };
  }
  let filename;
  try {
    filename = await buildFilename(item);
  } catch {
    filename = `${DOWNLOAD_DIR}/image.jpg`;
  }
  try {
    const id = await chrome.downloads.download({
      url: item.url,
      filename,
      saveAs: false,
      conflictAction: "uniquify",
    });
    return { ok: true, url: item.url, id };
  } catch (e) {
    return { ok: false, url: item.url, error: String(e && e.message ? e.message : e) };
  }
}

// Routed here by background.js for messages where msg.module === "images".
export function handle(msg, _sender, sendResponse) {
  if (msg.type === "download") {
    downloadOne(msg.item).then(sendResponse);
    return true; // keep the channel open for the async response
  }

  if (msg.type === "downloadAll") {
    (async () => {
      const items = Array.isArray(msg.items) ? msg.items : [];
      const results = [];
      for (const item of items) {
        // Sequential, so a flood of files doesn't trip download rate limits.
        results.push(await downloadOne(item));
      }
      const okCount = results.filter((r) => r.ok).length;
      sendResponse({ ok: true, total: items.length, okCount, results });
    })();
    return true;
  }

  return false;
}
