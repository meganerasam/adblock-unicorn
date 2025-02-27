/************************************************************
 * blocked.js
 ************************************************************/

/**
 * Parses the query parameters from the current URL.
 * @returns {Object} An object containing key-value pairs of query parameters.
 */
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

/**
 * Redirects the current tab to the specified URL.
 * @param {string} targetURL - The URL to redirect to.
 */
function redirectToURL(targetURL) {
  window.location.replace(targetURL);
}

/************************************************************
 * Helper function to normalize domain input
 ************************************************************/
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
  } catch (error) {
    console.error("[blocked.js] Invalid original URL:", originalURL);
  }

  // Fetch status of disturbanceEnabled
  let disturbanceEnabled = await chrome.storage.local.get("disturbanceEnabled");
  if (disturbanceEnabled && disturbanceEnabled.disturbanceEnabled) {
    window.close();
    return;
  }
  // Check if the domain is already permanently blocked
  else if (domain) {
    await chrome.storage.local.get("foreverBlockedSites", (result) => {
      const foreverBlockedSites = result.foreverBlockedSites || [];
      if (foreverBlockedSites.includes(domain)) {
        window.close();
        return;
      }
      initializePage();
    });
  } else {
    initializePage();
  }

  function initializePage() {
    // Set header text (plain text only)
    const headerEl = document.querySelector("h1");
    if (headerEl) {
      headerEl.textContent = chrome.i18n.getMessage("blockedPageTitle");
    }

    // Build the blocked message in the paragraph element
    // const paragraphEl = document.querySelector("p");
    const paragraphEl = document.getElementById("first");
    paragraphEl.textContent = "";
    const textBefore = document.createTextNode(
      chrome.i18n.getMessage("blockedTextBefore") + ' "'
    );
    const boldDomain = document.createElement("strong");
    boldDomain.textContent = domain;
    const textAfter = document.createTextNode(
      '" ' + chrome.i18n.getMessage("blockedTextAfter")
    );
    paragraphEl.appendChild(textBefore);
    paragraphEl.appendChild(boldDomain);
    paragraphEl.appendChild(textAfter);

    // Build the blocked message in the paragraph element
    const paragraphEl2 = document.getElementById("second");
    paragraphEl2.textContent = "";
    const textBefore2 = document.createTextNode(
      chrome.i18n.getMessage("blockedTextBefore2")
    );
    paragraphEl2.appendChild(textBefore2);

    /***************************************************
     * Primary action: Auto close ALL ads and popups
     ***************************************************/
    const closeAllPopupsBtn = document.getElementById("closeAllPopupsBtn");

    let secondsLeft = 10;
    closeAllPopupsBtn.textContent = `${chrome.i18n.getMessage(
      "autoCloseAllMessage"
    )} (${secondsLeft}s)`;

    const timer = setInterval(() => {
      secondsLeft--;
      closeAllPopupsBtn.textContent = `${chrome.i18n.getMessage(
        "autoCloseAllMessage"
      )} (${secondsLeft}s)`;
      if (secondsLeft <= 0) {
        clearInterval(timer);

        // Send a message to the background script to auto close all popups
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

    closeAllPopupsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllPopupsBtn.disabled = true; // Prevent double-click
      clearInterval(timer);

      // Send a message to the background script to auto close all popups
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
      // Hardcoded text with the domain in bold—no i18n key available for this line.
      unblockDomainText.innerHTML = `Unblock anyway: `;

      const unblockDomainBtn = document.getElementById("unblockDomainBtn");
      unblockDomainBtn.textContent = `${chrome.i18n.getMessage(
        "unblockSiteNowMessage"
      )}`;
      const whitelistDomainBtn = document.getElementById("whitelistDomainBtn");
      whitelistDomainBtn.textContent = `${chrome.i18n.getMessage(
        "unblockSiteAlwaysMessage"
      )}`;

      unblockDomainBtn.addEventListener("click", (e) => {
        e.preventDefault();
        unblockDomainBtn.disabled = true; // Prevent double-click

        // REDIRECT TO ORIGINAL URL
        redirectToURL(originalURL);
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
