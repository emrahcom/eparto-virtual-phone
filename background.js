// -----------------------------------------------------------------------------
// About Terminology
//
// contact    -> A person from the friends list.
// ping       -> Updating the presence to inform contacts.
//
// outCall    -> Outgoing direct call, from the extension to a contact.
// inCall     -> Incoming direct call, from a contact to the extension.
// inPhone    -> Incoming call from a public phone,
//               from an anonymous person to the extension.
// inText     -> Incoming text message, from a contact to the extension.
//
// intercom   -> The communication channel between the extension and the backend
//               server.
// messages   -> Messages received via intercom.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { INTERVAL_INTERCOM_PULLING, INTERVAL_PING } from "./lib/config.js";
import { ping } from "./lib/common.js";
import { getIntercomMessages, messageHandler } from "./lib/intercom.js";
import { cleanupInCall } from "./lib/incoming-call.js";
import { cleanupInText, popupHandler } from "./lib/incoming-text.js";
import {
  cleanupOutCall,
  ringOutCall,
  startOutCall,
} from "./lib/outgoing-call.js";

// -----------------------------------------------------------------------------
// Alarms
// -----------------------------------------------------------------------------
// Ping (update the presence) periodically.
// Start pinging in 2 sec and later in every INTERVAL_PING min.
chrome.alarms.create("ping", {
  periodInMinutes: INTERVAL_PING,
  delayInMinutes: 2 / 60,
});

// Create the first alarm to start polling intercom messages. Each time an alarm
// is triggered, subsequent alarm will be created in the listener. Chrome
// does not allow periodInMinutes to be less than 30 sec.
// https://developer.chrome.com/docs/extensions/reference/api/alarms
chrome.alarms.create("intercomMessages", {
  delayInMinutes: INTERVAL_INTERCOM_PULLING,
});

// Alarm listeners.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "ping") {
    ping();
  } else if (alarm.name === "intercomMessages") {
    // Before getting intercom messages, create the next alarm.
    chrome.alarms.create("intercomMessages", {
      delayInMinutes: INTERVAL_INTERCOM_PULLING,
    });

    // Known issue: if this alarm ends after the next alarm because of some
    // network issues then the message order will not be correct but dont fix,
    // skip it.
    const messages = await getIntercomMessages();
    if (messages) await messageHandler(messages);

    // Call the popupHandler to open new popups if needed.
    // popupHandler handles only text messages.
    popupHandler();
  } else if (alarm.name.startsWith("cleanup-intext-")) {
    const msgId = alarm.name.substr("cleanup-intext-".length);
    cleanupInText(msgId);
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
// onMessage (internal messages within the extension)
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "start-outcall") {
    // Contact page sends this message when the user clicks the phone button.
    startOutCall(msg);
  }
});

// -----------------------------------------------------------------------------
// onRemoved (catch the closed popups)
// -----------------------------------------------------------------------------
chrome.windows.onRemoved.addListener((windowId) => {
  console.error(windowId);
});
