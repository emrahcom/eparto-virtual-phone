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
    if (!container) throw "missing contact-list container";

    for (const contact of contacts) {
      const contactDiv = generateContactDiv(contact);
      if (!contactDiv) continue;

      container.appendChild(contactDiv);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// generateContactDiv
// -----------------------------------------------------------------------------
function generateContactDiv(contact) {
  try {
    const contactStatus = getContactStatus(Number(contact?.seen_second_ago));

    const contactName = document.createElement("h3");
    contactName.className = "contact-name";
    contactName.textContent = contact?.name || "";

    const contactEmail = document.createElement("p");
    contactEmail.className = "contact-email";
    contactEmail.textContent = contact?.profile_email || "";

    const contactInfo = document.createElement("div");
    contactInfo.className = "contact-info";
    contactInfo.appendChild(contactName);
    contactInfo.appendChild(contactEmail);

    const callSpinner = generateSpinner();
    const phoneIcon = document.createElement("img");
    phoneIcon.src = "/assets/phone.svg";
    phoneIcon.alt = `call ${contactStatus}`;

    const phoneButton = document.createElement("button");
    phoneButton.className = `phone ${contactStatus}`;
    phoneButton.onclick = function () {
      onPhoneClick(phoneButton, callSpinner, contact);
    };
    phoneButton.appendChild(phoneIcon);

    const contactDiv = document.createElement("div");
    contactDiv.className = "contact";
    contactDiv.appendChild(contactInfo);
    contactDiv.appendChild(phoneButton);
    contactDiv.appendChild(callSpinner);

    return contactDiv;
  } catch (e) {
    if (DEBUG) console.error(e);

    return undefined;
  }
}

// -----------------------------------------------------------------------------
// generateSpinner
// -----------------------------------------------------------------------------
function generateSpinner() {
  const spinnerDiv = document.createElement("div");
  spinnerDiv.className = "spinner";
  spinnerDiv.style.display = "none";
  spinnerDiv.innerHTML = `
    <div class="spinner-circle"></div>
    <div class="spinner-circle"></div>
    <div class="spinner-circle"></div>
  `;

  return spinnerDiv;
}

// -----------------------------------------------------------------------------
// getContactStatus
// -----------------------------------------------------------------------------
function getContactStatus(second) {
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

// -----------------------------------------------------------------------------
// onPhoneClick
// -----------------------------------------------------------------------------
async function onPhoneClick(button, spinner, contact) {
  try {
    button.style.display = "none";
    spinner.style.display = "flex";
    await console.log(button);
    await console.log(spinner);
    await console.log(contact);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}
