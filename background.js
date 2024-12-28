chrome.alarms.create("getCalls", {
  periodInMinutes: 0.1
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "getCalls") {
    getCalls();
  }
});

async function getCalls() {
  await console.error("call");
}
