#!/usr/bin/env bash
# dev-browser.sh — launch a throwaway test browser with Abseil already loaded unpacked.
#
# Why Chrome for Testing and not your normal Chrome: Google Chrome >= 137 IGNORES
# --load-extension, so a branded-Chrome launch opens a blank window with no extension. Chrome for
# Testing (same version line) still honours the flag. If none is installed we fetch one with
# @puppeteer/browsers, which drops it in ~/.cache/puppeteer/chrome/.
#
# The profile lives under ~/.cache (NOT in Dropbox — Chrome profiles churn constantly, and not
# inside this folder either, which Chrome loads as the extension). It persists, so Pinterest /
# Behance logins and the pinned toolbar icon survive restarts.
#
# Used by the Mission Control dashboard (`bash dev-browser.sh`, readiness probe on the CDP port);
# runs standalone just as well. Dev-only helper — exclude it when zipping for the Web Store.
set -euo pipefail

EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${ABSEIL_DEV_PROFILE:-$HOME/.cache/abseil-dev/profile}"
PORT="${ABSEIL_DEBUG_PORT:-9222}"
START_URL="${ABSEIL_START_URL:-https://www.pinterest.com/}"
CACHE="$HOME/.cache/puppeteer/chrome"

# Newest installed Chrome for Testing (version-sorted, so 150 beats 99).
find_chrome() {
  ls -d "$CACHE"/*/chrome-mac-*/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing" 2>/dev/null \
    | sort -V | tail -1
}

BIN="$(find_chrome)"
if [ -z "$BIN" ]; then
  echo "No Chrome for Testing in $CACHE — installing one (this downloads ~150MB)…"
  npx --yes @puppeteer/browsers install chrome@stable
  BIN="$(find_chrome)"
fi
if [ -z "$BIN" ]; then
  echo "Could not find or install Chrome for Testing." >&2
  echo "Install it manually:  npx @puppeteer/browsers install chrome@stable" >&2
  exit 1
fi

mkdir -p "$PROFILE"

# Every launch starts from the same two tabs. Without this, Chrome restores the previous session
# and the chrome://extensions tabs stack up run after run. Cookies/logins live elsewhere in the
# profile and are untouched; only the saved window/tab session is dropped.
PREFS="$PROFILE/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i '' -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/g' -e 's/"exited_cleanly":false/"exited_cleanly":true/g' "$PREFS" || true
fi
rm -rf "$PROFILE/Default/Sessions"

echo "browser:   $BIN"
echo "extension: $EXT_DIR"
echo "profile:   $PROFILE"
echo "devtools:  http://localhost:$PORT"

"$BIN" \
  --user-data-dir="$PROFILE" \
  --load-extension="$EXT_DIR" \
  --disable-extensions-except="$EXT_DIR" \
  --remote-debugging-port="$PORT" \
  --no-first-run \
  --no-default-browser-check \
  --hide-crash-restore-bubble \
  "$@" \
  "$START_URL" &
CHROME_PID=$!

# Chrome ignores chrome:// URLs passed on the command line, so open the extensions page over CDP
# once the browser is listening (skipping it if a restored session already has one). Non-fatal:
# a missing tab shouldn't take the browser down.
(
  for _ in $(seq 1 30); do
    if curl -sf -m 2 "http://localhost:$PORT/json/list" 2>/dev/null | grep -q '"url"'; then
      if curl -sf -m 2 "http://localhost:$PORT/json/list" 2>/dev/null | grep -q 'chrome://extensions'; then
        echo "chrome://extensions already open — hit Reload there after editing files."
      else
        curl -sf -m 3 -X PUT "http://localhost:$PORT/json/new?chrome://extensions" >/dev/null 2>&1 \
          && echo "opened chrome://extensions — hit Reload there after editing files."
      fi
      exit 0
    fi
    sleep 0.5
  done
  echo "browser never answered on :$PORT — open chrome://extensions yourself." >&2
) &

# Mission Control's Stop SIGTERMs the whole process group and stops escalating once THIS script
# exits — and Chrome's main process sometimes hangs after tearing its renderers down, orphaning a
# browser. So outlive it: on TERM, ask nicely, then SIGKILL what's left.
cleanup() {
  trap - TERM INT
  if kill -0 "$CHROME_PID" 2>/dev/null; then
    kill -TERM "$CHROME_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$CHROME_PID" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$CHROME_PID" 2>/dev/null; then
      echo "browser did not exit — SIGKILL"
      kill -KILL "$CHROME_PID" 2>/dev/null || true
    fi
  fi
  exit 0
}
trap cleanup TERM INT

# Quitting the browser window exits 0, which marks the card stopped.
set +e
wait "$CHROME_PID"
exit $?
