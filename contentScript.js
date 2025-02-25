/************************************************************
 * contentScript.js
 ************************************************************/

(async () => {
  const type = self === top ? "top" : "iframe";

  // 1) Determine the current domain
  const domain = normalizeDomain(location.hostname);

  if (type === "top") {
    chrome.runtime.sendMessage({
      type: "GET_CURRENT_TAB_ID",
      payload: { option: 1, domain, name: "block" },
    });
  }

  // Helper: normalizeDomain
  function normalizeDomain(domain) {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  // Helper: Get background color based on alt text
  function getBackgroundColor(alt) {
    switch (alt) {
      case "Somewhat Similar to Legitimate Domains":
        return "#FFA500"; // Orange-Yellow
      case "Highly Similar to Legitimate Domains":
        return "#FF0000"; // Red
      case "Moderately Similar to Legitimate Domains":
        return "#FF4500"; // Orange
      case "Low Similarity to Legitimate Domains":
        return "#FFFF00"; // Yellow
      default:
        return "#FFFFFF"; // Default white
    }
  }

  const { pausedState, phishingWarningEnabled, phishingDomainsData } =
    await chrome.storage.local.get([
      "pausedState",
      "phishingWarningEnabled",
      "phishingDomainsData",
    ]);

  // Decide whether to hide the notification banner.
  // Even if the extension is paused or warnings are disabled,
  // we will create the notification bar but hide it.
  const hideBanner = pausedState?.isPaused || !phishingWarningEnabled;

  // If the domain is not flagged as phishing, clear the badge and exit.
  if (!phishingDomainsData || !phishingDomainsData[domain]) {
    chrome.runtime.sendMessage({
      type: "SET_PHISHING_BADGE",
      payload: { flagged: false },
    });
    return;
  }

  let tabId = null;

  // If it is flagged as a phishing site, get the current tab ID
  chrome.runtime.sendMessage(
    {
      type: "GET_CURRENT_TAB_ID",
      payload: { option: 2, domain, name: null },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Could not get tab ID:", chrome.runtime.lastError);
        return;
      } else {
        tabId = response.tabId;
      }
    }
  );

  // Domain is flagged
  console.log(`[contentScript] - WARNING - ${domain} is a PHISHING site.`);

  // Create a notification bar
  const notificationBar = document.createElement("div");
  notificationBar.style.position = "fixed";
  notificationBar.style.top = "0";
  notificationBar.style.left = "0";
  notificationBar.style.width = "100%";
  notificationBar.style.display = "flex"; // default display
  notificationBar.style.alignItems = "center";
  notificationBar.style.justifyContent = "center";
  notificationBar.style.zIndex = "10000";
  notificationBar.style.padding = "10px";
  notificationBar.style.boxShadow = "0px 2px 10px rgba(0, 0, 0, 0.1)";
  notificationBar.style.transition = "opacity 2s";

  // If the extension is paused or phishing warnings are disabled, hide the banner.
  if (hideBanner) {
    notificationBar.style.display = "none";
  }

  let imgEl = null;
  let titleEl = null;
  let messageEl = null;

  phishingDomainsData[domain].forEach((item) => {
    switch (item.type) {
      case "image": {
        imgEl = document.createElement("img");
        for (const attr in item.attributes) {
          if (item.attributes.hasOwnProperty(attr)) {
            switch (attr) {
              case "src":
                imgEl.src = chrome.runtime.getURL(item.attributes[attr]);
                break;
              case "alt":
                imgEl.alt = item.attributes[attr];
                // Set background color based on alt
                notificationBar.style.backgroundColor = getBackgroundColor(
                  item.attributes.alt
                );
                break;
              case "width":
                imgEl.width = item.attributes[attr];
                break;
              case "height":
                imgEl.height = item.attributes[attr];
                break;
              default:
                imgEl.setAttribute(attr, item.attributes[attr]);
            }
          }
        }
        imgEl.style.marginRight = "10px";
        break;
      }

      case "message": {
        titleEl = document.createElement("div");
        titleEl.style.fontWeight = "bold";
        titleEl.style.fontSize = "16px";
        titleEl.style.marginBottom = "5px";
        titleEl.innerText = item.message;
        break;
      }

      case "characteristics": {
        messageEl = document.createElement("div");
        messageEl.style.fontSize = "14px";
        messageEl.innerText = item.characteristics;
        break;
      }

      default:
        console.log("Unknown item.type:", item.type);
    }
  });

  // Append elements to the notification bar
  if (imgEl) notificationBar.appendChild(imgEl);
  const textContainer = document.createElement("div");
  if (titleEl) textContainer.appendChild(titleEl);
  if (messageEl) textContainer.appendChild(messageEl);
  notificationBar.appendChild(textContainer);

  // Wait for the DOM to be ready before appending
  if (document.body) {
    document.body.appendChild(notificationBar);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(notificationBar);
    });
  }

  // Example: fade out notification bar after 8s (only if visible)
  if (!hideBanner) {
    setTimeout(() => {
      notificationBar.style.opacity = "0";
    }, 8000);

    // Remove from DOM after fade out completes
    setTimeout(() => {
      if (notificationBar && notificationBar.parentNode) {
        notificationBar.parentNode.removeChild(notificationBar);
      }
    }, 10000);
  }

  // Also tell the background script to set a badge on this tab.
  // We flag the badge only if the banner is not hidden.
  chrome.runtime.sendMessage({
    type: "SET_PHISHING_BADGE",
    payload: { flagged: !hideBanner, tabId },
  });
})();
