# Claude Instructions

These are general working rules, the same in every project. Nothing in this file is specific to
this project, so it can be replaced as a whole when the rules are updated.

## Project

Everything specific to this project (what it is, how it's built, its commands and its own rules)
lives in `PROJECT.md`, imported below. Where `PROJECT.md` and the general rules here disagree,
`PROJECT.md` wins.

@PROJECT.md

**Keep this file general.** When something comes up that Claude should know in every session of
this project (a convention, a command, a rule), add it to `PROJECT.md`, never here.

---

## Documentation

When new features, integrations, architecture decisions, or other noteworthy information comes up during work, document it in `docs/reference.md`. Keep it updated as a living reference for the project.

`docs/reference.md` is only opened when needed, but `PROJECT.md` is loaded into every session, so keep it
short and put only what Claude must always know there.

---

## Plans

**Every plan gets saved to `docs/plans/`, no exceptions.** Whenever Claude makes a plan (in plan
mode, via a planning skill, or when laying out a multi-step approach before implementing), write it
to `docs/plans/` as a Markdown file **before** starting the work, including a plan that was only
presented in chat or approved through plan mode's exit prompt.

- **Filename:** start with the date in `YYYY-MM-DD` format, followed by a descriptive name (e.g.,
  `docs/plans/2026-03-27-auth-system.md`, `docs/plans/2026-03-27-cms-migration.md`).
- **Keep it current:** the plan file is a living document. Whenever the plan changes (the user
  revises scope, an approach is dropped, steps are added, reordered or completed, or implementation
  reveals something that changes the design), update the same file in the same turn. Don't start a
  new file for a revision of the same plan; mark finished steps done and note significant changes
  and why in a short "Changes" section at the bottom.
- **One source of truth:** if the plan-mode plan file lives elsewhere (e.g. `~/.claude/plans/`),
  copy it into `docs/plans/` and keep the `docs/plans/` copy updated from then on.

This keeps plans versioned, reviewable, and accessible across sessions.

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

**Session:** `[Claude Code session ID]`

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

**Session:** `3f1c9a2e-7b4d-4e8a-9c61-0d2b5e7f8a14`

**What Changed:**
- Added "Parent Name" input field to the email notification modal
- Updated `submitNotify()` to collect and send parent name to Google Apps Script

**Why:**
- Parents want to be identified when registering interest, not just by email

**Files Modified:**
- `index.html` - Added input field and updated form submission logic

---
```

### Session ID

Put the Claude Code session ID on the `**Session:**` line so every entry can be traced back to the
conversation that made it. Read it from the environment with `echo $CLAUDE_CODE_SESSION_ID`.

- **Reopen the session:** `claude --resume <id>` from the project folder.
- **Read the transcript:** `~/.claude/projects/<project-path-slug>/<id>.jsonl`.
- **When unavailable:** if the variable is empty or unset, leave the `**Session:**` line out.
  Never guess or invent an ID.

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

**Session:** \`${process.env.CLAUDE_CODE_SESSION_ID}\`

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
