// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG } from "../common/config.js";
import { getByKey, safeText } from "../common/function.js";

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
    // Get the call object from the storage. The service worker saves it and
    // keeps it up-to-date.
    const storedItems = await chrome.storage.session.get(`incall-${MSGID}`);
    const call = storedItems[`incall-${MSGID}`];

    // If it doesn't exist, this means that it has been ended by the caller.
    if (!call) throw "missing incoming call object";

    // Dont continue if another client has handled the call.
    if (call.status !== "none") throw "already processed by another client";

    // Dont continue if it is expired. Expiration happens when the call is not
    // ended properly by the caller. For example, if she closes her browser
    // directly without cancelling the call...
    const expiredAt = new Date(call.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time for incoming call";
    if (Date.now() > expiredAt.getTime()) throw "expired incoming call";

    // Check it again after a while. The service worker will update its status
    // if its status changes.
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
    // Get the call object from the storage. The service worker saves it into
    // the storage before opening this popup.
    const storedItems = await chrome.storage.session.get(`incall-${MSGID}`);
    const call = storedItems[`incall-${MSGID}`];
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
    const ring = document.getElementById("ring");
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
  document.title = safeText(contactName);

  // Update the contact name in UI.
  const el = document.getElementById("contact");
  if (el) el.textContent = contactName;

  // Hide phone-info
  const phoneDiv = document.getElementById("phone-info");
  if (phoneDiv) phoneDiv.style.display = "none";

  // Show call-info
  const callDiv = document.getElementById("call-info");
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
  document.title = safeText(phoneName);

  // Update the phone name in UI.
  const el = document.getElementById("phone");
  if (el) el.textContent = phoneName;

  // Show phone-info
  const phoneDiv = document.getElementById("phone-info");
  if (phoneDiv) phoneDiv.style.display = "flex";

  // Hide call-info
  const callDiv = document.getElementById("call-info");
  if (callDiv) callDiv.style.display = "none";
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

  return await getByKey(`/api/pub/intercom/set/${status}/bykey`, payload);
}
