// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  WATCH_DELAY_INTEXT,
  WATCH_PERIOD_INTEXT,
} from "../lib/config.js";
import {
  displayLocalTime,
  getByKey,
  getSessionObject,
  safeText,
} from "../lib/common.js";

const qs = new globalThis.URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
globalThis.setTimeout(watchText, WATCH_DELAY_INTEXT);

// -----------------------------------------------------------------------------
// watchText
// -----------------------------------------------------------------------------
async function watchText() {
  try {
    // Get the text object from the backend.
    // If this object is not available then the return value will be undefined.
    // If there is a network or config error then the return value will be null.
    const text = await getText();

    // If there is a temporary network issue then try again after a while.
    if (text === null) {
      globalThis.setTimeout(watchText, WATCH_PERIOD_INTEXT);
      return;
    }

    // If it doesn't exist (undefined), this means that it has been deleted on
    // the backend.
    if (!text) throw "missing incoming text object";

    // Dont continue if another client has already handled the text.
    if (text.status !== "none") throw "already processed by another client";

    // Dont continue if it is expired. Expiration happens when the text is not
    // seen for a long time by any client.
    const expiredAt = new Date(text.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time for incoming text";
    if (Date.now() > expiredAt.getTime()) throw "expired incoming text";

    // Check it again after a while since the text is not seen yet by any
    // client.
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
  if (texts) return texts[0];

  // Since no list, most probably there is temporary network or config issue.
  return null;
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
    // Get the text object from the storage. The service worker saved it into
    // the storage before opening this popup.
    const text = await getSessionObject(`intext-${MSGID}`);
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
  const contactName = text.contact_name;
  if (!contactName) throw "missing contact name";

  // Update the window title, show the name of the contact as title.
  globalThis.document.title = safeText(contactName);

  // Update the contact name in UI.
  const elContact = globalThis.document.getElementById("contact");
  if (elContact) elContact.textContent = contactName;

  // Update the description in UI, display the time.
  const elDesc = globalThis.document.getElementById("desc");
  if (elDesc) elDesc.textContent = displayLocalTime(text.created_at);

  // Update the message in UI.
  const elMessage = globalThis.document.getElementById("message");
  if (elMessage) elMessage.textContent = text.intercom_attr.message;
}
