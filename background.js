// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
chrome.alarms.create("intercomMessages", {
  periodInMinutes: 0.035,
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "intercomMessages") {
    const messages = await getIntercomMessages();
    if (messages) messageHandler(messages);
  } else if (alarm.name.startsWith("cleanup-call-")) {
    const msgId = alarm.name.substr(13);
    cleanupCall(msgId);
  }
});

// -----------------------------------------------------------------------------
// getIntercomMessages
// -----------------------------------------------------------------------------
async function getIntercomMessages() {
  try {
    const url = "https://app.galaxy.corp/api/pub/intercom/list";
    const code =
      "8e078c951e0b944089f986ed8bbba32bc5e783cb1dfc3fabdce860ddad7807bf";
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
    if (!messages.length) return;

    for (const msg of messages) {
      if (msg?.message_type === "call") {
        callHandler(msg);
      } else if (msg?.message_type === "phone") {
        callHandler(msg);
      }
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// callHandler
// -----------------------------------------------------------------------------
async function callHandler(msg) {
  try {
    const msgId = msg?.id;
    if (!msgId) throw "missing message id";

    const storedItems = await chrome.storage.session.get(`call-${msgId}`);

    msg["updated_at"] = Date.now();
    const item = {
      [`call-${msgId}`]: msg,
    };
    await chrome.storage.session.set(item);

    // If this is the first message of the call then initialize the call.
    if (!storedItems[`call-${msgId}`]) initializeCall(msg);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// initializeCall
// -----------------------------------------------------------------------------
function initializeCall(msg) {
  try {
    // Create popup.
    chrome.windows.create({
      url: chrome.runtime.getURL(
        `popup/${msg.message_type}.html?id=${msg.id}`,
      ),
      type: "popup",
      width: 400,
      height: 200,
    });

    // Trigger the cleanup job which will remove call objects after a while.
    triggerCleanupCall(msg.id);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// triggerCleanupCall
// -----------------------------------------------------------------------------
function triggerCleanupCall(msgId) {
  try {
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
    console.error(msgId);

    await chrome.storage.session.remove(`call-${msgId}`);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
