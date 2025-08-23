// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG } from "./config.js";
import { getByKey } from "./common.js";
import { callMessageHandler } from "./incoming-call.js";
import { phoneMessageHandler } from "./incoming-phone.js";
import { textMessageHandler } from "./incoming-text.js";

// -----------------------------------------------------------------------------
// getIntercomMessages
// -----------------------------------------------------------------------------
export async function getIntercomMessages() {
  const payload = {};
  const last = (await chrome.storage.local.get("intercom_last_msg_at")) || "0";

  // The value should be the epoch time in microseconds of the last received
  // message. This will be the start time while getting the new messages.
  payload.value = Number(last) || 0;

  // Poll intercom messages from the server.
  return await getByKey("/api/pub/intercom/list/bykey", payload);
}

// -----------------------------------------------------------------------------
// messageHandler
// -----------------------------------------------------------------------------
export async function messageHandler(messages) {
  try {
    if (!messages) throw "missing message list";
    if (!Array.isArray(messages)) throw "invalid structure for message list";
    if (!messages.length) return;

    // Process messages depending on their types.
    for (const msg of messages) {
      if (msg?.message_type === "call") {
        await callMessageHandler(msg);
      } else if (msg?.message_type === "phone") {
        await phoneMessageHandler(msg);
      } else if (msg?.message_type === "text") {
        await textMessageHandler(msg);
      }
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
