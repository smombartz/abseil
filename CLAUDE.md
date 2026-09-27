# Claude Instructions

## Project Overview

Abseil — one Chrome (Manifest V3) extension that pulls assets out of the current page. The popup shows the right tool for where you are. Unpacked extension, no build step; `./dev-browser.sh` launches Chrome for Testing with it loaded. See README.md.

**Key Features:**
- Pinterest board → download every pin at full resolution
- Behance project → download every project image at full resolution
- Any other site → Fonts tab (list/download woff2, woff, ttf, otf, eot) and Images tab (thumbnails, open or download)
- Pluggable capability modules in `modules/` (registered in `modules/registry.js`)

---

## Documentation

When new features, integrations, architecture decisions, or other noteworthy information comes up during work, document it in `docs/readme.md`. Keep it updated as a living reference for the project.

---

## Plans

All implementation plans must be saved to `docs/plans/`. Filenames must start with the date in `YYYY-MM-DD` format, followed by a descriptive name (e.g., `docs/plans/2026-03-27-auth-system.md`, `docs/plans/2026-03-27-cms-migration.md`). This ensures plans are versioned, reviewable, and accessible across sessions.

---

## Verification

**Visual/UI verification is the user's job — don't do it.** Do not start a
preview/dev server, drive a browser, or take screenshots to check how something
looks. The user runs their own dev server and verifies the UI themselves.
Functional/logic verification you *should* still do (type-check, lint, build,
and exercising behavior via `curl`/scripts against the running server is fine).
When a change is visually observable, finish your logic checks and hand it to
the user to look at rather than asking which browser to use.

---

## Logging Requirements

**CRITICAL:** For every code change or feature addition:

1. **Write a log entry** describing what was changed and why
2. **Save to `docs/log.md`** in the following format:

### Log Entry Format

```markdown
## [YYYY-MM-DD] - [Brief Change Title]

**What Changed:**
- Specific file(s) modified or created
- Description of the change

**Why:**
- Reason for the change (feature request, bug fix, refactor, etc.)

**Files Modified:**
- `path/to/file.ext`
- `path/to/file.ext`

---
```

### Example

```markdown
## 2026-03-27 - Added Parent Name field to notification form

**What Changed:**
- Added "Parent Name" input field to the email notification modal
- Updated `submitNotify()` to collect and send parent name to Google Apps Script

**Why:**
- Parents want to be identified when registering interest, not just by email

**Files Modified:**
- `index.html` - Added input field and updated form submission logic

---
```

### When to Log

Log entries are needed for:
- ✅ New features
- ✅ Bug fixes
- ✅ File modifications
- ✅ New file creation
- ✅ Schema/structure changes (e.g., adding columns to Google Sheet)

Don't log:
- ❌ Reading files to understand context
- ❌ Running tests/verification
- ❌ Responding to questions without code changes



### Workflow

1. **Make the code change(s)**
2. **Write the log entry** in the format above
3. **Append to `docs/log.md`**
4. **Inform the user** of what was done in your response

---

### How to Update `docs/log.md`

```javascript
// Pseudocode - in practice, use Read → Edit/Write
const logEntry = `
## [YYYY-MM-DD] - [Title]

**What Changed:**
- ...

**Why:**
- ...

**Files Modified:**
- ...

---
`;

// Append to docs/log.md
```

Always preserve existing log entries. New entries go at the **top** (most recent first) for easy scanning.

---

## Current Project State

### File Inventory


### Active Features
