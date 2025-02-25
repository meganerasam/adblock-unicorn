document.addEventListener("DOMContentLoaded", () => {
  const adBlockingToggle = document.getElementById("adBlockingToggle");
  const phishingToggle = document.getElementById("phishingToggle");
  const openOptionsBtn = document.getElementById("openOptionsBtn");

  // Load settings for toggles
  chrome.storage.local.get(
    ["adBlockingEnabled", "phishingWarningEnabled"],
    (result) => {
      adBlockingToggle.checked = result.adBlockingEnabled !== false;
      phishingToggle.checked = result.phishingWarningEnabled !== false;
    }
  );

  adBlockingToggle.addEventListener("change", () => {
    chrome.storage.local.set(
      { adBlockingEnabled: adBlockingToggle.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "TOGGLE_AD_BLOCKING",
          payload: { adBlockingEnabled: adBlockingToggle.checked },
        });
      }
    );
  });

  phishingToggle.addEventListener("change", () => {
    chrome.storage.local.set(
      { phishingWarningEnabled: phishingToggle.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "TOGGLE_PHISHING",
          payload: { phishingWarningEnabled: phishingToggle.checked },
        });
      }
    );
  });

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
