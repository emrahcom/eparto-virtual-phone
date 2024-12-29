document.getElementById("btn").addEventListener("click", async () => {
  console.log("Button clicked!");

  const qs = new URLSearchParams(globalThis.location.search);
  const msgId = qs.get("id");

  if (msgId) {
    console.log(msgId);
    console.log(await chrome.storage.session.get(`call-${msgId}`));
  } else {
    console.log("no msg");
  }
});
