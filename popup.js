document.addEventListener("DOMContentLoaded", () => {
  const adBlockingToggle = document.getElementById("adBlockingToggle");
  const phishingToggle = document.getElementById("phishingToggle");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const siteNameEl = document.querySelector(".site-name");

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

  // Get the current tab's domain and update the site name
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length && tabs[0].url) {
      try {
        const urlObj = new URL(tabs[0].url);
        const domain = urlObj.hostname.replace(/^www\./, "");
        siteNameEl.textContent = domain;
      } catch (err) {
        console.error("Error parsing URL:", err);
        siteNameEl.textContent = "Unknown Site";
      }
    }
  });
});
