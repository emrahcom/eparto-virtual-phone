// -----------------------------------------------------------------------------
// Globals
// -----------------------------------------------------------------------------
const DEBUG = true;
const DEFAULT_BASE_URL = "https://app.eparto.net";

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
const cancelButton = document.getElementById("cancel");
cancelButton.addEventListener("click", cancelOptions);

const saveButton = document.getElementById("save");
saveButton.addEventListener("click", saveOptions);

const inputPrivateKey = document.getElementById("private-key");
inputPrivateKey.addEventListener("focus", inputPrivateKey.select);

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
initialize();

// -----------------------------------------------------------------------------
// initialize
// -----------------------------------------------------------------------------
async function initialize() {
  try {
    // Initialize the private key.
    let storedItems = await chrome.storage.local.get("private-key");
    let item = storedItems["private-key"];
    if (item) {
      const privateKey = document.getElementById("private-key");
      privateKey.value = item.slice(0, 2) + "*****" + item.slice(-2);
    }

    // Initialize the base url.
    storedItems = await chrome.storage.local.get("base-url");
    item = storedItems["base-url"] || DEFAULT_BASE_URL;
    if (item) {
      const baseUrl = document.getElementById("base-url");
      baseUrl.value = item;
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// cancelOptions
// -----------------------------------------------------------------------------
function cancelOptions() {
  globalThis.close();
}

// -----------------------------------------------------------------------------
// saveOptions
// -----------------------------------------------------------------------------
async function saveOptions() {
  try {
    // The input box shows the shadowed value by default which is shorter than
    // 20 characters. If the user updates this box, new value is longer than 20
    // characters. Save it if there is a new value or an empty string.
    const privateKey = document.getElementById("private-key");
    if (!privateKey) throw "missing input box, private-key";
    if (privateKey.value.length === 0 || privateKey.value.length > 20) {
      const item = {
        "private-key": privateKey.value,
      };
      await chrome.storage.local.set(item);
    }

    // Allow to input an empty string for the base URL. This will reset the
    // value by using DEFAULT_BASE_URL. Dont save the trailing "/" character.
    const baseUrl = document.getElementById("base-url");
    if (!baseUrl) throw "missing input box, base-url";
    const item = {
      "base-url": (baseUrl.value || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    };
    await chrome.storage.local.set(item);

    globalThis.close();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
