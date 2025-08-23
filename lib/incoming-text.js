// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  EXPIRE_TIME_INTEXT,
  NUMBER_OF_ALLOWED_POPUPS,
  POPUP_INTEXT_HEIGHT,
  POPUP_INTEXT_WIDTH,
} from "./config.js";

// -----------------------------------------------------------------------------
// textMessageHandler
// -----------------------------------------------------------------------------
export async function textMessageHandler(msg) {
  try {
    if (!msg?.id) throw "missing message id";

    // Cancel if the status is not "none". This means that the text message is
    // already processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") return;

    // Cancel if the text message is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt) || Date.now() > expiredAt.getTime()) return;

    // Cancel if there is already a session object for this text message.
    const storedItems = await chrome.storage.session.get(`intext-${msg.id}`);
    if (storedItems[`intext-${msg.id}`]) return;

    // Create the session object.
    // Be carefull, key will not be generated dynamically if it is not in [].
    const item = {
      [`intext-${msg.id}`]: msg,
    };
    await chrome.storage.session.set(item);

    // Remove all objects related with this incoming text after the expire time.
    // No problem if the browser is closed before this is done, because they are
    // only session objects which will be removed anyway after the session.
    chrome.alarms.create(`cleanup-intext-${msg.id}`, {
      delayInMinutes: EXPIRE_TIME_INTEXT,
    });

    // Add it to the queue. popupHandler periodically checks this queue and
    // create a popup when the number of open popups is less than a threshold.
    const storedItems = await chrome.storage.session.get("message-queue");
    const messageQueue = storedItems["message-queue"] || [];

    if (!messageQueue.includes(msg.id) {
      messageQueue.push(msg.id);

      // Create or update (if already exists) the message queue.
      const item = {
        ["message-queue"]: messageQueue,
      };
      await chrome.storage.session.set(item);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// popupHandler
//
// popupHandler only handles text messages and displays a limited number of text
// messages at a time. Call and phone messages are displayed immediately since
// they are urgent and they are not handled by popupHandler.
// -----------------------------------------------------------------------------
export async function popupHandler() {
  try {
    const openPopups = await chrome.windows.getAll({ windowTypes: ["popup"] });
    const numberOfOpenPopups = openPopups.length;
    const availableSlots = NUMBER_OF_ALLOWED_POPUPS - numberOfOpenPopups;
    if (availableSlots < 1) return;

    // Is there already a message queue for incoming text messages?
    // Be carefull, the return value is a list, not a single item...
    const storedItems = await chrome.storage.session.get("message-queue");
    const messageQueue = storedItems["message-queue"] || [];

    for (let i = 0; i < availableSlots; i++) {
      const msgId = messageQueue.shift();
      // Stop if there is no more id in the list.
      if (!msgId) break;

      await displayInText(msgId);
    }

    await chrome.storage.session.set({ "message-queue": messageQueue });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// displayInText
//
// This function displays the incoming text message. All attributes are expected
// to be exist at this stage. Fail if they dont.
// -----------------------------------------------------------------------------
async function displayInText(msgId) {
  try {
    // Get the incoming text object from the storage.
    const storedItems = await chrome.storage.session.get(`intext-${msgId}`);
    const msg = storedItems[`intext-${msgId}`];
    if (!msg) return;

    // Create the incoming text popup and display it.
    chrome.windows.create({
      url: chrome.runtime.getURL(`ui/in-text.html?id=${msg.id}`),
      type: "popup",
      focused: true,
      width: POPUP_INTEXT_WIDTH,
      height: POPUP_INTEXT_HEIGHT,
    });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupInText
// -----------------------------------------------------------------------------
export async function cleanupInText(msgId) {
  try {
    if (!msgId) throw "missing message id";

    await chrome.storage.session.remove(`intext-${msgId}`);

    // Sometimes this function is called directly without waiting the alarm.
    // Delete the existing alarm in this case.
    chrome.alarms.clear(`cleanup-intext-${msgId}`);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
