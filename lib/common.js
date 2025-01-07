// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;

// -----------------------------------------------------------------------------
// getByCode
// -----------------------------------------------------------------------------
export async function getByCode(path, payload = {}) {
  try {
    if (!path) throw "missing path";

    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const code = storedPrivateKeys["private-key"];
    if (!code) throw "missing private key (code)";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"];
    if (!baseUrl) throw "missing base url";
    const url = `${baseUrl}${path}`;

    payload.code = code;

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
