/************************************************************
 * options.js
 ************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------
  // Whitelisted Site Dialog Elements
  // -------------------------------
  const showAddWhitelistSiteBtn = document.getElementById(
    "showAddWhitelistSiteBtn"
  );
  const whitelistDialog = document.getElementById("whitelistDialog");
  const whitelistDialogClose = document.getElementById("whitelistDialogClose");
  const cancelWhitelistBtn = document.getElementById("cancelWhitelistBtn");
  const saveWhitelistBtn = document.getElementById("saveWhitelistBtn");
  const whitelistDomainInput = document.getElementById("whitelistDomainInput");
  const whitelistDomainError = document.getElementById("whitelistDomainError");
  const whitelistedSitesTableBody = document.getElementById(
    "whitelistedSitesTableBody"
  );

  // -------------------------------
  // Blocked Domain Dialog Elements
  // -------------------------------
  const showAddBlockedSiteBtn = document.getElementById(
    "showAddBlockedSiteBtn"
  );
  const blockedDialog = document.getElementById("blockedDialog");
  const blockedDialogClose = document.getElementById("blockedDialogClose");
  const cancelBlockedBtn = document.getElementById("cancelBlockedBtn");
  const saveBlockedBtn = document.getElementById("saveBlockedBtn");
  const blockedDomainInput = document.getElementById("blockedDomainInput");
  const blockedDomainError = document.getElementById("blockedDomainError");
  const blockedSitesTableBody = document.getElementById(
    "blockedSitesTableBody"
  );

  // -------------------------------
  // Reset Extension Dialog Elements
  // -------------------------------
  const resetExtensionBtn = document.getElementById("resetExtensionBtn");
  const resetConfirmDialog = document.getElementById("resetConfirmDialog");
  const resetConfirmDialogClose = document.getElementById(
    "resetConfirmDialogClose"
  );
  const confirmResetBtn = document.getElementById("confirmResetBtn");
  const cancelResetBtn = document.getElementById("cancelResetBtn");

  // -------------------------------
  // Tab Switching Elements
  // -------------------------------
  const guideLink = document.getElementById("guideLink");
  const websitesLink = document.getElementById("websitesLink");
  const settingsLink = document.getElementById("settingsLink");
  const guideContent = document.getElementById("guideContent");
  const websitesContent = document.getElementById("websitesContent");
  const settingsContent = document.getElementById("settingsContent");

  // -------------------------------
  // Toggling Ad-Blocking
  // -------------------------------
  const adBlockingToggle = document.getElementById("adBlockingToggle");
  const adBlockingToggleLabel = document.getElementById(
    "adBlockingToggleLabel"
  );

  // -------------------------------
  // Toggling Auto Close
  // -------------------------------
  const autoCloseToggle = document.getElementById("autoCloseToggle");
  const autoCloseToggleLabel = document.getElementById("autoCloseToggleLabel");

  // -------------------------------
  // Toggling Phishing Warning
  // -------------------------------
  const phishingToggle = document.getElementById("phishingToggle");
  const phishingToggleLabel = document.getElementById("phishingToggleLabel");

  // -------------------------------
  // Whitelist Functionality
  // -------------------------------
  showAddWhitelistSiteBtn.addEventListener("click", openWhitelistDialog);
  whitelistDialogClose.addEventListener("click", closeWhitelistDialog);
  cancelWhitelistBtn.addEventListener("click", closeWhitelistDialog);

  whitelistDialog.addEventListener("click", (e) => {
    if (e.target === whitelistDialog) {
      closeWhitelistDialog();
    }
  });

  async function saveWhitelistDomain() {
    whitelistDomainError.textContent = "";
    const rawDomain = whitelistDomainInput.value.trim();
    const domain = normalizeDomainInput(rawDomain);
    if (!domain) {
      whitelistDomainError.textContent = "Please enter a valid domain name.";
      return;
    }
    if (whitelistedSites.includes(domain)) {
      whitelistDomainError.textContent = "This domain is already whitelisted.";
      return;
    }
    whitelistedSites.push(domain);
    await chrome.storage.local.set({ whitelistedSites });
    renderWhitelistedSitesTable();
    closeWhitelistDialog();
    chrome.runtime.sendMessage({
      type: "WHITELIST_DOMAIN",
      payload: { domain },
    });
  }

  saveWhitelistBtn.addEventListener("click", saveWhitelistDomain);

  function openWhitelistDialog() {
    whitelistDomainInput.value = "";
    whitelistDomainError.textContent = "";
    whitelistDialog.style.display = "flex";
  }

  function closeWhitelistDialog() {
    whitelistDialog.style.display = "none";
  }

  function renderWhitelistedSitesTable() {
    whitelistedSitesTableBody.innerHTML = "";
    if (whitelistedSites.length === 0) {
      whitelistedSitesTableBody.innerHTML = `<tr><td colspan="2">No websites whitelisted</td></tr>`;
      return;
    }
    whitelistedSites.forEach((domain) => {
      const row = `
          <tr>
            <td>${domain}</td>
            <td>
              <button
                class="btn-remove"
                data-domain="${domain}"
                data-tooltip="Remove from whitelisted domains"
              >
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      whitelistedSitesTableBody.innerHTML += row;
    });
    attachWhitelistRemoveListeners();
  }

  function attachWhitelistRemoveListeners() {
    document
      .querySelectorAll("#whitelistedSitesTableBody .btn-remove")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const domain = btn.getAttribute("data-domain");
          whitelistedSites = whitelistedSites.filter((d) => d !== domain);
          await chrome.storage.local.set({ whitelistedSites });
          renderWhitelistedSitesTable();
          chrome.runtime.sendMessage({
            type: "REMOVE_WHITELIST_DOMAIN",
            payload: { domain },
          });
        });
      });
  }

  // -------------------------------
  // Blocked Domains Functionality
  // -------------------------------
  showAddBlockedSiteBtn.addEventListener("click", openBlockedDialog);
  blockedDialogClose.addEventListener("click", closeBlockedDialog);
  cancelBlockedBtn.addEventListener("click", closeBlockedDialog);

  blockedDialog.addEventListener("click", (e) => {
    if (e.target === blockedDialog) {
      closeBlockedDialog();
    }
  });

  async function saveBlockedDomain() {
    blockedDomainError.textContent = "";
    const rawDomain = blockedDomainInput.value.trim();
    const domain = normalizeDomainInput(rawDomain);
    if (!domain) {
      blockedDomainError.textContent = "Please enter a valid domain name.";
      return;
    }
    if (blockedSites.includes(domain)) {
      blockedDomainError.textContent = "This domain is already blocked.";
      return;
    }
    blockedSites.push(domain);
    await chrome.storage.local.set({ foreverBlockedSites: blockedSites });
    renderBlockedSitesTable();
    closeBlockedDialog();
    chrome.runtime.sendMessage({
      type: "BLOCK_DOMAIN",
      payload: { domain },
    });
  }

  saveBlockedBtn.addEventListener("click", saveBlockedDomain);

  function openBlockedDialog() {
    blockedDomainInput.value = "";
    blockedDomainError.textContent = "";
    blockedDialog.style.display = "flex";
  }

  function closeBlockedDialog() {
    blockedDialog.style.display = "none";
  }

  function renderBlockedSitesTable() {
    blockedSitesTableBody.innerHTML = "";
    if (blockedSites.length === 0) {
      blockedSitesTableBody.innerHTML = `<tr><td colspan="2">No blocked domains</td></tr>`;
      return;
    }
    blockedSites.forEach((domain) => {
      const row = `
          <tr>
            <td>${domain}</td>
            <td>
              <button
                class="btn-remove"
                data-domain="${domain}"
                data-tooltip="Remove from blocked domains"
              >
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      blockedSitesTableBody.innerHTML += row;
    });
    attachBlockedRemoveListeners();
  }

  function attachBlockedRemoveListeners() {
    document
      .querySelectorAll("#blockedSitesTableBody .btn-remove")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const domain = btn.getAttribute("data-domain");
          blockedSites = blockedSites.filter((d) => d !== domain);
          await chrome.storage.local.set({ foreverBlockedSites: blockedSites });
          renderBlockedSitesTable();
          chrome.runtime.sendMessage({
            type: "REMOVE_BLOCK_DOMAIN",
            payload: { domain },
          });
        });
      });
  }

  // -------------------------------
  // Reset Extension Functionality
  // -------------------------------
  resetExtensionBtn.addEventListener("click", () => {
    resetConfirmDialog.style.display = "flex";
  });

  resetConfirmDialogClose.addEventListener("click", () => {
    resetConfirmDialog.style.display = "none";
  });

  cancelResetBtn.addEventListener("click", () => {
    resetConfirmDialog.style.display = "none";
  });

  confirmResetBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      {
        type: "RESET_EXTENSION",
        payload: {},
      },
      (response) => {
        if (response && response.success) {
          resetConfirmDialog.style.display = "none";
          location.reload();
        } else {
          console.warn("Failed to reset extension.");
        }
      }
    );
  });

  // -------------------------------
  // Routing Setup
  // -------------------------------
  const routes = {
    "/guide": guideContent,
    "/websites": websitesContent,
    "/settings": settingsContent,
  };

  function navigate(hash, replace = false) {
    const path = hash.replace("#", "") || "/guide";
    const content = routes[path] || routes["/guide"];
    Object.values(routes).forEach((section) => {
      section.style.display = "none";
    });
    content.style.display = "block";
    updateActiveLink(path);
  }

  function updateActiveLink(path) {
    document.querySelectorAll(".sidebar a").forEach((link) => {
      const linkPath = link.getAttribute("href").replace("#", "");
      if (linkPath === path) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function handleHashChange() {
    navigate(window.location.hash, true);
  }

  window.addEventListener("hashchange", handleHashChange);
  navigate(window.location.hash, true);

  // -------------------------------
  // Initialize Toggles (Ad-Blocking, Auto Close, Phishing)
  // -------------------------------
  function initializeAdBlockingToggle() {
    chrome.storage.local.get("adBlockingEnabled", (data) => {
      adBlockingToggle.checked = data.adBlockingEnabled !== false;
    });
    adBlockingToggle.addEventListener("change", () => {
      const isEnabled = adBlockingToggle.checked;
      chrome.storage.local.set({ adBlockingEnabled: isEnabled });
      chrome.runtime.sendMessage(
        {
          type: "TOGGLE_AD_BLOCKING",
          payload: { adBlockingEnabled: isEnabled },
        },
        (response) => {
          if (!response || !response.success) {
            console.warn("Failed to update Ad-Blocking state.");
          }
        }
      );
      adBlockingToggleLabel.textContent = isEnabled ? "ON" : "OFF";
    });
  }

  function initializeAutoCloseToggle() {
    chrome.storage.local.get("autoCloseAllEnabled", (data) => {
      autoCloseToggle.checked = data.autoCloseAllEnabled;
      autoCloseToggleLabel.textContent = data.autoCloseAllEnabled
        ? "ON"
        : "OFF";
    });
    autoCloseToggle.addEventListener("change", () => {
      const isEnabled = autoCloseToggle.checked;
      autoCloseToggleLabel.textContent = isEnabled ? "ON" : "OFF";
      chrome.storage.local.set({ autoCloseAllEnabled: isEnabled });
      chrome.runtime.sendMessage(
        {
          type: "AUTO_CLOSE_ALL",
          payload: { autoCloseAllEnabled: isEnabled },
        },
        (response) => {
          if (!response || !response.success) {
            console.warn("Failed to update Auto Close state.");
          }
        }
      );
    });
  }

  function initializePhishingWarningToggle() {
    chrome.storage.local.get("phishingWarningEnabled", (data) => {
      phishingToggle.checked = data.phishingWarningEnabled !== false;
    });
    phishingToggle.addEventListener("change", () => {
      const isEnabled = phishingToggle.checked;
      chrome.storage.local.set({ phishingWarningEnabled: isEnabled });
      chrome.runtime.sendMessage(
        {
          type: "TOGGLE_PHISHING",
          payload: { phishingWarningEnabled: isEnabled },
        },
        (response) => {
          if (!response || !response.success) {
            console.warn("Failed to update Phishing Warning state.");
          }
        }
      );
      phishingToggleLabel.textContent = isEnabled ? "ON" : "OFF";
    });
  }

  // -------------------------------
  // Initialize Stored Data and UI
  // -------------------------------
  let whitelistedSites = [];
  let blockedSites = [];
  const storedWhitelist = await chrome.storage.local.get("whitelistedSites");
  whitelistedSites = storedWhitelist.whitelistedSites || [];
  renderWhitelistedSitesTable();

  const storedBlocked = await chrome.storage.local.get("foreverBlockedSites");
  blockedSites = storedBlocked.foreverBlockedSites || [];
  renderBlockedSitesTable();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.adBlockingEnabled) {
        adBlockingToggle.checked = changes.adBlockingEnabled.newValue;
      }
      if (changes.autoCloseAllEnabled) {
        autoCloseToggle.checked = changes.autoCloseAllEnabled.newValue;
        autoCloseToggleLabel.textContent = changes.autoCloseAllEnabled.newValue
          ? "ON"
          : "OFF";
      }
      if (changes.phishingWarningEnabled) {
        phishingToggle.checked = changes.phishingWarningEnabled.newValue;
      }
      if (changes.foreverBlockedSites) {
        blockedSites = changes.foreverBlockedSites.newValue;
        renderBlockedSitesTable();
      }
    }
  });

  // Helper function to normalize domain input
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

  // Initialize toggles
  initializeAdBlockingToggle();
  initializeAutoCloseToggle();
  initializePhishingWarningToggle();
});
