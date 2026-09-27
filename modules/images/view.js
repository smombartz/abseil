// Abseil · Images — popup view.
//
// Lists every image on the active tab (<img>, srcset, <picture>, CSS
// backgrounds, icons / og:image, network-loaded files) with a thumbnail, and
// lets you open each one in a new tab or download it. Shares the Fonts card /
// row / footer styles, and sits next to Fonts as a page-tool tab.
"use strict";

const SMALL_PX = 64; // "Hide small" threshold (either side), when dimensions are known
const TINY_PX = 2; // tracking pixels / spacers — never worth listing

const VIEW_HTML = `
  <div id="im-summary" class="summary" hidden></div>
  <main id="im-list" class="list" aria-live="polite">
    <div id="im-status" class="status">Scanning page…</div>
  </main>
  <footer id="im-foot" class="foot" hidden>
    <span id="im-footCount" class="foot-count"></span>
    <button id="im-downloadAll" class="btn btn-primary">Download all</button>
  </footer>
`;

// Card order and titles, one card per source kind.
const GROUPS = [
  { kind: "img", title: "Images", tag: "img" },
  { kind: "css", title: "Backgrounds", tag: "css" },
  { kind: "meta", title: "Icons & previews", tag: "meta" },
  { kind: "network", title: "Other image files", tag: "network" },
];

const EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?)(?:[?#]|$)/i;

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extOf(rec) {
  if (rec.isData) {
    const mime = (rec.url.match(/^data:image\/([a-z0-9.+-]+)/i) || [])[1] || "";
    return mime.replace(/\+xml$/i, "").replace(/^x-icon$|^vnd\.microsoft\.icon$/i, "ico");
  }
  const m = rec.url.match(EXT_RE);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "";
}

function fileLabel(rec) {
  try {
    if (rec.isData) return `embedded (${(extOf(rec) || "image").toUpperCase()})`;
    const u = new URL(rec.url);
    const base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || u.hostname);
    return base || rec.url;
  } catch {
    return rec.url;
  }
}

function mergeFrames(frames) {
  const byUrl = new Map();
  for (const f of frames || []) {
    const r = f && f.result;
    if (!r || !r.ok) continue;
    for (const img of r.images || []) {
      const prev = byUrl.get(img.url);
      if (!prev) {
        byUrl.set(img.url, { ...img });
        continue;
      }
      if (!prev.width && img.width) {
        prev.width = img.width;
        prev.height = img.height;
      }
      if (!prev.size && img.size) prev.size = img.size;
    }
  }
  const all = Array.from(byUrl.values()).filter(
    (r) => !(r.width && r.height && (r.width <= TINY_PX || r.height <= TINY_PX))
  );
  return { all };
}

function isSmall(rec) {
  return !!(rec.width && rec.height && (rec.width < SMALL_PX || rec.height < SMALL_PX));
}

function mount({ view, barActions, tab, host }) {
  view.innerHTML = VIEW_HTML;

  const listEl = view.querySelector("#im-list");
  const statusEl = view.querySelector("#im-status");
  const summaryEl = view.querySelector("#im-summary");
  const footEl = view.querySelector("#im-foot");
  const footCountEl = view.querySelector("#im-footCount");
  const downloadAllBtn = view.querySelector("#im-downloadAll");

  // "Hide small" toggle lives in the shared header action slot.
  const toggleLabel = document.createElement("label");
  toggleLabel.className = "toggle";
  toggleLabel.title = `Hide icons and images smaller than ${SMALL_PX}px`;
  toggleLabel.innerHTML = `<input type="checkbox" id="im-hideSmall" /><span>Hide small</span>`;
  barActions.appendChild(toggleLabel);
  const hideSmallEl = toggleLabel.querySelector("#im-hideSmall");

  let model = null; // { all: [...] }

  function setStatus(html) {
    // #im-status lives inside #im-list, which render() clears — re-attach it.
    if (!statusEl.isConnected) listEl.appendChild(statusEl);
    statusEl.innerHTML = html;
    statusEl.hidden = false;
  }

  function visibleRecords() {
    const hideSmall = hideSmallEl.checked;
    return model.all.filter((r) => !hideSmall || !isSmall(r));
  }

  function render() {
    if (!model) return;
    listEl.innerHTML = "";
    const recs = visibleRecords();

    if (recs.length === 0) {
      const msg = hideSmallEl.checked && model.all.length
        ? "Only small images on this page.<br>Untick “Hide small” to see them."
        : "No images found on this page.<br><span style='color:var(--muted);font-size:11px'>Images drawn on a canvas or loaded as blobs can’t be detected.</span>";
      setStatus(msg);
      summaryEl.hidden = true;
      footEl.hidden = true;
      return;
    }
    statusEl.hidden = true;

    let groupCount = 0;
    for (const g of GROUPS) {
      const inGroup = recs.filter((r) => r.kind === g.kind);
      if (!inGroup.length) continue;
      groupCount++;
      listEl.appendChild(renderGroup(g, inGroup));
    }

    summaryEl.innerHTML = `<b>${recs.length}</b> ${recs.length === 1 ? "image" : "images"} · <b>${groupCount}</b> ${
      groupCount === 1 ? "source" : "sources"
    }`;
    summaryEl.hidden = false;

    footCountEl.textContent = `${recs.length} ${recs.length === 1 ? "image" : "images"}`;
    // reset the footer action so a re-render never leaves it stuck in a transient state
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "Download all";
    footEl.hidden = false;
  }

  function renderGroup(group, recs) {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";
    const name = document.createElement("div");
    name.className = "fam";
    name.textContent = group.title;
    const tags = document.createElement("div");
    tags.className = "tags";
    const tag = document.createElement("span");
    tag.className = "tag" + (group.kind === "img" ? " used" : "");
    tag.textContent = `${recs.length} · ${group.tag}`;
    tags.appendChild(tag);
    head.appendChild(name);
    head.appendChild(tags);
    card.appendChild(head);

    const files = document.createElement("div");
    files.className = "files";
    for (const rec of recs) files.appendChild(renderFile(rec));
    card.appendChild(files);
    return card;
  }

  function renderFile(rec) {
    const row = document.createElement("div");
    row.className = "file";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = rec.url;
    thumb.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "file-meta";
    const nm = document.createElement("div");
    nm.className = "file-name";
    nm.textContent = fileLabel(rec);
    nm.title = rec.isData ? "Embedded data: image" : rec.alt ? `${rec.alt}\n${rec.url}` : rec.url;
    const sub = document.createElement("div");
    sub.className = "file-sub";
    const ext = extOf(rec).toUpperCase();
    if (ext) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = ext;
      sub.appendChild(pill);
    }
    const details = document.createElement("span");
    const paintDetails = () => {
      const parts = [];
      if (rec.width && rec.height) parts.push(`${rec.width}×${rec.height}`);
      if (rec.size) parts.push(fmtSize(rec.size));
      details.textContent = parts.join(" · ");
    };
    paintDetails();
    sub.appendChild(details);
    meta.appendChild(nm);
    meta.appendChild(sub);

    // Backgrounds / network files arrive without dimensions — learn them from the thumbnail.
    img.addEventListener("load", () => {
      if (!rec.width && img.naturalWidth) {
        rec.width = img.naturalWidth;
        rec.height = img.naturalHeight;
        paintDetails();
      }
    });
    img.addEventListener("error", () => thumb.classList.add("broken"));

    const label = fileLabel(rec);
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-dl";
    openBtn.textContent = "Open";
    openBtn.title = "Open in a new tab";
    openBtn.setAttribute("aria-label", "Open " + label + " in a new tab");
    openBtn.addEventListener("click", () => openOne(rec, openBtn));

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn btn-dl";
    dlBtn.textContent = "Download";
    dlBtn.setAttribute("aria-label", "Download " + label);
    dlBtn.addEventListener("click", () => downloadOne(rec, dlBtn));

    row.appendChild(thumb);
    row.appendChild(meta);
    row.appendChild(openBtn);
    row.appendChild(dlBtn);
    return row;
  }

  // Show a transient result on a row button, then restore it.
  function flash(btn, ok, original, error, okText = "Saved") {
    btn.textContent = ok ? okText : "Failed";
    btn.classList.add(ok ? "done" : "fail");
    if (!ok && error) btn.title = error;
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = original;
      btn.classList.remove("done", "fail");
    }, 2200);
  }

  async function openOne(rec, btn) {
    const original = btn.textContent;
    btn.disabled = true;
    try {
      // Background tab next to the page, so the popup stays open for more.
      await chrome.tabs.create({ url: rec.url, active: false, openerTabId: tab.id });
      flash(btn, true, original, "", "Opened");
    } catch (e) {
      flash(btn, false, original, e && e.message ? e.message : "Couldn’t open");
    }
  }

  async function downloadOne(rec, btn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const res = await chrome.runtime.sendMessage({
        module: "images",
        type: "download",
        item: { url: rec.url, site: host },
      });
      flash(btn, !!(res && res.ok), original, (res && res.error) || "Download failed");
    } catch (e) {
      flash(btn, false, original, e && e.message ? e.message : "Download failed");
    }
  }

  async function downloadAll() {
    const recs = visibleRecords();
    if (!recs.length) return;
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Downloading…";
    hideSmallEl.disabled = true; // freeze the visible set while the batch is in flight
    try {
      const res = await chrome.runtime.sendMessage({
        module: "images",
        type: "downloadAll",
        items: recs.map((r) => ({ url: r.url, site: host })),
      });
      downloadAllBtn.textContent = res && res.ok ? `Saved ${res.okCount}/${res.total}` : "Failed";
    } catch {
      downloadAllBtn.textContent = "Failed";
    } finally {
      hideSmallEl.disabled = false;
      setTimeout(() => {
        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = "Download all";
      }, 2600);
    }
  }

  async function scan() {
    let frames;
    try {
      frames = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["modules/images/collector.js"],
      });
    } catch (e) {
      setStatus(
        "Couldn’t scan this page.<br><span style='color:var(--muted);font-size:11px'>" +
          (e && e.message ? e.message : "Injection was blocked.") +
          "</span>"
      );
      return;
    }
    model = mergeFrames(frames);
    render();
  }

  hideSmallEl.addEventListener("change", render);
  downloadAllBtn.addEventListener("click", downloadAll);
  scan();
}

export default {
  id: "images",
  label: "Images",
  // Page tool, shown as a tab next to Fonts on any normal web page.
  fallback: true,
  match: ({ url }) => /^https?:/i.test(url || ""),
  mount,
};
