// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  EXPIRE_TIME_INCALL,
  POPUP_INCALL_HEIGHT,
  POPUP_INCALL_WIDTH,
} from "./config.js";
import { getSessionObject, setSessionObject } from "./common.js";

// -----------------------------------------------------------------------------
// callMessageHandler
// -----------------------------------------------------------------------------
export async function callMessageHandler(msg) {
  try {
    if (!msg?.id) throw "missing message id";

    // Cancel if the status is not "none". This means that the call is already
    // processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") return;

    // Cancel if the call is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt) || Date.now() > expiredAt.getTime()) return;

    // Cancel if there is already a session object for this call.
    if (await getSessionObject(`incall-${msg.id}`)) return;

    // Create the session object.
    await setSessionObject(`incall-${msg.id}`, msg);

    // Remove all objects related with this incoming call after the expire time.
    // No problem if the browser is closed before this is done, because they are
    // only session objects which will be removed anyway after the session.
    chrome.alarms.create(`cleanup-incall-${msg.id}`, {
      delayInMinutes: EXPIRE_TIME_INCALL,
    });

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
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
