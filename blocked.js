//blocked.js
function parseQueryParams() {
  const params = {};
  const queryString = window.location.search.substring(1);
  const pairs = queryString.split("&");
  pairs.forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    }
  });
  return params;
}
function redirectToURL(targetURL) {
  window.location.replace(targetURL);
}

function normalizeDomainInput(userInput) {
  if (!userInput) return "";
  let temp = userInput.trim();
  if (!/^https?:\/\//i.test(temp)) {
    temp = "https://" + temp;
  }
  try {
    const hostname = new URL(temp).hostname;
    return hostname.replace(/^www\./, "");
  } catch (err) {
    return userInput.trim();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Set the translated title using chrome.i18n
  document.title = chrome.i18n.getMessage("blockedPageTitle");

  // Parse query parameters to get the original URL
  const params = parseQueryParams();
  const originalURL = params.url || "";

  // Extract and normalize the domain from the original URL
  let domain = "";
  try {
    const urlObj = new URL(originalURL);
    const rawDomain = urlObj.hostname;
    domain = normalizeDomainInput(rawDomain);
  } catch (error) {}

  // Fetch status of disturbanceEnabled
  let disturbanceEnabled = await chrome.storage.local.get("disturbanceEnabled");
  if (disturbanceEnabled && disturbanceEnabled.disturbanceEnabled) {
    window.close();
    return;
  }
  // Check if the domain is already user domain blocked list
  else if (domain) {
    await chrome.storage.local.get("userBlockedDom", (result) => {
      const userBlockedDom = result.userBlockedDom || [];
      if (userBlockedDom.includes(domain)) {
        window.close();
        return;
      }
      initializePage();
    });
  } else {
    initializePage();
  }

  function initializePage() {
    const headerEl = document.querySelector("h1");
    if (headerEl) {
      headerEl.textContent = chrome.i18n.getMessage("blockedPageTitle");
    }

    // Build the blocked message in the paragraph element
    const paragraphEl = document.getElementById("first");
    paragraphEl.textContent = "";
    const textBefore = document.createTextNode(
      chrome.i18n.getMessage("blockedTextBeforeUrl") + ' "'
    );
    const boldDomain = document.createElement("strong");
    boldDomain.textContent = domain;
    const textAfter = document.createTextNode(
      '" ' + chrome.i18n.getMessage("blockedTextAfterUrl")
    );
    paragraphEl.appendChild(textBefore);
    paragraphEl.appendChild(boldDomain);
    paragraphEl.appendChild(textAfter);

    // Build the additional blocked message in the paragraph element
    const paragraphElAdditional = document.getElementById("second");
    paragraphElAdditional.textContent = "";
    const textBefore2 = document.createTextNode(
      chrome.i18n.getMessage("blockedTextAfterUrlAdditional")
    );
    paragraphElAdditional.appendChild(textBefore2);

    /***************************************************
     * Primary action: Smooth Stream and Download
     ***************************************************/
    const ssdBtn = document.getElementById("ssdBtn");

    let secondsLeft = 10;
    ssdBtn.textContent = `${chrome.i18n.getMessage(
      "ssdText"
    )} (${secondsLeft}s)`;

    const timer = setInterval(() => {
      secondsLeft--;
      ssdBtn.textContent = `${chrome.i18n.getMessage(
        "ssdText"
      )} (${secondsLeft}s)`;
      if (secondsLeft <= 0) {
        clearInterval(timer);

        // Send a message to the background script to set SSD
        chrome.runtime.sendMessage(
          {
            type: "featureOperation",
            payload: { disturbanceEnabled: true, feature: "disturbance" },
          },
          (response) => {
            if (chrome.runtime.lastError || !response?.success) {
              console.error(
                "[blocked.js] Error unblocking domain:",
                chrome.runtime.lastError || response.error
              );
              unblockBtn.disabled = false;
              alert(chrome.i18n.getMessage("unblockError"));
            } else {
              window.close();
            }
          }
        );
      }
    }, 1000);

    ssdBtn.addEventListener("click", (e) => {
      e.preventDefault();
      ssdBtn.disabled = true; // Prevent double-click
      clearInterval(timer);

      // Send a message to the background script to set SSD
      chrome.runtime.sendMessage(
        {
          type: "featureOperation",
          payload: { disturbanceEnabled: true, feature: "disturbance" },
        },
        (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            console.error(
              "[blocked.js] Error unblocking domain:",
              chrome.runtime.lastError || response.error
            );
            unblockBtn.disabled = false;
            alert(chrome.i18n.getMessage("unblockError"));
          } else {
            window.close();
          }
        }
      );
    });

    /***************************************************
     * Domain-specific block options (if a domain exists)
     ***************************************************/
    if (domain) {
      document.querySelector(".domain-block-options").style.display = "flex";
      const unblockDomainText = document.getElementById("unblockDomainText");
      unblockDomainText.style.display = "inline-block";
      unblockDomainText.innerHTML = `Unblock anyway: `;

      const unblockDomainBtn = document.getElementById("unblockDomainBtn");
      unblockDomainBtn.textContent = `${chrome.i18n.getMessage(
        "navigateOnce"
      )}`;
      const whitelistDomainBtn = document.getElementById("whitelistDomainBtn");
      whitelistDomainBtn.textContent = `${chrome.i18n.getMessage(
        "whitelisteForeverText"
      )}`;

      unblockDomainBtn.addEventListener("click", (e) => {
        e.preventDefault();
        unblockDomainBtn.disabled = true; // Prevent double-click

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentTab = tabs[0];
          const tabId = currentTab ? currentTab.id : null;
          // This call will perfom the redirect to origialUrl
          chrome.runtime.sendMessage(
            {
              type: "currentTabInfo",
              payload: { option: 3, domain, originalURL, tabId },
            },
            (response) => {
              if (!response.success) {
                console.error("Transient whitelist error:", response.error);
              }
            }
          );
        });
      });

      whitelistDomainBtn.addEventListener("click", (e) => {
        e.preventDefault();
        whitelistDomainBtn.disabled = true; // Prevent double-click

        // Send a message to the background script to whitelist (unblock) the domain
        chrome.runtime.sendMessage(
          {
            type: "whitelistOperation",
            payload: { domain, action: "add" },
          },
          (response) => {
            if (chrome.runtime.lastError || !response?.success) {
              console.error(
                "[blocked.js] Error unblocking domain:",
                chrome.runtime.lastError || response.error
              );
              unblockBtn.disabled = false;
              alert(chrome.i18n.getMessage("unblockError"));
            } else {
              // Redirect back to the original URL after a short delay
              setTimeout(() => {
                redirectToURL(originalURL);
              }, 500);
            }
          }
        );
      });
    }

    /***************************************************
     * Go to setting traduction
     ***************************************************/
    const goToSettingsLink = document.getElementById("goToSettingsLink");
    goToSettingsLink.textContent = chrome.i18n.getMessage("goToSettings");
  }
});
