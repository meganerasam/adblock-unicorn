/************************************************************
 * options.js
 ************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------
  // Elements for Whitelisted Domains
  // -------------------------------
  const showAddWhitelistSiteBtn = document.getElementById(
    "showAddWhitelistSiteBtn"
  );
  const whitelistAddForm = document.getElementById("whitelistAddForm");
  const whitelistDomainInput = document.getElementById("whitelistDomainInput");
  const saveWhitelistBtn = document.getElementById("saveWhitelistBtn");
  const cancelWhitelistBtn = document.getElementById("cancelWhitelistBtn");
  const whitelistedList = document.getElementById("whitelistedList");
  const whitelistErrorMsg = document.getElementById("whitelistErrorMsg");

  // -------------------------------
  // Elements for Blocked Domains
  // -------------------------------
  const showAddBlockedSiteBtn = document.getElementById(
    "showAddBlockedSiteBtn"
  );
  const blockedAddForm = document.getElementById("blockedAddForm");
  const blockedDomainInput = document.getElementById("blockedDomainInput");
  const saveBlockedBtn = document.getElementById("saveBlockedBtn");
  const cancelBlockedBtn = document.getElementById("cancelBlockedBtn");
  const blockedList = document.getElementById("blockedList");
  const blockedErrorMsg = document.getElementById("blockedErrorMsg");

  // -------------------------------
  // Elements for Reset Confirmation
  // -------------------------------
  const resetExtensionBtn = document.getElementById("resetExtensionBtn");

  // -------------------------------
  // Top Tabs Navigation Elements
  // -------------------------------
  const websitesTab = document.getElementById("websitesTab");
  const settingsTab = document.getElementById("settingsTab");

  // Content Sections for Tabs
  const websitesContent = document.getElementById("websitesContent");
  const settingsContent = document.getElementById("settingsContent");

  // -------------------------------
  // Toggle Elements (Ad-Blocking, Auto Close, Phishing)
  // -------------------------------
  const adBlockingToggle = document.getElementById("adBlockingToggle");
  const autoCloseToggle = document.getElementById("autoCloseToggle");
  const phishingToggle = document.getElementById("phishingToggle");

  // -------------------------------
  // Data Arrays for Domains
  // -------------------------------
  let whitelistedSites = [];
  let blockedSites = [];

  // -------------------------------
  // Inline Add Form Functions
  // -------------------------------
  function toggleWhitelistAddForm(show) {
    whitelistAddForm.style.display = show ? "flex" : "none";
    whitelistErrorMsg.textContent = "";
    if (show) whitelistDomainInput.focus();
    else whitelistDomainInput.value = "";
  }

  function toggleBlockedAddForm(show) {
    blockedAddForm.style.display = show ? "flex" : "none";
    blockedErrorMsg.textContent = "";
    if (show) blockedDomainInput.focus();
    else blockedDomainInput.value = "";
  }

  // -------------------------------
  // Whitelist Functionality
  // -------------------------------
  showAddWhitelistSiteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWhitelistAddForm(true);
  });

  cancelWhitelistBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWhitelistAddForm(false);
  });

  async function saveWhitelistDomain() {
    const rawDomain = whitelistDomainInput.value.trim();
    const domain = normalizeDomainInput(rawDomain);
    if (!domain) {
      whitelistErrorMsg.textContent = "Please enter a valid domain name.";
      return;
    }
    if (whitelistedSites.includes(domain)) {
      whitelistErrorMsg.textContent = "This domain is already whitelisted.";
      return;
    }
    whitelistedSites.push(domain);
    await chrome.storage.local.set({ whitelistedSites });
    renderWhitelistedList();
    toggleWhitelistAddForm(false);
    chrome.runtime.sendMessage({
      type: "WHITELIST_DOMAIN",
      payload: { domain },
    });
  }

  saveWhitelistBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveWhitelistDomain();
  });

  function renderWhitelistedList() {
    whitelistedList.innerHTML = "";
    if (whitelistedSites.length === 0) {
      const li = document.createElement("li");
      li.classList.add("empty");
      li.textContent = "No websites whitelisted";
      whitelistedList.appendChild(li);
      return;
    }
    whitelistedSites.forEach((domain) => {
      const li = document.createElement("li");
      li.innerHTML = `${domain} <button class="btn-remove" data-domain="${domain}"><i class="fas fa-trash"></i></button>`;
      whitelistedList.appendChild(li);
    });
    attachWhitelistRemoveListeners();
  }

  function attachWhitelistRemoveListeners() {
    document.querySelectorAll("#whitelistedList .btn-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const domain = btn.getAttribute("data-domain");
        whitelistedSites = whitelistedSites.filter((d) => d !== domain);
        await chrome.storage.local.set({ whitelistedSites });
        renderWhitelistedList();
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
  showAddBlockedSiteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleBlockedAddForm(true);
  });

  cancelBlockedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleBlockedAddForm(false);
  });

  async function saveBlockedDomain() {
    const rawDomain = blockedDomainInput.value.trim();
    const domain = normalizeDomainInput(rawDomain);
    if (!domain) {
      blockedErrorMsg.textContent = "Please enter a valid domain name.";
      return;
    }
    if (blockedSites.includes(domain)) {
      blockedErrorMsg.textContent = "This domain is already blocked.";
      return;
    }
    blockedSites.push(domain);
    await chrome.storage.local.set({ foreverBlockedSites: blockedSites });
    renderBlockedList();
    toggleBlockedAddForm(false);
    chrome.runtime.sendMessage({
      type: "BLOCK_DOMAIN",
      payload: { domain },
    });
  }

  saveBlockedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveBlockedDomain();
  });

  function renderBlockedList() {
    blockedList.innerHTML = "";
    if (blockedSites.length === 0) {
      const li = document.createElement("li");
      li.classList.add("empty");
      li.textContent = "No blocked domains";
      blockedList.appendChild(li);
      return;
    }
    blockedSites.forEach((domain) => {
      const li = document.createElement("li");
      li.innerHTML = `${domain} <button class="btn-remove" data-domain="${domain}"><i class="fas fa-trash"></i></button>`;
      blockedList.appendChild(li);
    });
    attachBlockedRemoveListeners();
  }

  function attachBlockedRemoveListeners() {
    document.querySelectorAll("#blockedList .btn-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const domain = btn.getAttribute("data-domain");
        blockedSites = blockedSites.filter((d) => d !== domain);
        await chrome.storage.local.set({ foreverBlockedSites: blockedSites });
        renderBlockedList();
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
    if (
      confirm(
        "Are you sure you want to reset Ad Block Unicorn? This will remove all your data."
      )
    ) {
      chrome.runtime.sendMessage(
        { type: "RESET_EXTENSION", payload: {} },
        (response) => {
          if (response && response.success) {
            location.reload();
          } else {
            console.warn("Failed to reset extension.");
          }
        }
      );
    }
  });

  // -------------------------------
  // Top Tabs Routing Setup (Websites & Settings)
  // -------------------------------
  const routes = {
    "/websites": websitesContent,
    "/settings": settingsContent,
  };

  function navigate(path) {
    Object.values(routes).forEach((section) => {
      section.style.display = "none";
    });
    const content = routes[path] || routes["/websites"];
    content.style.display = "block";
    updateActiveTab(path);
  }

  function updateActiveTab(path) {
    [websitesTab, settingsTab].forEach((tab) => {
      if (tab.getAttribute("href") === "#" + path) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  [websitesTab, settingsTab].forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const path = tab.getAttribute("href").replace("#", "");
      navigate(path);
      window.location.hash = path;
    });
  });

  function initializeRouting() {
    const hash = window.location.hash || "#/websites";
    const path = hash.replace("#/", "");
    navigate("/" + path);
  }

  window.addEventListener("hashchange", () => {
    initializeRouting();
  });

  initializeRouting();

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
      chrome.runtime.sendMessage({
        type: "TOGGLE_AD_BLOCKING",
        payload: { adBlockingEnabled: isEnabled },
      });
    });
  }

  function initializeAutoCloseToggle() {
    chrome.storage.local.get("autoCloseAllEnabled", (data) => {
      autoCloseToggle.checked = data.autoCloseAllEnabled;
    });
    autoCloseToggle.addEventListener("change", () => {
      const isEnabled = autoCloseToggle.checked;
      chrome.storage.local.set({ autoCloseAllEnabled: isEnabled });
      chrome.runtime.sendMessage({
        type: "AUTO_CLOSE_ALL",
        payload: { autoCloseAllEnabled: isEnabled },
      });
    });
  }

  function initializePhishingWarningToggle() {
    chrome.storage.local.get("phishingWarningEnabled", (data) => {
      phishingToggle.checked = data.phishingWarningEnabled !== false;
    });
    phishingToggle.addEventListener("change", () => {
      const isEnabled = phishingToggle.checked;
      chrome.storage.local.set({ phishingWarningEnabled: isEnabled });
      chrome.runtime.sendMessage({
        type: "TOGGLE_PHISHING",
        payload: { phishingWarningEnabled: isEnabled },
      });
    });
  }

  // -------------------------------
  // Initialize Stored Data and Render Lists
  // -------------------------------
  const storedWhitelist = await chrome.storage.local.get("whitelistedSites");
  whitelistedSites = storedWhitelist.whitelistedSites || [];
  renderWhitelistedList();

  const storedBlocked = await chrome.storage.local.get("foreverBlockedSites");
  blockedSites = storedBlocked.foreverBlockedSites || [];
  renderBlockedList();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.adBlockingEnabled) {
        adBlockingToggle.checked = changes.adBlockingEnabled.newValue;
      }
      if (changes.autoCloseAllEnabled) {
        autoCloseToggle.checked = changes.autoCloseAllEnabled.newValue;
      }
      if (changes.phishingWarningEnabled) {
        phishingToggle.checked = changes.phishingWarningEnabled.newValue;
      }
      if (changes.foreverBlockedSites) {
        blockedSites = changes.foreverBlockedSites.newValue;
        renderBlockedList();
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

  // -------------------------------
  // Global Click Listener to Cancel Add Forms When Clicking Outside
  // -------------------------------
  document.addEventListener("click", (e) => {
    if (
      whitelistAddForm.style.display === "flex" &&
      !whitelistAddForm.contains(e.target) &&
      e.target.id !== "showAddWhitelistSiteBtn"
    ) {
      toggleWhitelistAddForm(false);
    }
    if (
      blockedAddForm.style.display === "flex" &&
      !blockedAddForm.contains(e.target) &&
      e.target.id !== "showAddBlockedSiteBtn"
    ) {
      toggleBlockedAddForm(false);
    }
  });

  // Prevent clicks inside the add forms from propagating
  whitelistAddForm.addEventListener("click", (e) => e.stopPropagation());
  blockedAddForm.addEventListener("click", (e) => e.stopPropagation());

  // -------------------------------
  // Initialize Toggles
  // -------------------------------
  initializeAdBlockingToggle();
  initializeAutoCloseToggle();
  initializePhishingWarningToggle();
});
