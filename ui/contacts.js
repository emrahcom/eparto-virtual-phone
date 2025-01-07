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
  return await getByCode("/api/pub/contact/list");
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

    // Generate a contact div for each contact.
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
    const contactInfoDiv = generateContactInfoDiv(contact);

    const callSpinner = generateSpinnerDiv();
    const phoneButton = generatePhoneButton(contact, callSpinner);
    callSpinner.onclick = function () {
      onSpinnerClick(contact.id, phoneButton, callSpinner);
    };

    const contactDiv = document.createElement("div");
    contactDiv.className = "contact";
    contactDiv.appendChild(contactInfoDiv);
    contactDiv.appendChild(phoneButton);
    contactDiv.appendChild(callSpinner);

    updateCallStatus(contact.id, phoneButton, callSpinner);

    return contactDiv;
  } catch (e) {
    if (DEBUG) console.error(e);

    return undefined;
  }
}

// -----------------------------------------------------------------------------
// generateContactInfoDiv (will be placed in ContactDiv)
// -----------------------------------------------------------------------------
function generateContactInfoDiv(contact) {
  const contactName = document.createElement("h3");
  contactName.className = "contact-info-name";
  contactName.textContent = contact?.name || "";

  const contactEmail = document.createElement("p");
  contactEmail.className = "contact-info-email";
  contactEmail.textContent = contact?.profile_email || "";

  const contactInfoDiv = document.createElement("div");
  contactInfoDiv.className = "contact-info";
  contactInfoDiv.appendChild(contactName);
  contactInfoDiv.appendChild(contactEmail);

  return contactInfoDiv;
}

// -----------------------------------------------------------------------------
// generateSpinnerDiv (will be placed in ContactDiv)
// -----------------------------------------------------------------------------
function generateSpinnerDiv() {
  const spinnerDiv = document.createElement("div");
  spinnerDiv.className = "spinner";
  spinnerDiv.title = "Cancel call";
  spinnerDiv.style.display = "none";
  spinnerDiv.innerHTML = `
    <div class="spinner-circle"></div>
    <div class="spinner-circle"></div>
    <div class="spinner-circle"></div>
  `;

  // onClick event will be defined later in the caller function because it needs
  // a reference to the phone button which is not created yet.

  return spinnerDiv;
}

// -----------------------------------------------------------------------------
// generatePhoneButton (will be placed in ContactDiv)
// -----------------------------------------------------------------------------
function generatePhoneButton(contact, callSpinner) {
  const contactStatus = getContactStatus(Number(contact?.seen_second_ago));

  const phoneIcon = document.createElement("img");
  phoneIcon.src = "/assets/phone.svg";
  phoneIcon.alt = `call ${contactStatus}`;

  const phoneButton = document.createElement("button");
  phoneButton.className = `phone ${contactStatus}`;
  phoneButton.onclick = function () {
    onPhoneClick(contact, phoneButton, callSpinner);
  };
  phoneButton.appendChild(phoneIcon);

  return phoneButton;
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
async function onPhoneClick(contact, phoneButton, callSpinner) {
  try {
    const payload = {
      contact_id: contact.id,
    };
    const calls = await getByCode("/api/pub/contact/call", payload);
    const call = calls[0];
    if (!call) throw "failed while starting the outgoing call";

    call.action = "start-outcall";
    call.contact_id = contact.id;
    chrome.runtime.sendMessage(call);

    phoneButton.style.display = "none";
    callSpinner.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// onSpinnerClick
// -----------------------------------------------------------------------------
async function onSpinnerClick(contactId, phoneButton, callSpinner) {
  try {
    await chrome.storage.session.remove(`contact-${contactId}`);

    callSpinner.style.display = "none";
    phoneButton.style.display = "block";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// updateCallStatus
// -----------------------------------------------------------------------------
async function updateCallStatus(contactId, phoneButton, callSpinner) {
  try {
    const storedItems = await chrome.storage.session.get(
      `contact-${contactId}`,
    );
    const activeCall = storedItems[`contact-${contactId}`];

    // Update the call status of this contact.
    if (activeCall) {
      // Switch to the ringing mode since there is an active call.
      phoneButton.style.display = "none";
      callSpinner.style.display = "flex";
    } else {
      // Switch to the normal mode since there is no active call.
      callSpinner.style.display = "none";
      phoneButton.style.display = "block";
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  } finally {
    // Update the state again after a while.
    setTimeout(() => {
      updateCallStatus(contactId, phoneButton, callSpinner);
    }, 1000);
  }
}
