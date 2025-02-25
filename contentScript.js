/************************************************************
 * contentScript.js
 ************************************************************/

(async () => {
  const type = self === top ? "top" : "iframe";
  const domain = normalizeDomain(location.hostname);
  if (type === "top") {
    chrome.runtime.sendMessage({
      type: "GET_CURRENT_TAB_ID",
      payload: { option: 1, domain, name: "block" },
    });
  }
  function normalizeDomain(domain) {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }
  function getBackgroundColor(alt) {
    switch (alt) {
      case "Somewhat Similar to Legitimate Domains":
        return "#FFA500";
      case "Highly Similar to Legitimate Domains":
        return "#FF0000";
      case "Moderately Similar to Legitimate Domains":
        return "#FF4500";
      case "Low Similarity to Legitimate Domains":
        return "#FFFF00";
      default:
        return "#FFFFFF";
    }
  }
  // Removed pausedState from the storage get.
  const { phishingWarningEnabled, phishingDomainsData } =
    await chrome.storage.local.get([
      "phishingWarningEnabled",
      "phishingDomainsData",
    ]);
  // Now the banner visibility depends solely on phishingWarningEnabled.
  const hideBanner = !phishingWarningEnabled;
  if (!phishingDomainsData || !phishingDomainsData[domain]) {
    chrome.runtime.sendMessage({
      type: "SET_PHISHING_BADGE",
      payload: { flagged: false },
    });
    return;
  }
  let tabId = null;
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
  console.log(`[contentScript] - WARNING - ${domain} is a PHISHING site.`);
  const notificationBar = document.createElement("div");
  notificationBar.style.position = "fixed";
  notificationBar.style.top = "0";
  notificationBar.style.left = "0";
  notificationBar.style.width = "100%";
  notificationBar.style.display = "flex";
  notificationBar.style.alignItems = "center";
  notificationBar.style.justifyContent = "center";
  notificationBar.style.zIndex = "10000";
  notificationBar.style.padding = "10px";
  notificationBar.style.boxShadow = "0px 2px 10px rgba(0, 0, 0, 0.1)";
  notificationBar.style.transition = "opacity 2s";
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
  if (imgEl) notificationBar.appendChild(imgEl);
  const textContainer = document.createElement("div");
  if (titleEl) textContainer.appendChild(titleEl);
  if (messageEl) textContainer.appendChild(messageEl);
  notificationBar.appendChild(textContainer);
  if (document.body) {
    document.body.appendChild(notificationBar);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(notificationBar);
    });
  }
  if (!hideBanner) {
    setTimeout(() => {
      notificationBar.style.opacity = "0";
    }, 8000);
    setTimeout(() => {
      if (notificationBar && notificationBar.parentNode) {
        notificationBar.parentNode.removeChild(notificationBar);
      }
    }, 10000);
  }
  chrome.runtime.sendMessage({
    type: "SET_PHISHING_BADGE",
    payload: { flagged: !hideBanner, tabId },
  });
})();
