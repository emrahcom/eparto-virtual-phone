// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { getByCode } from "../lib/common.js";

const DEBUG = true;

const qs = new URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

let CALL_URL;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
setTimeout(watchCall, 1000);

// -----------------------------------------------------------------------------
// watchCall
// -----------------------------------------------------------------------------
async function watchCall() {
  try {
    // Get the call object from the storage. The background script saves it and
    // keeps it up-to-date.
    const storedItems = await chrome.storage.session.get(`call-${MSGID}`);
    const call = storedItems[`call-${MSGID}`];

    // If it doesn't exist, this means that it has been ended by the caller.
    if (!call) throw "missing call object";

    // Dont continue if another client has handled the call.
    if (call.status !== "none") throw "already processed by another client";

    // Dont continue if it is expired. Expiration happens when the call is not
    // ended properly by the caller. For example, if she closes her browser
    // directly without canceling the call...
    const expiredAt = new Date(call.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) throw "expired call";

    // Check it again after a while. The background script will update its
    // status if its status changes.
    setTimeout(watchCall, 500);
  } catch (_e) {
    //if (DEBUG) console.error(_e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
const rejectButton = document.getElementById("reject");
rejectButton.addEventListener("click", rejectCall);

const acceptButton = document.getElementById("accept");
acceptButton.addEventListener("click", acceptCall);

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
initialize();

// -----------------------------------------------------------------------------
// initialize
// -----------------------------------------------------------------------------
async function initialize() {
  try {
    // Get the call object from the storage. The background script saves it into
    // the storage before opening this popup.
    const storedItems = await chrome.storage.session.get(`call-${MSGID}`);
    const call = storedItems[`call-${MSGID}`];
    if (!call) throw "missing call object (initizaling)";

    // URL of the conference room with moderator token.
    CALL_URL = call?.intercom_attr?.owner_url;
    if (!CALL_URL) throw "missing call url";

    // Name of ringing public phone.
    const phoneName = call?.intercom_attr?.phone_name;
    if (!phoneName) throw "missing phone name";

    // Update the window title, show the name of the public phone as title.
    document.title = phoneName;

    // Update the phone name in UI.
    const el = document.getElementById("phone");
    if (el) el.textContent = phoneName;

    // Start ringing.
    const ring = document.getElementById("ring");
    if (ring) ring.play();
  } catch (e) {
    if (DEBUG) console.error(e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// reject
// -----------------------------------------------------------------------------
async function rejectCall() {
  try {
    // Set intercom status as rejected.
    await setStatus("rejected");

    // Close the popup.
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// accept
// -----------------------------------------------------------------------------
async function acceptCall() {
  try {
    // Set intercom status as accepted.
    const res = await setStatus("accepted");

    // Open the conference room in a new tab. The caller will also join this
    // conference room when she receives "call is accepted" message.
    if (res) globalThis.open(CALL_URL, "_blank");

    // Close the popup.
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// setStatus (inform the caller about the action taken)
// -----------------------------------------------------------------------------
async function setStatus(status) {
  const payload = {
    id: MSGID,
  };

  return await getByCode(`api/pub/intercom/set/${status}`, payload);
}
