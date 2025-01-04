// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
// Ping (update presence)
chrome.alarms.create("ping", {
  periodInMinutes: 0.5,
});

// Poll intercom messages.
chrome.alarms.create("intercomMessages", {
  periodInMinutes: 0.035,
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "ping") {
    ping();
  } else if (alarm.name === "intercomMessages") {
    // Known issue: if this alarm ends after the next alarm because of some
    // network issues then the old message will overwrite the new one but dont
    // fix, skip it.
    const messages = await getIntercomMessages();
    if (messages) messageHandler(messages);
  } else if (alarm.name.startsWith("cleanup-call-")) {
    const msgId = alarm.name.substr(13);
    cleanupCall(msgId);
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
  try {
    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const code = storedPrivateKeys["private-key"];
    if (!code) throw "missing private key";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"];
    if (!baseUrl) throw "missing base url";
    const url = `${baseUrl}/api/pub/identity/ping`;

    const payload = {
      code: code,
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
  }
}

// -----------------------------------------------------------------------------
// getIntercomMessages
// -----------------------------------------------------------------------------
async function getIntercomMessages() {
  try {
    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const code = storedPrivateKeys["private-key"];
    if (!code) throw "missing private key";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"];
    if (!baseUrl) throw "missing base url";
    const url = `${baseUrl}/api/pub/intercom/list`;

    const payload = {
      code: code,
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

    // Trace stored messages and remove it if it is not in the id list.
    for (const key of await chrome.storage.session.getKeys()) {
      if (!key.startsWith("call-")) continue;

      const msgId = key.substr(5);

      if (!ids.includes(msgId)) {
        await chrome.storage.session.remove(`call-${msgId}`);
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
    const storedItems = await chrome.storage.session.get(`call-${msgId}`);
    const storedItem = storedItems[`call-${msgId}`];

    // Create or update (if already exists) the session object.
    // Be carefull, key will not be generated dynamically if it is not in [].
    const item = {
      [`call-${msgId}`]: msg,
    };
    await chrome.storage.session.set(item);

    // If this is the first message of the call then initialize the call.
    // Initializing means create its popup, trigger its cleanup job, etc.
    if (!storedItem) initializeCall(msg);
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
// initializeCall
//
// All attributes are expected to be exist at this stage. Fail if they dont.
// -----------------------------------------------------------------------------
function initializeCall(msg) {
  try {
    // Trigger the cleanup job which will remove the call object after a while.
    triggerCleanupCall(msg.id);

    // Cancel if the status is not "none". This means that the call is already
    // processed (accepted, rejected, seen, etc.) by another client.
    if (msg.status !== "none") return;

    // Cancel if the call is already expired.
    const expiredAt = new Date(msg.expired_at);
    if (isNaN(expiredAt)) throw "invalid expire time";
    if (Date.now() > expiredAt.getTime()) return;

    // Create the popup and show it.
    chrome.windows.create({
      url: chrome.runtime.getURL(
        `ui/${msg.message_type}.html?id=${msg.id}`,
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
// triggerCleanupCall
// -----------------------------------------------------------------------------
function triggerCleanupCall(msgId) {
  try {
    // Remove all objects related with this call after 1 min. There is no
    // problem if the browser is closed before this is done, because there are
    // only session objects which will be removed anyway after the session ends.
    chrome.alarms.create(`cleanup-call-${msgId}`, { delayInMinutes: 1 });
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cleanupCall
// -----------------------------------------------------------------------------
async function cleanupCall(msgId) {
  try {
    if (!msgId) throw "missing message id";

    await chrome.storage.session.remove(`call-${msgId}`);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
