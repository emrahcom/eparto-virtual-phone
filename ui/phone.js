// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

const qs = new URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();
let SELECTED_ACTION;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
setTimeout(watchCall, 1000);

async function watchCall() {
  try {
    const storedItems = await chrome.storage.session.get(`call-${MSGID}`);
    const call = storedItems[`call-${MSGID}`];

    if (!call) throw "missing call object";
    if (call.status !== "none") throw "already processed by another client";

    const expiredAt = new Date(call.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) throw "expired call";

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
rejectButton.addEventListener("click", reject);

const acceptButton = document.getElementById("accept");
acceptButton.addEventListener("click", accept);

globalThis.addEventListener("beforeunload", close);

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
updateUi();

// -----------------------------------------------------------------------------
// updateUi
// -----------------------------------------------------------------------------
async function updateUi() {
  try {
    const storedItems = await chrome.storage.session.get(`call-${MSGID}`);
    const call = storedItems[`call-${MSGID}`];
    if (!call) throw "missing call object";

    const phoneName = call?.intercom_attr?.phone_name;
    if (!phoneName) return;

    const el = document.getElementById("phone");
    if (!el) return;

    el.textContent = phoneName;
  } catch (e) {
    if (DEBUG) console.error(e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// reject
// -----------------------------------------------------------------------------
async function reject() {
  try {
    await console.log("rejected");

    SELECTED_ACTION = "reject";
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// accept
// -----------------------------------------------------------------------------
async function accept() {
  try {
    await console.log("accepted");

    SELECTED_ACTION = "accept";
    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// close
// -----------------------------------------------------------------------------
async function close() {
  try {
    if (SELECTED_ACTION) return;

    await console.log("close");
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
