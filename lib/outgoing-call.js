// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG, EXPIRE_TIME_OUTCALL } from "./config.js";
import { getByKey } from "./common.js";

// -----------------------------------------------------------------------------
// startOutCall
//
// ui/contact.js triggers this function when the user clicks the phone button.
// -----------------------------------------------------------------------------
export async function startOutCall(call) {
  try {
    // Remove all objects related with this outgoing call after the expire time.
    // This will also terminate the call if there is no answer yet.
    //
    // No problem if the browser is closed before this is done, because they are
    // only session objects which will be removed anyway after the session.
    chrome.alarms.create(`cleanup-outcall-${call.id}`, {
      delayInMinutes: EXPIRE_TIME_OUTCALL,
    });

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
    chrome.alarms.create(`ring-outcall-${call.id}`, { delayInMinutes: 0.02 });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupOutCall
// -----------------------------------------------------------------------------
export async function cleanupOutCall(callId) {
  try {
    if (!callId) throw "missing call id";

    // Get stored call object. ringOutCall deletes the call object before the
    // expire time if answered by other peer or terminated by the caller. So,
    // there is no need to clean up in this case.
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
// ringOutCall
// -----------------------------------------------------------------------------
export async function ringOutCall(callId) {
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

    // Terminate the call if this call is not active anymore. This happens when
    // the call is stopped on UI by the user.
    if (activeCall !== callId) {
      await terminateOutCall(callId);
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
// terminateOutCall
// -----------------------------------------------------------------------------
async function terminateOutCall(callId) {
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
