// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

const qs = new URLSearchParams(globalThis.location.search);
const MSGID = qs.get("id") || globalThis.close();

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

    await console.log(call);
  } catch (e) {
    if (DEBUG) console.error(e);

    globalThis.close();
  }
}

// -----------------------------------------------------------------------------
// reject
// -----------------------------------------------------------------------------
// deno-lint-ignore no-unused-vars
async function reject() {
  try {
    await console.log("rejected");

    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// accept
// -----------------------------------------------------------------------------
// deno-lint-ignore no-unused-vars
async function accept() {
  try {
    await console.log("accepted");

    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
