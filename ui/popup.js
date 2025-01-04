// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { getByCode } from "../lib/common.js";

const DEBUG = true;

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
initialize();

// -----------------------------------------------------------------------------
// initialize
// -----------------------------------------------------------------------------
async function initialize() {
  try {
    const contacts = await getContactList();

    if (!contacts) {
      showFailedRequest();
    } else if (!Array.isArray(contacts)) {
      showUnexpectedResponse();
    } else if (contacts.length === 0) {
      showEmptyContactList();
    } else {
      showContactList(contacts);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// getContactList
// -----------------------------------------------------------------------------
async function getContactList() {
  return await getByCode("api/pub/contact/list");
}

// -----------------------------------------------------------------------------
// showFailedRequest
// -----------------------------------------------------------------------------
function showFailedRequest() {
  console.log("failed request");
}

// -----------------------------------------------------------------------------
// showUnexpectedResponse (alias for showFailedRequest)
// -----------------------------------------------------------------------------
function showUnexpectedResponse() {
  console.log("unexpected response");
}

// -----------------------------------------------------------------------------
// showEmptyContactList
// -----------------------------------------------------------------------------
function showEmptyContactList() {
  console.log("empty list");
}

// -----------------------------------------------------------------------------
// showContactList
// -----------------------------------------------------------------------------
function showContactList(contacts) {
  try {
    const container = document.getElementById("contact-list");
    if (!container) throw "missing contact list container";

    for (const c of contacts) {
      const status = getStatus(Number(c?.seen_second_ago));
      const div = document.createElement("div");
      div.className = "contact";
      div.innerHTML = `
        <div class="contact-info">
          <h3 class="contact-name">${c?.name}</h3>
          <p class="contact-email">${c?.profile_email}</p>
        </div>

        <button class="phone ${status}">
          <img src="/assets/phone.svg" alt="call ${status}">
        </button>
      `;
      container.appendChild(div);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// getStatus
// -----------------------------------------------------------------------------
function getStatus(second) {
  try {
    if (second < 100) {
      return "online";
    } else if (second < 3600) {
      return "idle";
    } else {
      return "offline";
    }
  } catch (e) {
    if (DEBUG) console.error(e);

    return "offline";
  }
}
