// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

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
