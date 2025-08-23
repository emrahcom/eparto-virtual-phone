// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG, WATCH_PERIOD_INTEXT } from "../lib/config.js";
import { getByKey, safeText } from "../lib/common.js";

const qs = new globalThis.URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
globalThis.setTimeout(watchText, WATCH_PERIOD_INTEXT);

// -----------------------------------------------------------------------------
// watchText
// -----------------------------------------------------------------------------
async function watchText() {
  try {
    // Get the text object again from the backend.
    const text = await getText();

    // If it doesn't exist, this means that it has been deleted on the
    // server-side.
    if (!text) throw "missing incoming text object";

    // Dont continue if another client has handled the text.
    if (text.status !== "none") throw "already processed by another client";

    // Dont continue if it is expired. Expiration happens when the text is not
    // seen for a long time by any client.
    const expiredAt = new Date(text.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time for incoming text";
    if (Date.now() > expiredAt.getTime()) throw "expired incoming text";

    // Check it again after a while.
    globalThis.setTimeout(watchText, WATCH_PERIOD_INTEXT);
  } catch {
    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// getText
// -----------------------------------------------------------------------------
async function getText() {
  const payload = {
    id: MSGID,
  };

  // Return value will be a list with a single object or an empty list.
  const texts = await getByKey(`/api/pub/intercom/get/bykey`, payload);

  return texts[0];
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
initialize();

// -----------------------------------------------------------------------------
// initialize
// -----------------------------------------------------------------------------
async function initialize() {
  try {
    // Get the text object from the storage. The service worker saves it into
    // the storage before opening this popup.
    const storedItems = await chrome.storage.session.get(`intext-${MSGID}`);
    const text = storedItems[`intext-${MSGID}`];
    if (!text) throw "missing incoming text object (initializing)";

    // Initialize UI.
    initializeText(text);

    // Play the notification sound.
    const notification = globalThis.document.getElementById("notification");
    if (notification) notification.play();
  } catch (e) {
    if (DEBUG) console.error(e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// initializeText
// -----------------------------------------------------------------------------
function initializeText(text) {
  // Name of the contact (sender).
  const contactName = text?.contact_name;
  if (!contactName) throw "missing contact name";

  // Update the window title, show the name of the contact as title.
  globalThis.document.title = safeText(contactName);

  // Update the contact name in UI.
  const el = globalThis.document.getElementById("contact");
  if (el) el.textContent = contactName;
}
