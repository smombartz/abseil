// Abseil — unified service worker.
//
// Each capability ("module") owns a background handler. Messages are namespaced
// with a `module` field so a single router can dispatch to the right one and
// modules never collide on message `type`s. Adding a future capability (e.g. a
// Behance image downloader) means dropping in one more handler and registering
// it in the table below — nothing else here changes.

import * as fonts from "./modules/fonts/background.js";
import * as pinterest from "./modules/pinterest/background.js";
import * as behance from "./modules/behance/background.js";

// module id -> handle(msg, sender, sendResponse) => true if it will respond async
const HANDLERS = {
  fonts: fonts.handle,
  pinterest: pinterest.handle,
  behance: behance.handle,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  const handle = HANDLERS[msg.module];
  if (!handle) return;
  // A handler returns true to keep the message channel open for an async reply.
  return handle(msg, sender, sendResponse);
});
