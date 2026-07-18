// Abseil · Fonts — popup view.
//
// Lists every font declared/used on the active tab and downloads the source
// files. Works on any page via on-demand injection of collector.js, so it is
// the universal fallback module (registry puts it last).
"use strict";

const PREVIEW_TEXT = "Aa Bb Cc 123";
const previewIdSeq = (() => {
  let n = 0;
  return () => `fa-prev-${n++}`;
})();

const VIEW_HTML = `
  <div id="fa-summary" class="summary" hidden></div>
  <main id="fa-list" class="list" aria-live="polite">
    <div id="fa-status" class="status">Scanning page…</div>
  </main>
  <footer id="fa-foot" class="foot" hidden>
    <span id="fa-footCount" class="foot-count"></span>
    <button id="fa-downloadAll" class="btn btn-primary">Download all</button>
  </footer>
`;

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mergeFrames(frames) {
  const facesByUrl = new Map(); // url -> face-url record (one row per file)
  const used = new Set();
  const networkByUrl = new Map();

  for (const f of frames || []) {
    const r = f && f.result;
    if (!r || !r.ok) continue;
    for (const u of r.usedFamilies || []) used.add(u);

    for (const face of r.faces || []) {
      for (const file of face.urls || []) {
        if (facesByUrl.has(file.url)) {
          // prefer a record that carries a known size
          const prev = facesByUrl.get(file.url);
          if (!prev.size && file.size) prev.size = file.size;
          continue;
        }
        facesByUrl.set(file.url, {
          family: face.family,
          weight: face.weight,
          style: face.style,
          stretch: face.stretch,
          url: file.url,
          ext: file.ext,
          format: file.format,
          isData: !!file.isData,
          size: file.size || 0,
        });
      }
    }

    for (const nf of r.networkFonts || []) {
      if (!networkByUrl.has(nf.url) && !facesByUrl.has(nf.url)) {
        networkByUrl.set(nf.url, nf);
      }
    }
  }

  // group declared faces by family
  const famMap = new Map();
  for (const rec of facesByUrl.values()) {
    const display = rec.family || "(unnamed)";
    const key = display.trim().toLowerCase(); // coalesce case/whitespace variants
    if (!famMap.has(key)) {
      famMap.set(key, {
        family: display, // keep first-seen casing for the card title
        used: used.has(key),
        files: [],
      });
    }
    famMap.get(key).files.push(rec);
  }

  const families = Array.from(famMap.values()).sort((a, b) => {
    if (a.used !== b.used) return a.used ? -1 : 1; // used first
    return a.family.localeCompare(b.family);
  });

  // network-only files that never matched an accessible @font-face
  const orphans = Array.from(networkByUrl.values()).map((nf) => ({
    family: "",
    weight: "",
    style: "",
    url: nf.url,
    ext: nf.ext,
    format: "",
    isData: false,
    size: nf.size || 0,
  }));

  return { families, orphans };
}

function fileLabel(rec) {
  try {
    if (rec.isData) return `embedded (${(rec.ext || "data").toUpperCase()})`;
    const u = new URL(rec.url);
    const base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || u.hostname);
    return base || rec.url;
  } catch {
    return rec.url;
  }
}

function recToItem(rec) {
  return {
    url: rec.url,
    family: rec.family,
    weight: rec.weight,
    style: rec.style,
    ext: rec.ext,
  };
}

// ---- live preview via FontFace (best-effort; CORS may block) --------------
async function loadPreview(el, rec) {
  if (!rec) return;
  const family = previewIdSeq();
  try {
    const ff = new FontFace(family, `url("${rec.url.replace(/"/g, '\\"')}")`);
    const loaded = await ff.load();
    document.fonts.add(loaded);
    el.style.fontFamily = `"${family}", var(--sans)`;
    el.classList.add("loaded");
  } catch {
    // CORS-blocked or unsupported format — leave the default rendering.
  }
}

function mount({ view, barActions, tab }) {
  view.innerHTML = VIEW_HTML;

  const listEl = view.querySelector("#fa-list");
  const statusEl = view.querySelector("#fa-status");
  const summaryEl = view.querySelector("#fa-summary");
  const footEl = view.querySelector("#fa-foot");
  const footCountEl = view.querySelector("#fa-footCount");
  const downloadAllBtn = view.querySelector("#fa-downloadAll");

  // "Used only" toggle lives in the shared header action slot.
  const toggleLabel = document.createElement("label");
  toggleLabel.className = "toggle";
  toggleLabel.title = "Only show fonts that actually render on the page";
  toggleLabel.innerHTML = `<input type="checkbox" id="fa-usedOnly" /><span>Used only</span>`;
  barActions.appendChild(toggleLabel);
  const usedOnlyEl = toggleLabel.querySelector("#fa-usedOnly");

  let model = null; // { families: [...], orphans: [...] }

  function setStatus(html) {
    // #status lives inside #list, which render() clears with innerHTML = "". Re-attach it
    // so empty-state and error messages always reach the document.
    if (!statusEl.isConnected) listEl.appendChild(statusEl);
    statusEl.innerHTML = html;
    statusEl.hidden = false;
  }

  function allVisibleRecords() {
    const usedOnly = usedOnlyEl.checked;
    const recs = [];
    for (const fam of model.families) {
      if (usedOnly && !fam.used) continue;
      recs.push(...fam.files);
    }
    if (!usedOnly) {
      for (const o of model.orphans) recs.push(o);
    }
    return recs;
  }

  function render() {
    if (!model) return;
    const usedOnly = usedOnlyEl.checked;
    listEl.innerHTML = "";

    const visibleFamilies = model.families.filter((f) => !usedOnly || f.used);
    const showOrphans = !usedOnly && model.orphans.length > 0;
    const totalFiles = allVisibleRecords().length;

    if (totalFiles === 0) {
      const msg = usedOnly
        ? "No <i>rendered</i> web fonts found.<br>Untick “Used only” to see all declared fonts."
        : "No downloadable font files found on this page.<br><span style='color:var(--muted);font-size:11px'>The page may use only system fonts, or serve fonts that can’t be detected.</span>";
      setStatus(msg);
      summaryEl.hidden = true;
      footEl.hidden = true;
      return;
    }
    statusEl.hidden = true;

    // summary (count the "Other font files" card as one group too)
    const famCount = visibleFamilies.length + (showOrphans ? 1 : 0);
    summaryEl.innerHTML = `<b>${famCount}</b> ${famCount === 1 ? "family" : "families"} · <b>${totalFiles}</b> ${
      totalFiles === 1 ? "file" : "files"
    }`;
    summaryEl.hidden = false;

    for (const fam of visibleFamilies) {
      listEl.appendChild(renderFamily(fam));
    }
    if (showOrphans) {
      listEl.appendChild(renderOrphans(model.orphans));
    }

    footCountEl.textContent = `${totalFiles} ${totalFiles === 1 ? "file" : "files"}`;
    // reset the footer action so a re-render never leaves it stuck in a transient state
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "Download all";
    footEl.hidden = false;
  }

  function renderFamily(fam) {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card-head";
    const name = document.createElement("div");
    name.className = "fam";
    name.textContent = fam.family;
    const tags = document.createElement("div");
    tags.className = "tags";
    const tag = document.createElement("span");
    tag.className = "tag" + (fam.used ? " used" : "");
    tag.textContent = fam.used ? "used" : "declared";
    tags.appendChild(tag);
    head.appendChild(name);
    head.appendChild(tags);
    card.appendChild(head);

    // live preview, loaded from the first file
    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = PREVIEW_TEXT;
    card.appendChild(preview);
    loadPreview(preview, fam.files[0]);

    const files = document.createElement("div");
    files.className = "files";
    for (const rec of fam.files) files.appendChild(renderFile(rec));
    card.appendChild(files);
    return card;
  }

  function renderOrphans(orphans) {
    const card = document.createElement("div");
    card.className = "card";
    const head = document.createElement("div");
    head.className = "card-head";
    const name = document.createElement("div");
    name.className = "fam";
    name.textContent = "Other font files";
    const tags = document.createElement("div");
    tags.className = "tags";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "network";
    tags.appendChild(tag);
    head.appendChild(name);
    head.appendChild(tags);
    card.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "preview";
    sub.style.fontSize = "11px";
    sub.style.opacity = "1";
    sub.textContent = "Loaded over the network (cross-origin stylesheet — family unknown).";
    card.appendChild(sub);

    const files = document.createElement("div");
    files.className = "files";
    for (const rec of orphans) files.appendChild(renderFile(rec));
    card.appendChild(files);
    return card;
  }

  function renderFile(rec) {
    const row = document.createElement("div");
    row.className = "file";

    const meta = document.createElement("div");
    meta.className = "file-meta";
    const nm = document.createElement("div");
    nm.className = "file-name";
    nm.textContent = fileLabel(rec);
    nm.title = rec.isData ? "Embedded data: font" : rec.url;
    const sub = document.createElement("div");
    sub.className = "file-sub";
    const ext = (rec.ext || rec.format || "").toUpperCase();
    if (ext) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = ext;
      sub.appendChild(pill);
    }
    const parts = [];
    if (rec.weight && rec.weight !== "normal") parts.push(rec.weight);
    if (rec.style && rec.style !== "normal") parts.push(rec.style);
    if (rec.size) parts.push(fmtSize(rec.size));
    if (parts.length) {
      const span = document.createElement("span");
      span.textContent = parts.join(" · ");
      sub.appendChild(span);
    }
    meta.appendChild(nm);
    meta.appendChild(sub);

    const btn = document.createElement("button");
    btn.className = "btn btn-dl";
    btn.textContent = "Download";
    btn.setAttribute("aria-label", "Download " + fileLabel(rec)); // distinct accessible name per file
    btn.addEventListener("click", () => downloadOne(rec, btn));

    row.appendChild(meta);
    row.appendChild(btn);
    return row;
  }

  async function downloadOne(rec, btn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const res = await chrome.runtime.sendMessage({
        module: "fonts",
        type: "download",
        item: recToItem(rec),
      });
      if (res && res.ok) {
        btn.textContent = "Saved";
        btn.classList.add("done");
      } else {
        btn.textContent = "Failed";
        btn.classList.add("fail");
        btn.title = (res && res.error) || "Download failed";
      }
    } catch (e) {
      btn.textContent = "Failed";
      btn.classList.add("fail");
      btn.title = e && e.message ? e.message : "Download failed";
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = original;
        btn.classList.remove("done", "fail");
      }, 2200);
    }
  }

  async function downloadAll() {
    const recs = allVisibleRecords();
    if (!recs.length) return;
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Downloading…";
    usedOnlyEl.disabled = true; // freeze the visible set while the batch is in flight
    try {
      const res = await chrome.runtime.sendMessage({
        module: "fonts",
        type: "downloadAll",
        items: recs.map(recToItem),
      });
      if (res && res.ok) {
        downloadAllBtn.textContent = `Saved ${res.okCount}/${res.total}`;
      } else {
        downloadAllBtn.textContent = "Failed";
      }
    } catch {
      downloadAllBtn.textContent = "Failed";
    } finally {
      usedOnlyEl.disabled = false;
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
        files: ["modules/fonts/collector.js"],
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

  usedOnlyEl.addEventListener("change", render);
  downloadAllBtn.addEventListener("click", downloadAll);
  scan();
}

export default {
  id: "fonts",
  label: "Fonts",
  // Universal fallback: any normal web page. `fallback` makes the shell try
  // specific modules first, so Fonts only runs when nothing else claims the page.
  // Restricted schemes are filtered out by the shell before matching runs.
  fallback: true,
  match: ({ url }) => /^https?:/i.test(url || ""),
  mount,
};
