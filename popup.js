document.addEventListener("DOMContentLoaded", () => {
  const smoothStreamCheckbox = document.getElementById("smoothStreamCheckbox");
  const phishingCheckbox = document.getElementById("phishingCheckbox");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const siteNameEl = document.querySelector(".site-name");

  // Load settings
  chrome.storage.local.get(
    ["disturbanceEnabled", "phishingEnabled"],
    (result) => {
      smoothStreamCheckbox.checked = result.disturbanceEnabled !== false;
      phishingCheckbox.checked = result.phishingEnabled !== false;
    }
  );

  // Retrieve and display metrics.
  chrome.storage.local.get(
    ["urlTotalBlocked", "lifetimeTotalBlocked", "dailyTotalBlocked"],
    (result) => {
      // Get current tab's domain.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let currentDomain = "";
        if (tabs.length && tabs[0].url) {
          try {
            const urlObj = new URL(tabs[0].url);
            currentDomain = urlObj.hostname.replace(/^www\./, "");
          } catch (err) {
            console.error("Error parsing URL:", err);
          }
        }
        const urlTotalBlocked = result.urlTotalBlocked || {};
        const lifetimeTotal = result.lifetimeTotalBlocked || 0;
        const dailyTotalObj = result.dailyTotalBlocked || { count: 0 };
        const dailyTotal = dailyTotalObj.count || 0;
        const siteBlocked = urlTotalBlocked[currentDomain] || 0;

        document.getElementById("siteBlockedMetric").textContent = siteBlocked;
        document.getElementById("dailyBlockedMetric").textContent = dailyTotal;
        document.getElementById("lifetimeBlockedMetric").textContent =
          lifetimeTotal;
      });
    }
  );

  // Checkbox change listeners
  smoothStreamCheckbox.addEventListener("change", () => {
    chrome.storage.local.set(
      { disturbanceEnabled: smoothStreamCheckbox.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "featureOperation",
          payload: {
            disturbanceEnabled: smoothStreamCheckbox.checked,
            feature: "disturbance",
          },
        });
      }
    );
  });

  phishingCheckbox.addEventListener("change", () => {
    chrome.storage.local.set(
      { phishingEnabled: phishingCheckbox.checked },
      () => {
        chrome.runtime.sendMessage({
          type: "featureOperation",
          payload: {
            phishingEnabled: phishingCheckbox.checked,
            feature: "phishing",
          },
        });
      }
    );
  });

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Update the site name to the current tab's domain.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length && tabs[0].url) {
      try {
        const urlObj = new URL(tabs[0].url);
        const domain = urlObj.hostname.replace(/^www\./, "");
        siteNameEl.textContent = domain;
      } catch (err) {
        console.error("Error parsing URL:", err);
        siteNameEl.textContent = "-";
      }
    }
  });
});
