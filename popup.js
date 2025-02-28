document.addEventListener("DOMContentLoaded", () => {
  const smoothStreamCheckbox = document.getElementById("smoothStreamCheckbox");
  const phishingCheckbox = document.getElementById("phishingCheckbox");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const siteNameEl = document.querySelector(".site-name");

  // Load settings for features
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

  // Checkbox change listeners for features
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

  // Update the site name and initialize the site-specific ad block button.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length && tabs[0].url) {
      try {
        const urlObj = new URL(tabs[0].url);
        const domain = urlObj.hostname.replace(/^www\./, "");
        siteNameEl.textContent = domain;

        // Set the state of the site-specific ad block button.
        chrome.storage.local.get(["userWhitelistedDom"], (result) => {
          const whitelist = result.userWhitelistedDom || [];
          const isWhitelisted = whitelist.includes(domain);
          const siteAdBlockButton =
            document.getElementById("siteAdBlockButton");
          if (isWhitelisted) {
            siteAdBlockButton.textContent = "Ad Blocker (This Site): OFF";
            siteAdBlockButton.classList.add("off");
          } else {
            siteAdBlockButton.textContent = "Ad Blocker (This Site): ON";
            siteAdBlockButton.classList.remove("off");
          }
        });
      } catch (err) {
        console.error("Error parsing URL:", err);
        siteNameEl.textContent = "-";
      }
    }
  });

  // Handle site-specific ad block button click.
  document.getElementById("siteAdBlockButton").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length && tabs[0].url) {
        try {
          const urlObj = new URL(tabs[0].url);
          const domain = urlObj.hostname.replace(/^www\./, "");
          const siteAdBlockButton =
            document.getElementById("siteAdBlockButton");
          const isCurrentlyOn = !siteAdBlockButton.classList.contains("off");
          if (isCurrentlyOn) {
            // Turn off ad blocking: add domain to whitelist.
            chrome.runtime.sendMessage(
              {
                type: "whitelistOperation",
                payload: { domain: domain, action: "add" },
              },
              (response) => {
                if (response && response.success) {
                  siteAdBlockButton.textContent = "Ad Blocker (This Site): OFF";
                  siteAdBlockButton.classList.add("off");
                }
              }
            );
          } else {
            // Turn on ad blocking: remove domain from whitelist.
            chrome.runtime.sendMessage(
              {
                type: "whitelistOperation",
                payload: { domain: domain, action: "remove" },
              },
              (response) => {
                if (response && response.success) {
                  siteAdBlockButton.textContent = "Ad Blocker (This Site): ON";
                  siteAdBlockButton.classList.remove("off");
                }
              }
            );
          }
        } catch (err) {
          console.error("Error in site-specific button toggle:", err);
        }
      }
    });
  });
});
