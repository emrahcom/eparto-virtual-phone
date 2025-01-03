// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

const qs = new URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

let CALL_URL;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
setTimeout(watchCall, 1000);

async function watchCall() {
  try {
    // Get the call object from the storage. The background script saves and
    // keep it up-to-date.
    const storedItems = await chrome.storage.session.get(`call-${MSGID}`);
    const call = storedItems[`call-${MSGID}`];

    if (!call) throw "missing call object";
    if (call.status !== "none") throw "already processed by another client";

    const expiredAt = new Date(call.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) throw "expired call";

    // Check it again after a while. The background script updates it if its
    // status changes.
    setTimeout(watchCall, 500);
  } catch (e) {
    if (DEBUG) console.error(e);

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
    if (!call) throw "missing call object";

    // URL of the call with moderator token.
    CALL_URL = call?.intercom_attr?.owner_url;
    if (!CALL_URL) throw "missing call url";

    // Name of ringing public phone.
    const phoneName = call?.intercom_attr?.phone_name;
    if (!phoneName) return;

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
    await console.log("rejected");

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
    await console.log("accepted");

    // Open the call in a new tab.
    globalThis.open(CALL_URL, "_blank");

    // Close the popup.
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
