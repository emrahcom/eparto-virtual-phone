// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
import { DEBUG } from "./config.js";

// -----------------------------------------------------------------------------
// getByKey
// -----------------------------------------------------------------------------
export async function getByKey(path, payload = {}) {
  try {
    if (!path) throw "missing path";

    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const keyValue = storedPrivateKeys["private-key"];
    if (!keyValue) throw "missing private key";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"];
    if (!baseUrl) throw "missing base url";
    const url = `${baseUrl}${path}`;

    payload.key_value = keyValue;

    const res = await globalThis.fetch(url, {
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

    return null;
  }
}

// -----------------------------------------------------------------------------
// ping
// -----------------------------------------------------------------------------
export async function ping() {
  // Update the user presence on the server-side to inform contacts.
  return await getByKey("/api/pub/identity/ping/bykey");
}

// -----------------------------------------------------------------------------
// setStatus (inform the caller about the action taken)
// -----------------------------------------------------------------------------
export async function setStatus(msgId, status) {
  const payload = {
    id: msgId,
  };

  return await getByKey(`/api/pub/intercom/set/${status}/bykey`, payload);
}

// -----------------------------------------------------------------------------
// safeText (Make text safe for HTML pages)
// -----------------------------------------------------------------------------
export function safeText(text) {
  try {
    const textNode = globalThis.document.createTextNode(text);
    const containerDiv = globalThis.document.createElement("div");
    containerDiv.appendChild(textNode);

    // Return the encoded text.
    return containerDiv.innerHTML;
  } catch (e) {
    if (DEBUG) console.error(e);

    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Set the session object.
// -----------------------------------------------------------------------------
export async function setSessionObject(key, value) {
  // Be carefull, key will not be generated dynamically if it is not in [].
  const item = {
    [key]: value,
  };

  await chrome.storage.session.set(item);
}

// -----------------------------------------------------------------------------
// Get the session object.
// -----------------------------------------------------------------------------
export async function getSessionObject(key) {
  // Be carefull, the return value is a list, not a single item...
  const storedItems = await chrome.storage.session.get(key);

  return storedItems[key];
}
