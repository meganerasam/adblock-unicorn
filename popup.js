document.addEventListener("DOMContentLoaded", () => {
  const adBlockingCheckbox = document.getElementById("adBlockingToggle");
  const phishingCheckbox = document.getElementById("phishingToggle");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const siteNameEl = document.querySelector(".site-name");

  // Load settings for checkboxes
  chrome.storage.local.get(
    ["adBlockingEnabled", "phishingWarningEnabled"],
    (result) => {
      adBlockingCheckbox.checked = result.adBlockingEnabled !== false;
      phishingCheckbox.checked = result.phishingWarningEnabled !== false;
    }
  );

  adBlockingCheckbox.addEventListener("change", () => {
    chrome.storage.local.set(
      { adBlockingEnabled: adBlockingCheckbox.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "TOGGLE_AD_BLOCKING",
          payload: { adBlockingEnabled: adBlockingCheckbox.checked },
        });
      }
    );
  });

  phishingCheckbox.addEventListener("change", () => {
    chrome.storage.local.set(
      { phishingWarningEnabled: phishingCheckbox.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "TOGGLE_PHISHING",
          payload: { phishingWarningEnabled: phishingCheckbox.checked },
        });
      }
    );
  });

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Update the site name to the current tab's domain
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
