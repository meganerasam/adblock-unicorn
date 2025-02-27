/************************************************************
 * options.js
 ************************************************************/

import { normalizeDomain } from "./helper/util.js";
import {
  toggleAddForm,
  renderDomainList,
  attachRemoveListeners,
  initializeCheckbox,
} from "./helper/dom.js";

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
  const featuresTab = document.getElementById("featuresTab");

  // Content Sections for Tabs
  const websitesContent = document.getElementById("websitesContent");
  const featuresContent = document.getElementById("featuresContent");

  // -------------------------------
  // Checkbox Elements (Ad‑Blocking, Auto Close, Phishing)
  // -------------------------------
  // const adBlockingCheckbox = document.getElementById("adBlockingToggle");
  const autoCloseCheckbox = document.getElementById("autoCloseToggle");
  const phishingCheckbox = document.getElementById("phishingToggle");

  // -------------------------------
  // Data Arrays for Domains
  // -------------------------------
  let whitelistedSites = [];
  let blockedSites = [];

  // -------------------------------
  // Inline Add Form Functions using helper
  // -------------------------------
  showAddWhitelistSiteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAddForm(
      whitelistAddForm,
      whitelistDomainInput,
      whitelistErrorMsg,
      true
    );
  });

  cancelWhitelistBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAddForm(
      whitelistAddForm,
      whitelistDomainInput,
      whitelistErrorMsg,
      false
    );
  });

  async function saveWhitelistDomain() {
    const rawDomain = whitelistDomainInput.value.trim();
    const domain = normalizeDomain(rawDomain);
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
    toggleAddForm(
      whitelistAddForm,
      whitelistDomainInput,
      whitelistErrorMsg,
      false
    );
    chrome.runtime.sendMessage({
      type: "whitelistOperation",
      payload: { domain, action: "add" },
    });
  }

  saveWhitelistBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveWhitelistDomain();
  });

  function renderWhitelistedList() {
    renderDomainList(
      whitelistedList,
      whitelistedSites,
      "No domain whitelisted"
    );
    attachRemoveListeners(whitelistedList, async (domain) => {
      whitelistedSites = whitelistedSites.filter((d) => d !== domain);
      await chrome.storage.local.set({ whitelistedSites });
      renderWhitelistedList();
      chrome.runtime.sendMessage({
        type: "whitelistOperation",
        payload: { domain, action: "remove" },
      });
    });
  }

  // -------------------------------
  // Blocked Domains Functionality using helper
  // -------------------------------
  showAddBlockedSiteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAddForm(blockedAddForm, blockedDomainInput, blockedErrorMsg, true);
  });

  cancelBlockedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAddForm(blockedAddForm, blockedDomainInput, blockedErrorMsg, false);
  });

  async function saveBlockedDomain() {
    const rawDomain = blockedDomainInput.value.trim();
    const domain = normalizeDomain(rawDomain);
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
    toggleAddForm(blockedAddForm, blockedDomainInput, blockedErrorMsg, false);
    chrome.runtime.sendMessage({
      type: "blockOperation",
      payload: { domain, action: "add" },
    });
  }

  saveBlockedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveBlockedDomain();
  });

  function renderBlockedList() {
    renderDomainList(blockedList, blockedSites, "No blocked domain");
    attachRemoveListeners(blockedList, async (domain) => {
      blockedSites = blockedSites.filter((d) => d !== domain);
      await chrome.storage.local.set({ foreverBlockedSites: blockedSites });
      renderBlockedList();
      chrome.runtime.sendMessage({
        type: "blockOperation",
        payload: { domain, action: "remove" },
      });
    });
  }

  // -------------------------------
  // Global Click Listener to Close Add Forms When Clicking Outside
  // -------------------------------
  document.addEventListener("click", (e) => {
    // Close whitelist add form if open and click outside it (excluding the save button)
    if (
      whitelistAddForm.style.display === "flex" &&
      !whitelistAddForm.contains(e.target)
    ) {
      toggleAddForm(
        whitelistAddForm,
        whitelistDomainInput,
        whitelistErrorMsg,
        false
      );
    }
    // Close blocked add form if open and click outside it
    if (
      blockedAddForm.style.display === "flex" &&
      !blockedAddForm.contains(e.target)
    ) {
      toggleAddForm(blockedAddForm, blockedDomainInput, blockedErrorMsg, false);
    }
  });

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
        { type: "featureOperation", payload: { feature: "reset" } },
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
  // Top Tabs Routing Setup (Filters & Features)
  // -------------------------------
  const routes = {
    "/filters": websitesContent,
    "/features": featuresContent,
  };

  function navigate(path) {
    Object.values(routes).forEach((section) => {
      section.style.display = "none";
    });
    const content = routes[path] || routes["/filters"];
    content.style.display = "block";
    updateActiveTab(path);
  }

  function updateActiveTab(path) {
    [websitesTab, featuresTab].forEach((tab) => {
      if (tab.getAttribute("href") === "#" + path) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  [websitesTab, featuresTab].forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const path = tab.getAttribute("href").replace("#", "");
      navigate(path);
      window.location.hash = path;
    });
  });

  function initializeRouting() {
    const hash = window.location.hash || "#/filters";
    const path = hash.replace("#/", "");
    navigate("/" + path);
  }

  window.addEventListener("hashchange", () => {
    initializeRouting();
  });

  initializeRouting();

  // -------------------------------
  // Initialize Checkbox Settings using helper
  // -------------------------------
  // initializeCheckbox(adBlockingCheckbox, "adBlockingEnabled", "abd");
  initializeCheckbox(autoCloseCheckbox, "autoCloseAllEnabled", "disturbance");
  initializeCheckbox(phishingCheckbox, "phishingWarningEnabled", "phishing");

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
      // if (changes.adBlockingEnabled) {
      //   adBlockingCheckbox.checked = changes.adBlockingEnabled.newValue;
      // }
      if (changes.autoCloseAllEnabled) {
        autoCloseCheckbox.checked = changes.autoCloseAllEnabled.newValue;
      }
      if (changes.phishingWarningEnabled) {
        phishingCheckbox.checked = changes.phishingWarningEnabled.newValue;
      }
      if (changes.foreverBlockedSites) {
        blockedSites = changes.foreverBlockedSites.newValue;
        renderBlockedList();
      }
    }
  });
});
