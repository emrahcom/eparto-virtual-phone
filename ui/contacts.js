// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import {
  DEBUG,
  DEFAULT_BASE_URL,
  PHONE_STATUS_IDLE,
  PHONE_STATUS_ONLINE,
  TEXT_STATUS_IDLE,
  TEXT_STATUS_ONLINE,
} from "../lib/config.js";
import { getByKey, getSessionObject } from "../lib/common.js";

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
const form = globalThis.document.querySelector("form");
form.addEventListener("submit", sendTextMessage);

const cancelButton = globalThis.document.getElementById("cancel-btn");
cancelButton.addEventListener("click", cancelTextMessage);

// -----------------------------------------------------------------------------
// sendTextMessage
// -----------------------------------------------------------------------------
async function sendTextMessage(e) {
  const sendButton = globalThis.document.getElementById("send-btn");
  if (sendButton) sendButton.disabled = true;

  try {
    // Prevent the page from reloading on form submission
    e.preventDefault();

    const contactId = globalThis.document.getElementById("contact-id");
    if (!contactId) throw new Error("missing contact-id element");

    const message = globalThis.document.getElementById("message");
    if (!message) throw new Error("missing message box");

    // Send the message.
    const payload = {
      contact_id: contactId.value,
      message: message.value,
    };
    const texts = await getByKey("/api/pub/contact/text/bykey", payload);
    const text = texts[0];
    if (!text) throw new Error("failed to send the text message");

    // Reset the values to allow a new message.
    message.value = "";
    message.focus();
  } catch (e) {
    if (DEBUG) console.error(e);
  }

  globalThis.setTimeout(() => {
    if (sendButton) sendButton.disabled = false;
  }, 500);
}

// -----------------------------------------------------------------------------
// cancelTextMessage
// -----------------------------------------------------------------------------
function cancelTextMessage() {
  try {
    const contactList = globalThis.document.getElementById("contact-list");
    if (!contactList) throw new Error("missing contact-list container");

    const messageForm = globalThis.document.getElementById("message-form");
    if (!messageForm) throw new Error("missing message-form container");

    // Hide the message form and display the contact list.
    contactList.style.display = "flex";
    messageForm.style.display = "none";

    // Reset the contact-id
    const contactId = globalThis.document.getElementById("contact-id");
    if (!contactId) throw new Error("missing contact-id");
    contactId.value = "";

    // Reset the contact-name
    const contactName = globalThis.document.getElementById("contact-name");
    if (!contactName) throw new Error("missing contact-name");
    contactName.value = "";

    // Reset the message text.
    const message = globalThis.document.getElementById("message");
    if (!message) throw new Error("missing message box");
    message.value = "";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
initialize();

// -----------------------------------------------------------------------------
// initialize
// -----------------------------------------------------------------------------
async function initialize() {
  try {
    // Show the setup guide if there is no defined private key.
    const storedPrivateKeys = await chrome.storage.local.get("private-key");
    const keyValue = storedPrivateKeys["private-key"];
    if (!keyValue) {
      showSetupGuide();
      return;
    }

    const contacts = await getContactList();

    if (!contacts) {
      showFailedRequest();
    } else if (!Array.isArray(contacts)) {
      showUnexpectedResponse();
    } else if (contacts.length === 0) {
      showEmptyContactList();
    } else {
      await showContactList(contacts);
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// getContactList
// -----------------------------------------------------------------------------
async function getContactList() {
  return await getByKey("/api/pub/contact/list/bykey");
}

// -----------------------------------------------------------------------------
// showSetupGuide
// -----------------------------------------------------------------------------
async function showSetupGuide() {
  try {
    const container = globalThis.document.getElementById("setup-guide");
    if (!container) throw new Error("missing setup-guide container");

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;

    const welcomeLink = globalThis.document.getElementById("welcome-link");
    welcomeLink.href = baseUrl;

    const privateKeyLink =
      globalThis.document.getElementById("private-key-link");
    privateKeyLink.href = `${baseUrl}/pri/identity/key`;

    container.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showFailedRequest
// -----------------------------------------------------------------------------
function showFailedRequest() {
  try {
    const container = globalThis.document.getElementById("failed-request");
    if (!container) throw new Error("missing failed-request container");
    container.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showUnexpectedResponse (alias for showFailedRequest)
// -----------------------------------------------------------------------------
function showUnexpectedResponse() {
  return showFailedRequest();
}

// -----------------------------------------------------------------------------
// showEmptyContactList
// -----------------------------------------------------------------------------
async function showEmptyContactList() {
  try {
    const container = globalThis.document.getElementById("empty-list");
    if (!container) throw new Error("missing empty-list container");

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;

    const contactKeyLink =
      globalThis.document.getElementById("contact-key-link");
    contactKeyLink.href = `${baseUrl}/pri/contact/invite`;
    const virtualPhoneLink =
      globalThis.document.getElementById("virtual-phone-link");
    virtualPhoneLink.href = `${baseUrl}/pri/phone`;

    container.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showContactList
// -----------------------------------------------------------------------------
async function showContactList(contacts) {
  try {
    const container = globalThis.document.getElementById("contact-list");
    if (!container) throw new Error("missing contact-list container");

    const contactListHeaderDiv = await generateContactListHeaderDiv();
    if (contactListHeaderDiv) container.appendChild(contactListHeaderDiv);

    // Generate a contact div for each contact.
    for (const contact of contacts) {
      const contactDiv = generateContactDiv(contact);
      if (!contactDiv) continue;

      container.appendChild(contactDiv);
    }

    container.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// generateContactListHeaderDiv
// -----------------------------------------------------------------------------
async function generateContactListHeaderDiv() {
  try {
    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;

    // Show the link of the contacts page.
    const contactPageLink = globalThis.document.createElement("a");
    contactPageLink.className = "contact-page-link";
    contactPageLink.href = `${baseUrl}/pri/contact`;
    contactPageLink.target = "_blank";
    contactPageLink.textContent = "Open the contacts page";

    const contactListHeaderDiv = globalThis.document.createElement("div");
    contactListHeaderDiv.className = "contact-list-header";
    contactListHeaderDiv.appendChild(contactPageLink);

    return contactListHeaderDiv;
  } catch (e) {
    if (DEBUG) console.error(e);

    return undefined;
  }
}

// -----------------------------------------------------------------------------
// generateContactDiv
// -----------------------------------------------------------------------------
function generateContactDiv(contact) {
  try {
    const contactInfoDiv = generateContactInfoDiv(contact);

    const textButton = generateTextButton(contact);
    const callSpinner = generateSpinnerDiv();
    const phoneButton = generatePhoneButton(contact, callSpinner);
    callSpinner.onclick = function () {
      onSpinnerClick(contact.id, phoneButton, callSpinner);
    };

    const contactDiv = globalThis.document.createElement("div");
    contactDiv.className = "contact";
    contactDiv.appendChild(contactInfoDiv);
    contactDiv.appendChild(textButton);
    contactDiv.appendChild(phoneButton);
    contactDiv.appendChild(callSpinner);

    // Create a watcher for each contact that will monitor and update its status
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
  const contactName = globalThis.document.createElement("h3");
  contactName.className = "contact-info-name";
  contactName.textContent = contact?.name || "";

  const contactEmail = globalThis.document.createElement("p");
  contactEmail.className = "contact-info-email";
  contactEmail.textContent = contact?.profile_email || "";

  const contactInfoDiv = globalThis.document.createElement("div");
  contactInfoDiv.className = "contact-info";
  contactInfoDiv.appendChild(contactName);
  contactInfoDiv.appendChild(contactEmail);

  return contactInfoDiv;
}

// -----------------------------------------------------------------------------
// generateTextButton (will be placed in ContactDiv)
// -----------------------------------------------------------------------------
function generateTextButton(contact) {
  const textStatus = getTextStatus(Number(contact?.seen_second_ago));

  const textIcon = globalThis.document.createElement("img");
  textIcon.src = "/assets/chat.svg";
  textIcon.alt = "send message";

  const textButton = globalThis.document.createElement("button");
  textButton.className = `text ${textStatus}`;
  textButton.onclick = function () {
    onTextClick(contact);
  };
  textButton.appendChild(textIcon);

  return textButton;
}

// -----------------------------------------------------------------------------
// getTextStatus
// -----------------------------------------------------------------------------
function getTextStatus(second) {
  try {
    if (second < TEXT_STATUS_ONLINE) {
      return "online";
    } else if (second < TEXT_STATUS_IDLE) {
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
// onTextClick
// -----------------------------------------------------------------------------
function onTextClick(contact) {
  try {
    const contactList = globalThis.document.getElementById("contact-list");
    if (!contactList) throw new Error("missing contact-list container");

    const messageForm = globalThis.document.getElementById("message-form");
    if (!messageForm) throw new Error("missing message-form container");

    const contactId = globalThis.document.getElementById("contact-id");
    if (!contactId) throw new Error("missing contact-id element");
    contactId.value = contact.id;

    const contactName = globalThis.document.getElementById("contact-name");
    if (!contactName) throw new Error("missing contact-name element");
    contactName.textContent = `To ${contact?.name || ""}`;

    const message = globalThis.document.getElementById("message");
    if (!message) throw new Error("missing message box");

    // Update UI status.
    contactList.style.display = "none";
    messageForm.style.display = "flex";
    message.focus();
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// generateSpinnerDiv (will be placed in ContactDiv)
// -----------------------------------------------------------------------------
function generateSpinnerDiv() {
  const spinnerDiv = globalThis.document.createElement("div");
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
  const phoneStatus = getPhoneStatus(Number(contact?.seen_second_ago));

  const phoneIcon = globalThis.document.createElement("img");
  phoneIcon.src = "/assets/phone.svg";
  phoneIcon.alt = "call";

  const phoneButton = globalThis.document.createElement("button");
  phoneButton.className = `phone ${phoneStatus}`;
  phoneButton.onclick = function () {
    onPhoneClick(contact, phoneButton, callSpinner);
  };
  phoneButton.appendChild(phoneIcon);

  return phoneButton;
}

// -----------------------------------------------------------------------------
// getPhoneStatus
// -----------------------------------------------------------------------------
function getPhoneStatus(second) {
  try {
    if (second < PHONE_STATUS_ONLINE) {
      return "online";
    } else if (second < PHONE_STATUS_IDLE) {
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
    // Initialize the call and get the generated call object.
    const payload = {
      contact_id: contact.id,
    };
    const calls = await getByKey("/api/pub/contact/call/bykey", payload);
    const call = calls[0];
    if (!call) throw new Error("failed to initiate outgoing call");

    // The call process will be processed by the service worker.
    call.action = "outcall-start";
    call.contact_id = contact.id;
    chrome.runtime.sendMessage(call);

    // Update UI status.
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
    // Remove the stored contact object. This means that there is no active call
    // for this contact. The service worker stops ringing if there is no contact
    // object in the storage.
    await chrome.storage.session.remove(`contact-${contactId}`);

    // Update UI status.
    callSpinner.style.display = "none";
    phoneButton.style.display = "flex";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// updateCallStatus (only on UI)
// -----------------------------------------------------------------------------
async function updateCallStatus(contactId, phoneButton, callSpinner) {
  try {
    const activeCall = await getSessionObject(`contact-${contactId}`);

    // Update the call status of this contact.
    if (activeCall) {
      // Switch to the ring mode since there is an active call.
      phoneButton.style.display = "none";
      callSpinner.style.display = "flex";
    } else {
      // Switch to the normal mode since there is no active call.
      callSpinner.style.display = "none";
      phoneButton.style.display = "flex";
    }
  } catch (e) {
    if (DEBUG) console.error(e);
  } finally {
    // Update the status again after a while.
    globalThis.setTimeout(() => {
      updateCallStatus(contactId, phoneButton, callSpinner);
    }, 500);
  }
}
