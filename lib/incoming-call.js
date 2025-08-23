// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  EXPIRE_TIME_INCALL,
  POPUP_INCALL_HEIGHT,
  POPUP_INCALL_WIDTH,
} from "./config.js";

// -----------------------------------------------------------------------------
// callMessageHandler
// -----------------------------------------------------------------------------
export async function callMessageHandler(msg) {
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
// startInCall
//
// This function initalizes the incoming direct call or the incoming phone call.
// All attributes are expected to be exist at this stage. Fail if they dont.
// -----------------------------------------------------------------------------
function startInCall(msg) {
  try {
    // Remove all objects related with this incoming call after the expire time.
    // No problem if the browser is closed before this is done, because they are
    // only session objects which will be removed anyway after the session.
    chrome.alarms.create(`cleanup-incall-${msg.id}`, {
      delayInMinutes: EXPIRE_TIME_INCALL,
    });

    // Cancel if the status is not "none". This means that the call is already
    // processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") {
      cleanupInCall(msg.id);
      return;
    }

    // Cancel if the call is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt) || Date.now() > expiredAt.getTime()) {
      cleanupInCall(msg.id);
      return;
    }

    // Create the incoming call popup and display it.
    chrome.windows.create({
      url: chrome.runtime.getURL(`ui/in-${msg.message_type}.html?id=${msg.id}`),
      type: "popup",
      focused: true,
      width: POPUP_INCALL_WIDTH,
      height: POPUP_INCALL_HEIGHT,
    });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupInCall
// -----------------------------------------------------------------------------
export async function cleanupInCall(msgId) {
  try {
    if (!msgId) throw "missing message id";

    await chrome.storage.session.remove(`incall-${msgId}`);

    // Sometimes this function is called directly without waiting the alarm.
    // Delete the existing alarm in this case.
    chrome.alarms.clear(`cleanup-incall-${msgId}`);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
