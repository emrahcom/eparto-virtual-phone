chrome.alarms.create("getIntercomMessages", {
  periodInMinutes: 0.035,
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "getIntercomMessages") {
    getIntercomMessages();
  }
});

async function getIntercomMessages() {
  try {
    const url = "https://app.galaxy.corp/api/pub/intercom/list";
    const code =
      "8e078c951e0b944089f986ed8bbba32bc5e783cb1dfc3fabdce860ddad7807bf";
    const payload = {
      code: code,
    };

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      method: "post",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw "failed request";

    const data = await res.json();
    if (!data) throw "invalid json data";
    if (!Array.isArray(data)) throw "invalid array data";
    if (!data.length) return;

    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
