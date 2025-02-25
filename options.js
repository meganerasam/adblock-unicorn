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
  // Pause Active Containers
  // -------------------------------
  const pauseActiveGuide = document.getElementById("pauseActiveGuide");
  const pauseCountdownGuide = document.getElementById("pauseCountdownGuide");
  const pauseActiveWebsites = document.getElementById("pauseActiveWebsites");
  const pauseCountdownWebsites = document.getElementById(
    "pauseCountdownWebsites"
  );
  const pauseActiveSettings = document.getElementById("pauseActiveSettings");
  const pauseCountdownSettings = document.getElementById(
    "pauseCountdownSettings"
  );

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
  // Toggling Pause
  // -------------------------------
  const pauseToggle = document.getElementById("pauseToggle");
  const pauseToggleLabel = document.getElementById("pauseToggleLabel");

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
  // Real-time countdown interval
  // -------------------------------
  let countdownInterval = null;

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

    // Notify background to adjust rules
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

          // Notify background to adjust rules
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

    // Notify background to block domain
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

          // Notify background to remove blocked domain
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
    // Notify background to reset the extension
    chrome.runtime.sendMessage(
      {
        type: "RESET_EXTENSION",
        payload: {},
      },
      (response) => {
        if (response && response.success) {
          resetConfirmDialog.style.display = "none";
          // Optionally, reload the page to reflect changes
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

  /**
   * navigate - Handles navigation based on hash.
   * @param {string} hash - The current hash fragment.
   */
  function navigate(hash, replace = false) {
    const path = hash.replace("#", "") || "/guide";
    const content = routes[path] || routes["/guide"];

    // Hide all content sections
    Object.values(routes).forEach((section) => {
      section.style.display = "none";
    });

    // Show the selected content section
    content.style.display = "block";

    // Update active link styling
    updateActiveLink(path);
  }

  /**
   * updateActiveLink - Updates the styling of the active sidebar link.
   * @param {string} path - The current path.
   */
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

  /**
   * handleHashChange - Handles hash change events.
   */
  function handleHashChange() {
    navigate(window.location.hash, true);
  }

  // Attach hash change event listener
  window.addEventListener("hashchange", handleHashChange);

  /**
   * initializeRouting - Initializes routing based on the current URL.
   */
  function initializeRouting() {
    navigate(window.location.hash, true);
  }

  // Initialize routing on page load
  initializeRouting();

  // -------------------------------
  // Initialize Pause Toggle
  // -------------------------------
  initializePauseToggle();

  // -------------------------------
  // Initialize Ad-Blocking Toggle
  // -------------------------------
  initializeAdBlockingToggle();

  // -------------------------------
  // Initialize Auto Toggle
  // -------------------------------
  initializeAutoCloseToggle();

  // -------------------------------
  // Initialize Phishing Warning Toggle
  // -------------------------------
  initializePhishingWarningToggle();

  // -------------------------------
  // Initialize Whitelisted Sites Table
  // -------------------------------
  let whitelistedSites = [];
  const storedWhitelist = await chrome.storage.local.get("whitelistedSites");
  whitelistedSites = storedWhitelist.whitelistedSites || [];
  renderWhitelistedSitesTable();

  // -------------------------------
  // Initialize Blocked Sites Table
  // -------------------------------
  let blockedSites = [];
  const storedBlocked = await chrome.storage.local.get("foreverBlockedSites");
  blockedSites = storedBlocked.foreverBlockedSites || [];
  renderBlockedSitesTable();

  // -------------------------------
  // Listen for storage changes to update UI in real-time
  // -------------------------------
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      // Update Ad-Blocking toggle if changed
      if (changes.adBlockingEnabled) {
        adBlockingToggle.checked = changes.adBlockingEnabled.newValue;
      }

      // Update Auto Close toggle if changed
      if (changes.autoCloseAllEnabled) {
        autoCloseToggle.textContent = changes.autoCloseAllEnabled.newValue
          ? "ON"
          : "OFF";
        autoCloseToggle.checked = changes.autoCloseAllEnabled.newValue;
      }

      // Update Phishing Warning toggle if changed
      if (changes.phishingWarningEnabled) {
        phishingToggle.checked = changes.phishingWarningEnabled.newValue;
      }

      // Update Pause state containers if pausedState changed
      if (changes.pausedState) {
        const pausedState = changes.pausedState.newValue;
        if (pausedState && pausedState.isPaused) {
          // Update the toggle control to ON
          pauseToggle.checked = true;
          pauseToggleLabel.textContent = "ON";

          // Show pause containers
          pauseActiveGuide.style.display = "block";
          pauseActiveWebsites.style.display = "block";
          pauseActiveSettings.style.display = "block";

          if (pausedState.resumeTimestamp !== "Always") {
            const endTime = Number(pausedState.resumeTimestamp);
            if (!isNaN(endTime) && endTime > Date.now()) {
              startRealTimeCountdown(endTime);
            }
          } else {
            // Handle 'Always' pause
            const countdownElements = [
              pauseCountdownGuide,
              pauseCountdownWebsites,
              pauseCountdownSettings,
            ];
            countdownElements.forEach((el) => {
              if (el) el.textContent = "Always";
            });
          }
        } else {
          // Update the toggle control to OFF
          pauseToggle.checked = false;
          pauseToggleLabel.textContent = "OFF";

          // Hide pause containers
          pauseActiveGuide.style.display = "none";
          pauseActiveWebsites.style.display = "none";
          pauseActiveSettings.style.display = "none";

          // Reset countdowns
          const countdownElements = [
            pauseCountdownGuide,
            pauseCountdownWebsites,
            pauseCountdownSettings,
          ];
          countdownElements.forEach((el) => {
            if (el) el.textContent = "00:00";
          });

          // Stop the real-time countdown
          stopRealTimeCountdown();
        }
      }

      // Update Blocked Sites if changed
      if (changes.foreverBlockedSites) {
        blockedSites = changes.foreverBlockedSites.newValue;
        renderBlockedSitesTable();
      }
    }
  });

  /************************************************************
   * initializePauseToggle - Initializes the Pause toggle state and event listener
   ************************************************************/
  function initializePauseToggle() {
    // Retrieve the current pause state from storage
    chrome.storage.local.get("pausedState", (data) => {
      const pausedState = data.pausedState;
      if (pausedState && pausedState.isPaused) {
        pauseToggle.checked = true;
        pauseToggleLabel.textContent = "ON";
        pauseActiveGuide.style.display = "block";
        pauseActiveWebsites.style.display = "block";
        pauseActiveSettings.style.display = "block";

        if (pausedState.resumeTimestamp !== "Always") {
          const endTime = Number(pausedState.resumeTimestamp);
          if (!isNaN(endTime) && endTime > Date.now()) {
            startRealTimeCountdown(endTime);
          }
        } else {
          const countdownElements = [
            pauseCountdownGuide,
            pauseCountdownWebsites,
            pauseCountdownSettings,
          ];
          countdownElements.forEach((el) => {
            if (el) el.textContent = "Always";
          });
        }
      } else {
        pauseToggle.checked = false;
        pauseToggleLabel.textContent = "OFF";
        pauseActiveGuide.style.display = "none";
        pauseActiveWebsites.style.display = "none";
        pauseActiveSettings.style.display = "none";

        const countdownElements = [
          pauseCountdownGuide,
          pauseCountdownWebsites,
          pauseCountdownSettings,
        ];
        countdownElements.forEach((el) => {
          if (el) el.textContent = "00:00";
        });
      }
    });

    // Add event listener for pause toggle changes
    pauseToggle.addEventListener("change", () => {
      if (pauseToggle.checked) {
        chrome.runtime.sendMessage(
          {
            type: "PAUSE_EXTENSION",
            payload: { resumeOption: "1 hour" },
          },
          (response) => {
            if (response && response.success) {
              pauseToggleLabel.textContent = "ON";
              pauseActiveGuide.style.display = "block";
              pauseActiveWebsites.style.display = "block";
              pauseActiveSettings.style.display = "block";
              const endTime = Number(response.resumeTimestamp);
              startRealTimeCountdown(endTime);
            } else {
              console.warn("Failed to start pause.");
              pauseToggle.checked = false;
              pauseToggleLabel.textContent = "OFF";
            }
          }
        );
      } else {
        chrome.runtime.sendMessage({ type: "RESUME_EXTENSION" }, (response) => {
          if (response && response.success) {
            pauseToggleLabel.textContent = "OFF";
            pauseActiveGuide.style.display = "none";
            pauseActiveWebsites.style.display = "none";
            pauseActiveSettings.style.display = "none";
            stopRealTimeCountdown();
          } else {
            console.warn("Failed to resume extension.");
            pauseToggle.checked = true;
            pauseToggleLabel.textContent = "ON";
          }
        });
      }
    });
  }

  /************************************************************
   * initializeAdBlockingToggle - Initializes the Ad-Blocking toggle state and event listener
   ************************************************************/
  function initializeAdBlockingToggle() {
    if (adBlockingToggle) {
      // Retrieve the current state from storage
      chrome.storage.local.get("adBlockingEnabled", (data) => {
        adBlockingToggle.checked = data.adBlockingEnabled !== false; // Default to true if not set
      });

      // Add event listener for changes
      adBlockingToggle.addEventListener("change", () => {
        const isEnabled = adBlockingToggle.checked;
        // Save the state to storage
        chrome.storage.local.set({ adBlockingEnabled: isEnabled }, () => {});

        // Send message to background.js
        chrome.runtime.sendMessage(
          {
            type: "TOGGLE_AD_BLOCKING",
            payload: { adBlockingEnabled: isEnabled },
          },
          (response) => {
            if (response && response.success) {
            } else {
              console.warn("Failed to update Ad-Blocking state.");
            }
          }
        );
      });
    }
  }

  /************************************************************
   * initializeAutoCloseToggle - Initializes the Auto Close toggle state and event listener
   ************************************************************/
  function initializeAutoCloseToggle() {
    if (autoCloseToggle) {
      // Retrieve the current state from storage
      chrome.storage.local.get("autoCloseAllEnabled", (data) => {
        autoCloseToggleLabel.textContent = data.autoCloseAllEnabled
          ? "ON"
          : "OFF";
        autoCloseToggle.checked = data.autoCloseAllEnabled;
      });

      // Add event listener for changes
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
  }

  /************************************************************
   * initializePhishingWarningToggle - Initializes the Phishing Warning toggle state and event listener
   ************************************************************/
  function initializePhishingWarningToggle() {
    if (phishingToggle) {
      // Retrieve the current state from storage
      chrome.storage.local.get("phishingWarningEnabled", (data) => {
        phishingToggle.checked = data.phishingWarningEnabled !== false; // Default to true if not set
      });

      // Add event listener for changes
      phishingToggle.addEventListener("change", () => {
        const isEnabled = phishingToggle.checked;
        // Save the state to storage
        chrome.storage.local.set(
          { phishingWarningEnabled: isEnabled },
          () => {}
        );

        // Send message to background.js
        chrome.runtime.sendMessage(
          {
            type: "TOGGLE_PHISHING",
            payload: { phishingWarningEnabled: isEnabled },
          },
          (response) => {
            if (response && response.success) {
            } else {
              console.warn("Failed to update Phishing Warning state.");
            }
          }
        );
      });
    }
  }

  /************************************************************
   * Pause Countdown Functions
   ************************************************************/
  function updateAllCountdowns(endTime) {
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
      // Time is up, reset UI and stop countdown
      const countdownElements = [
        pauseCountdownGuide,
        pauseCountdownWebsites,
        pauseCountdownSettings,
      ];
      countdownElements.forEach((el) => {
        if (el) el.textContent = "00:00";
      });

      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      // Uncheck the pause toggle and update label
      pauseToggle.checked = false;
      pauseToggleLabel.textContent = "OFF";

      // Hide pause containers
      pauseActiveGuide.style.display = "none";
      pauseActiveWebsites.style.display = "none";
      pauseActiveSettings.style.display = "none";

      // Send message to background to resume extension
      chrome.runtime.sendMessage({ type: "RESUME_EXTENSION" }, (response) => {
        if (response && response.success) {
        }
      });
    } else {
      const totalSeconds = Math.floor(remaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const displayTime =
        (hours > 0 ? `${hours}h ` : "") +
        (minutes > 0 ? `${minutes}m ` : "") +
        `${seconds}s left`;

      const countdownElements = [
        pauseCountdownGuide,
        pauseCountdownWebsites,
        pauseCountdownSettings,
      ];
      countdownElements.forEach((el) => {
        if (el) el.textContent = displayTime;
      });
    }
  }

  function startRealTimeCountdown(endTime) {
    // Clear any existing interval
    if (countdownInterval) clearInterval(countdownInterval);

    // Initial update
    updateAllCountdowns(endTime);

    // Set up interval to update countdowns every second
    countdownInterval = setInterval(() => {
      updateAllCountdowns(endTime);
    }, 1000); // 1000ms for proper countdown
  }

  function stopRealTimeCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Reset all countdown displays
    const countdownElements = [
      pauseCountdownGuide,
      pauseCountdownWebsites,
      pauseCountdownSettings,
    ];
    countdownElements.forEach((el) => {
      if (el) el.textContent = "00:00";
    });
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
});
