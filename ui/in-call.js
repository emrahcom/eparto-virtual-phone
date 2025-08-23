// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG, WATCH_PERIOD_INCALL } from "../lib/config.js";
import {
  getByKey,
  getSessionObject,
  safeText,
  setStatus,
} from "../lib/common.js";

const qs = new globalThis.URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

let CALL_URL;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
globalThis.setTimeout(watchCall, WATCH_PERIOD_INCALL);

// -----------------------------------------------------------------------------
// watchCall
// -----------------------------------------------------------------------------
async function watchCall() {
  try {
    // Get the call object again from the backend.
    const call = await getCall();

    // If it doesn't exist, this means that it has been ended by the caller.
    if (!call) throw "missing incoming call object";

    // Dont continue if another client has handled the call.
    if (call.status !== "none") throw "already processed by another client";

    // Dont continue if it is expired. Expiration happens when the call is not
    // terminated properly by the caller. For example, if she closes her
    // browser directly without cancelling the call...
    const expiredAt = new Date(call.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time for incoming call";
    if (Date.now() > expiredAt.getTime()) throw "expired incoming call";

    // Check it again after a while.
    globalThis.setTimeout(watchCall, WATCH_PERIOD_INCALL);
  } catch {
    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// getCall
// -----------------------------------------------------------------------------
async function getCall() {
  const payload = {
    id: MSGID,
  };

  // Return value will be a list with a single object or an empty list.
  const calls = await getByKey(`/api/pub/intercom/get/bykey`, payload);

  return calls[0];
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
const rejectButton = globalThis.document.getElementById("reject");
rejectButton.addEventListener("click", rejectCall);

const acceptButton = globalThis.document.getElementById("accept");
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
    // Get the call object from the storage. The service worker saves it into
    // the storage before opening this popup.
    const call = await getSessionObject(`incall-${MSGID}`);
    if (!call) throw "missing incoming call object (initializing)";

    // Initialize UI depending on the call type.
    if (call.message_type === "call") {
      initializeCall(call);
    } else if (call.message_type === "phone") {
      initializePhone(call);
    } else {
      throw "unknown call type";
    }

    // Start ringing.
    const ring = globalThis.document.getElementById("ring");
    if (ring) ring.play();
  } catch (e) {
    if (DEBUG) console.error(e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// initializeCall (Direct call from a contact)
// -----------------------------------------------------------------------------
function initializeCall(call) {
  // URL of the conference room with member token (if needed).
  CALL_URL = call?.intercom_attr?.url;
  if (!CALL_URL) throw "missing call url";

  // Name of the contact (caller).
  const contactName = call?.contact_name;
  if (!contactName) throw "missing contact name";

  // Update the window title, show the name of the contact as title.
  globalThis.document.title = safeText(contactName);

  // Update the contact name in UI.
  const el = globalThis.document.getElementById("contact");
  if (el) el.textContent = contactName;

  // Hide phone-info
  const phoneDiv = globalThis.document.getElementById("phone-info");
  if (phoneDiv) phoneDiv.style.display = "none";

  // Show call-info
  const callDiv = globalThis.document.getElementById("call-info");
  if (callDiv) callDiv.style.display = "flex";
}

// -----------------------------------------------------------------------------
// initializePhone (Public call from a virtual public phone)
// -----------------------------------------------------------------------------
function initializePhone(call) {
  // URL of the conference room with moderator token (if needed).
  CALL_URL = call?.intercom_attr?.owner_url;
  if (!CALL_URL) throw "missing call url";

  // Name of ringing public phone.
  const phoneName = call?.intercom_attr?.phone_name;
  if (!phoneName) throw "missing phone name";

  // Update the window title, show the name of the public phone as title.
  globalThis.document.title = safeText(phoneName);

  // Update the phone name in UI.
  const el = globalThis.document.getElementById("phone");
  if (el) el.textContent = phoneName;

  // Show phone-info
  const phoneDiv = globalThis.document.getElementById("phone-info");
  if (phoneDiv) phoneDiv.style.display = "flex";

  // Hide call-info
  const callDiv = globalThis.document.getElementById("call-info");
  if (callDiv) callDiv.style.display = "none";
}

// -----------------------------------------------------------------------------
// reject
// -----------------------------------------------------------------------------
async function rejectCall() {
  try {
    // Set intercom status as rejected.
    await setStatus(MSGID, "rejected");

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
    const res = await setStatus(MSGID, "accepted");

    // Open the conference room in a new tab. The caller will also join this
    // conference room when she receives "call is accepted" message.
    if (res) globalThis.open(CALL_URL, "_blank");

    // Close the popup.
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
