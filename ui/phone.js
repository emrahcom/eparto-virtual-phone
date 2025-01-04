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
    // Set intercom status as accepted.
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

    // Open the call in a new tab.
    if (res) globalThis.open(CALL_URL, "_blank");

    // Close the popup.
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// setStatus (inform the caller about your response)
// -----------------------------------------------------------------------------
async function setStatus(status) {
  try {
    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const code = storedPrivateKeys["private-key"];
    if (!code) throw "missing private key (code)";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"];
    if (!baseUrl) throw "missing base url";

    const url = `${baseUrl}/api/pub/intercom/set/${status}`;
    const payload = {
      code: code,
      id: MSGID,
    };

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      method: "post",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw "failed request";

    return await res.json();
  } catch (e) {
    if (DEBUG) console.error(e);

    return undefined;
  }
}
