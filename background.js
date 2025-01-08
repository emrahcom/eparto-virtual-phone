// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { getByKey } from "./lib/common.js";

const DEBUG = true;

// Expire time in minute for incoming call.
const INCALL_EXPIRE_TIME = 1;
// Expire time in minute for outgoing call.
const OUTCALL_EXPIRE_TIME = 0.5;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
// Ping (update presence).
chrome.alarms.create("ping", {
  periodInMinutes: 1,
});

// Poll intercom messages.
chrome.alarms.create("intercomMessages", {
  periodInMinutes: 0.035,
});

// Alarm listeners.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "ping") {
    ping();
  } else if (alarm.name === "intercomMessages") {
    // Known issue: if this alarm ends after the next alarm because of some
    // network issues then the old message will overwrite the new one but dont
    // fix, skip it.
    const messages = await getIntercomMessages();
    if (messages) messageHandler(messages);
  } else if (alarm.name.startsWith("cleanup-incall-")) {
    const msgId = alarm.name.substr(15);
    cleanupInCall(msgId);
  } else if (alarm.name.startsWith("cleanup-outcall-")) {
    const callId = alarm.name.substr(16);
    cleanupOutCall(callId);
  } else if (alarm.name.startsWith("ring-outcall-")) {
    const callId = alarm.name.substr(13);
    ringOutCall(callId);
  }
});

// -----------------------------------------------------------------------------
// onMessage (internal messages)
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "start-outcall") {
    startOutCall(msg);
  }
});

// -----------------------------------------------------------------------------
// initial
// -----------------------------------------------------------------------------
ping();

// -----------------------------------------------------------------------------
// ping
// -----------------------------------------------------------------------------
async function ping() {
  return await getByKey("/api/pub/identity/ping/bykey");
}

// -----------------------------------------------------------------------------
// getIntercomMessages
// -----------------------------------------------------------------------------
async function getIntercomMessages() {
  return await getByKey("/api/pub/intercom/list");
}

// -----------------------------------------------------------------------------
// messageHandler
// -----------------------------------------------------------------------------
function messageHandler(messages) {
  try {
    if (!messages) throw "missing message list";
    if (!Array.isArray(messages)) throw "invalid structure for message list";

    removeOldMessagesFromStorage(messages);

    if (!messages.length) return;

    for (const msg of messages) {
      if (msg?.message_type === "call") {
        callMessageHandler(msg);
      } else if (msg?.message_type === "phone") {
        phoneMessageHandler(msg);
      }
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// removeOldMessagesFromStorage
// -----------------------------------------------------------------------------
async function removeOldMessagesFromStorage(messages) {
  try {
    // List ids of active messages.
    const ids = messages.map((msg) => msg.id);

    // Trace stored messages and remove it if it is not in the id list. This
    // means that this message is removed by its owner on the server-side.
    for (const key of await chrome.storage.session.getKeys()) {
      if (!key.startsWith("incall-")) continue;

      const msgId = key.substr(5);
      if (ids.includes(msgId)) continue;

      await chrome.storage.session.remove(`incall-${msgId}`);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// callMessageHandler
// -----------------------------------------------------------------------------
async function callMessageHandler(msg) {
  try {
    const msgId = msg?.id;
    if (!msgId) throw "missing message id";

    // Is there already a session object for this call?
    // Be carefull, the return value is a list, not a single item...
    const storedItems = await chrome.storage.session.get(`incall-${msgId}`);
    const storedItem = storedItems[`incall-${msgId}`];

    // Create or update (if already exists) the session object.
    // Be carefull, key will not be generated dynamically if it is not in [].
    const item = {
      [`incall-${msgId}`]: msg,
    };
    await chrome.storage.session.set(item);

    // If this is the first message of the incoming call then initialize the
    // call. Initializing means create its popup, trigger its cleanup job, etc.
    if (!storedItem) initializeInCall(msg);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// phoneMessageHandler (alias for callMessageHandler)
// -----------------------------------------------------------------------------
async function phoneMessageHandler(msg) {
  await callMessageHandler(msg);
}

// -----------------------------------------------------------------------------
// initializeInCall
//
// This function is for initializing incoming direct calls and phone calls.
// All attributes are expected to be exist at this stage. Fail if they dont.
// -----------------------------------------------------------------------------
function initializeInCall(msg) {
  try {
    // Trigger the cleanup job which will remove the incoming call objects after
    // a while.
    triggerCleanupInCall(msg.id);

    // Cancel if the status is not "none". This means that the call is already
    // processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") return;

    // Cancel if the call is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) return;

    // Create the incoming call popup and show it.
    chrome.windows.create({
      url: chrome.runtime.getURL(
        `ui/in-${msg.message_type}.html?id=${msg.id}`,
      ),
      type: "popup",
      focused: true,
      width: 320,
      height: 120,
    });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// triggerCleanupInCall
// -----------------------------------------------------------------------------
function triggerCleanupInCall(msgId) {
  try {
    // Remove all objects related with this incoming call after the expire time.
    // There is no problem if the browser is closed before this is done, because
    // there are only session objects which will be removed anyway after the
    // session.
    chrome.alarms.create(`cleanup-incall-${msgId}`, {
      delayInMinutes: INCALL_EXPIRE_TIME,
    });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupInCall
// -----------------------------------------------------------------------------
async function cleanupInCall(msgId) {
  try {
    if (!msgId) throw "missing message id";

    await chrome.storage.session.remove(`incall-${msgId}`);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// startOutCall
//
// ui/contact.js triggers this function when the user clicks the phone button.
// -----------------------------------------------------------------------------
async function startOutCall(call) {
  try {
    // Trigger the cleanup job which will remove the outgoing call objects after
    // a while. This will also end the call if there is no answer yet.
    triggerCleanupOutCall(call.id);

    // Save id of the active call as contact value. So, it is possible to find
    // if there is an active call in the background for this contact. UI needs
    // this value to update the call status on UI.
    const item = {
      [`contact-${call.contact_id}`]: call.id,
    };
    await chrome.storage.session.set(item);

    // Save the call object.
    const callItem = {
      [`outcall-${call.id}`]: call,
    };
    await chrome.storage.session.set(callItem);

    // Trigger the ringing loop.
    triggerOutCallRing(call.id);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// triggerCleanupOutCall
// -----------------------------------------------------------------------------
function triggerCleanupOutCall(callId) {
  try {
    // Remove all objects related with this outgoing call after the expire time.
    // This will also end the call if there is no answer yet.
    //
    // There is no problem if the browser is closed before this is done,
    // because there are only session objects which will be removed anyway after
    // the session.
    chrome.alarms.create(`cleanup-outcall-${callId}`, {
      delayInMinutes: OUTCALL_EXPIRE_TIME,
    });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupOutCall
// -----------------------------------------------------------------------------
async function cleanupOutCall(callId) {
  try {
    if (!callId) throw "missing call id";

    // Get stored call object. ringOutCall deletes the call object before the
    // expire time if it is already answered by other peer.
    let storedItems = await chrome.storage.session.get(`outcall-${callId}`);
    const call = storedItems[`outcall-${callId}`];
    if (!call) return;

    // Remove the outgoing call object, expired.
    await chrome.storage.session.remove(`outcall-${callId}`);

    // Send a notification to the callee about the missing call.
    const payload = {
      id: call.id,
    };
    await getByKey("/api/pub/intercom/del-with-notification", payload);

    // Reset the active call value if it keeps this call id. If the active call
    // for the related contact is not this call then dont reset the value. This
    // means that a new call is stated for this contact and will be handled in
    // another thread.
    const contactId = call.contact_id;
    storedItems = await chrome.storage.session.get(`contact-${contactId}`);
    const activeCall = storedItems[`contact-${contactId}`];

    if (activeCall === callId) {
      await chrome.storage.session.remove(`contact-${contactId}`);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// triggerOutCallRing
// -----------------------------------------------------------------------------
function triggerOutCallRing(callId) {
  try {
    chrome.alarms.create(`ring-outcall-${callId}`, { delayInMinutes: 0.02 });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// ringOutCall
// -----------------------------------------------------------------------------
async function ringOutCall(callId) {
  try {
    if (!callId) throw "missing call id";

    // Get stored call object. cleanupOutCall deletes the call object if it
    // is expired. So, no needs to ring anymore if this is the case.
    let storedItems = await chrome.storage.session.get(`outcall-${callId}`);
    const call = storedItems[`outcall-${callId}`];
    if (!call) return;

    // Get the active call.
    storedItems = await chrome.storage.session.get(
      `contact-${call.contact_id}`,
    );
    const activeCall = storedItems[`contact-${call.contact_id}`];

    // Stop ringing if this call is not active anymore. This happens when it is
    // stopped on UI.
    if (activeCall !== call.id) return;

    // Ring and handle the ring status. The response contains the latest status
    // depending on the answer from the other peer.
    const payload = {
      id: call.id,
    };
    const ring = await getByKey("/api/pub/intercom/call/ring", payload);

    handleRingStatus(ring, callId);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// handleRingStatus
// -----------------------------------------------------------------------------
async function handleRingStatus(ring, call) {
  try {
    // Ring again after a while if still no response from the peer.
    if (ring.status === "none" || ring.status === "seen") {
      chrome.alarms.create(`ring-outcall-${call.id}`, { delayInMinutes: 0.02 });
      return;
    }

    // Delete the call objects if it is accepted or rejected by other peer.
    await chrome.storage.session.remove(`outcall-${call.id}`);
    await chrome.storage.session.remove(`contact-${call.contact_id}`);

    const payload = {
      id: call.id,
    };
    await getByKey("/api/pub/intercom/del", payload);

    // Go to the meeting room if accepted.
    if (ring.status === "accepted") {
      globalThis.open(call.url, "_blank");
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
