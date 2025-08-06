// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  INCALL_EXPIRE_TIME,
  OUTCALL_EXPIRE_TIME,
} from "./common/config.js";
import { getByKey } from "./common/function.js";

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
// Ping (update presence).
chrome.alarms.create("ping", {
  periodInMinutes: 1,
});

// Poll intercom messages. Create the following alarm when the triggered alarm
// starts. Because Chrome doesn't allow periodInMinutes to be less than 30 sec.
// https://developer.chrome.com/docs/extensions/reference/api/alarms
chrome.alarms.create("intercomMessages", {
  delayInMinutes: 0.030,
});

// Alarm listeners.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "ping") {
    ping();
  } else if (alarm.name === "intercomMessages") {
    // Before getting intercom messages, create the following alarm.
    chrome.alarms.create("intercomMessages", {
      delayInMinutes: 0.030,
    });

    // Known issue: if this alarm ends after the next alarm because of some
    // network issues then the old message will overwrite the new one but dont
    // fix, skip it.
    const messages = await getIntercomMessages();
    if (messages) messageHandler(messages);
  } else if (alarm.name.startsWith("cleanup-incall-")) {
    const msgId = alarm.name.substr("cleanup-incall-".length);
    cleanupInCall(msgId);
  } else if (alarm.name.startsWith("cleanup-outcall-")) {
    const callId = alarm.name.substr("cleanup-outcall-".length);
    cleanupOutCall(callId);
  } else if (alarm.name.startsWith("ring-outcall-")) {
    const callId = alarm.name.substr("ring-outcall-".length);
    ringOutCall(callId);
  }
});

// -----------------------------------------------------------------------------
// onMessage (internal messages)
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "start-outcall") {
    // Contact page sends this message when the user clicks the phone button.
    startOutCall(msg);
  }
});

// -----------------------------------------------------------------------------
// initial
// -----------------------------------------------------------------------------
// This is the initial ping which will update the user presence on the
// server-side. There is also an alarm which runs the ping function
// periodically.
ping();

// -----------------------------------------------------------------------------
// ping
// -----------------------------------------------------------------------------
async function ping() {
  // Update the user presence on the server-side to inform contacts.
  return await getByKey("/api/pub/identity/ping/bykey");
}

// -----------------------------------------------------------------------------
// getIntercomMessages
// -----------------------------------------------------------------------------
async function getIntercomMessages() {
  // Poll intercom messages from the server. This function is triggered by an
  // alarm periodically.
  return await getByKey("/api/pub/intercom/list/bykey");
}

// -----------------------------------------------------------------------------
// messageHandler
// -----------------------------------------------------------------------------
function messageHandler(messages) {
  try {
    if (!messages) throw "missing message list";
    if (!Array.isArray(messages)) throw "invalid structure for message list";

    // If a message doesn't exist on the server-side anymore then remove its
    // local copy. This happens when the message is dropped by its initiator.
    removeOldObjects(messages);

    if (!messages.length) return;

    // Process messages depending on their types.
    for (const msg of messages) {
      if (msg?.message_type === "call") {
        callMessageHandler(msg);
      } else if (msg?.message_type === "phone") {
        phoneMessageHandler(msg);
      } else if (msg?.message_type === "text") {
        textMessageHandler(msg);
      }
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// removeOldObjects
// -----------------------------------------------------------------------------
async function removeOldObjects(messages) {
  try {
    // List ids of active messages. Messages is the list received from the
    // server.
    const ids = messages.map((msg) => msg.id);

    // Trace stored local objects and remove it if it is not in the id list.
    // This means that this message is removed by its initiator on the
    // server-side.
    for (const key of await chrome.storage.session.getKeys()) {
      if (key.startsWith("incall-")) {
        const msgId = key.substr("incall-".length);

        // Skip it if still exists on the server-side.
        if (ids.includes(msgId)) continue;

        // Remove the local copy of the message since it doesnt exist in list.
        await chrome.storage.session.remove(`incall-${msgId}`);
      } else if (key.startsWith("intext-")) {
        const msgId = key.substr("intext-".length);

        // Skip it if still exists on the server-side.
        if (ids.includes(msgId)) continue;

        // Remove the local copy of the message since it doesnt exist in list.
        await chrome.storage.session.remove(`intext-${msgId}`);
      }
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

    // If this is the first message of the incoming call then start the call.
    // This means creating its popup, triggering its cleanup job, etc.
    if (!storedItem) startInCall(msg);
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
// startInCall
//
// This function is for initializing incoming direct calls and incoming phone
// calls. All attributes are expected to be exist at this stage. Fail if they
// dont.
// -----------------------------------------------------------------------------
function startInCall(msg) {
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

    // Save the call object into the local storage.
    const callItem = {
      [`outcall-${call.id}`]: call,
    };
    await chrome.storage.session.set(callItem);

    // Trigger ring loop.
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
    // expire time if answered by other peer or ended by the caller. So, there
    // is no need to clean up in this case.
    let storedItems = await chrome.storage.session.get(`outcall-${callId}`);
    const call = storedItems[`outcall-${callId}`];
    if (!call) return;

    // Remove the local copy of the outgoing call, expired.
    await chrome.storage.session.remove(`outcall-${callId}`);

    // Remove the call object on server-side with a notification to the callee
    // about the expired call. Currently the callee is informed by an email
    // about the missing call.
    const payload = {
      id: callId,
    };
    await getByKey("/api/pub/intercom/del-with-notification/bykey", payload);

    const contactId = call.contact_id;

    // Reset the active call value if it has this call id. If the active call
    // for the related contact is not this call then dont reset the value. This
    // means that a new call is started for this contact and will be handled in
    // another thread.
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
    // Trigger ring loop.
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

    // End the call if this call is not active anymore. This happens when it is
    // stopped on UI by the user.
    if (activeCall !== callId) {
      await endCall(callId);
      return;
    }

    // Ring and handle the returned ring status. The response contains the
    // latest status depending on the answer from other peers. Expected return
    // value is an array with a single element. This single element is the
    // intercom object.
    const payload = {
      id: callId,
    };
    const rings = await getByKey("/api/pub/intercom/call/ring/bykey", payload);
    const ring = rings[0];

    await handleRingStatus(ring, call);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// endCall
// -----------------------------------------------------------------------------
async function endCall(callId) {
  try {
    // Delete the local copy of the call object.
    await chrome.storage.session.remove(`outcall-${callId}`);

    // Remove the call object on server-side with a notification to the callee
    // about the expired call. Currently the callee is informed by an email
    // about the missing call.
    const payload = {
      id: callId,
    };
    await getByKey("/api/pub/intercom/del-with-notification/bykey", payload);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// handleRingStatus
// -----------------------------------------------------------------------------
async function handleRingStatus(ring, call) {
  try {
    // Ring again after a while if still no response from the peers.
    if (ring.status === "none" || ring.status === "seen") {
      chrome.alarms.create(`ring-outcall-${call.id}`, { delayInMinutes: 0.02 });
      return;
    }

    // Delete the call objects if it is accepted or rejected by callee. This
    // also means that no needs to ring anymore.
    await chrome.storage.session.remove(`outcall-${call.id}`);
    await chrome.storage.session.remove(`contact-${call.contact_id}`);

    // Remove the related intercom object on the server-side.
    const payload = {
      id: call.id,
    };
    await getByKey("/api/pub/intercom/del/bykey", payload);

    // Open the meeting room in a new tab if accepted.
    if (ring.status === "accepted") {
      chrome.tabs.create({ url: call.url });
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// textMessageHandler
// -----------------------------------------------------------------------------
async function textMessageHandler(msg) {
  try {
    const msgId = msg?.id;
    if (!msgId) throw "missing message id";

    // Is there already a session object for this incoming text message?
    // Be carefull, the return value is a list, not a single item...
    const storedItems = await chrome.storage.session.get(`intext-${msgId}`);
    const storedItem = storedItems[`intext-${msgId}`];

    // Create or update (if already exists) the session object.
    // Be carefull, key will not be generated dynamically if it is not in [].
    const item = {
      [`intext-${msgId}`]: msg,
    };
    await chrome.storage.session.set(item);

    // If this is the first message of the incoming text then show the text.
    // This means creating its popup, triggering its cleanup job, etc.
    if (!storedItem) showInText(msg);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showInText
//
// This function is for initializing incoming text message. All attributes are
// expected to be exist at this stage. Fail if they dont.
//
// No scheduled clean job for text messages. It will be deleted when the user
// sees it or when it is expire on the server-side.
// -----------------------------------------------------------------------------
function showInText(msg) {
  try {
    // Cancel if the status is not "none". This means that the text message is
    // already processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") return;

    // Cancel if the text message is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) return;

    // Create the incoming text popup and show it.
    chrome.windows.create({
      url: chrome.runtime.getURL(
        `ui/in-text.html?id=${msg.id}`,
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
