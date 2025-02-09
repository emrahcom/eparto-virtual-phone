// -----------------------------------------------------------------------------
// Imports and globals
// -----------------------------------------------------------------------------
import { DEBUG, DEFAULT_BASE_URL } from "../common/config.js";
import { getByKey } from "../common/function.js";

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
    const container = document.getElementById("setup-guide");
    if (!container) throw "missing setup-guide container";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;

    const welcomeLink = document.getElementById("welcome-link");
    welcomeLink.href = baseUrl;

    const privateKeyLink = document.getElementById("private-key-link");
    privateKeyLink.href = `${baseUrl}/pri/identity/key`;

    container.style.display = "block";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showFailedRequest
// -----------------------------------------------------------------------------
function showFailedRequest() {
  try {
    const container = document.getElementById("failed-request");
    if (!container) throw "missing failed-request container";
    container.style.display = "block";
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
    const container = document.getElementById("empty-list");
    if (!container) throw "missing empty-list container";

    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;

    const contactKeyLink = document.getElementById("contact-key-link");
    contactKeyLink.href = `${baseUrl}/pri/contact/invite`;
    const virtualPhoneLink = document.getElementById("virtual-phone-link");
    virtualPhoneLink.href = `${baseUrl}/pri/phone`;

    container.style.display = "block";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// showContactList
// -----------------------------------------------------------------------------
async function showContactList(contacts) {
  try {
    const container = document.getElementById("contact-list");
    if (!container) throw "missing contact-list container";

    const contactListHeaderDiv = await generateContactListHeaderDiv();
    if (contactListHeaderDiv) container.appendChild(contactListHeaderDiv);

    // Generate a contact div for each contact.
    for (const contact of contacts) {
      const contactDiv = generateContactDiv(contact);
      if (!contactDiv) continue;

      container.appendChild(contactDiv);
    }

    container.style.display = "block";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// generateContactListHeaderDiv
// -----------------------------------------------------------------------------
async function generateContactListHeaderDiv() {
  try {
    // The only expected scheme is https.
    const storedBaseUrls = await chrome.storage.local.get("base-url");
    const baseUrl = storedBaseUrls["base-url"] || DEFAULT_BASE_URL;
    const domain = baseUrl.replace("https://", "");

    // Show the link of the contact page on the web site.
    const contactPageLink = document.createElement("a");
    contactPageLink.href = `${baseUrl}/pri/contact`;
    contactPageLink.target = "_blank";
    contactPageLink.textContent = domain;

    const contactListHeaderDiv = document.createElement("div");
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
    // Initialize the call and get the generated call object.
    const payload = {
      contact_id: contact.id,
    };
    const calls = await getByKey("/api/pub/contact/call/bykey", payload);
    const call = calls[0];
    if (!call) throw "failed to initiate outgoing call";

    // The call process will be processed by the service worker.
    call.action = "start-outcall";
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
    phoneButton.style.display = "block";
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

// -----------------------------------------------------------------------------
// updateCallStatus (only on UI)
// -----------------------------------------------------------------------------
async function updateCallStatus(contactId, phoneButton, callSpinner) {
  try {
    const storedItems = await chrome.storage.session.get(
      `contact-${contactId}`,
    );
    const activeCall = storedItems[`contact-${contactId}`];

    // Update the call status of this contact.
    if (activeCall) {
      // Switch to the ring mode since there is an active call.
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
    // Update the status again after a while.
    setTimeout(() => {
      updateCallStatus(contactId, phoneButton, callSpinner);
    }, 500);
  }
}
