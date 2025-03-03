//options.js
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
  const restoreExtensionBtn = document.getElementById("restoreExtensionBtn");

  // -------------------------------
  // Top Tabs Navigation Elements
  // -------------------------------
  const filtersTab = document.getElementById("filtersTab");
  const featuresTab = document.getElementById("featuresTab");

  // -------------------------------
  // Content Sections for Tabs
  // -------------------------------
  const filtersContent = document.getElementById("filtersContent");
  const featuresContent = document.getElementById("featuresContent");

  // -------------------------------
  // Checkbox Elements (Ad‑Blocking, Auto Close, Phishing)
  // -------------------------------
  const disturbanceCheckbox = document.getElementById("disturbanceCheckbox");
  const phishingCheckbox = document.getElementById("phishingCheckbox");

  // -------------------------------
  // Data Arrays for Domains
  // -------------------------------
  let userWhitelistedDom = [];
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
    if (userWhitelistedDom.includes(domain)) {
      whitelistErrorMsg.textContent = "This domain is already whitelisted.";
      return;
    }
    userWhitelistedDom.push(domain);
    await chrome.storage.local.set({ userWhitelistedDom });
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
      userWhitelistedDom,
      "No domain whitelisted"
    );
    attachRemoveListeners(whitelistedList, async (domain) => {
      userWhitelistedDom = userWhitelistedDom.filter((d) => d !== domain);
      await chrome.storage.local.set({ userWhitelistedDom });
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
    await chrome.storage.local.set({ userBlockedDom: blockedSites });
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
      await chrome.storage.local.set({ userBlockedDom: blockedSites });
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
  restoreExtensionBtn.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to restore Ad Block Unicorn to defaults setting? This will reset all your data."
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
    "/filters": filtersContent,
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
    [filtersTab, featuresTab].forEach((tab) => {
      if (tab.getAttribute("href") === "#" + path) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  [filtersTab, featuresTab].forEach((tab) => {
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
  initializeCheckbox(disturbanceCheckbox, "disturbanceEnabled", "disturbance");
  initializeCheckbox(phishingCheckbox, "phishingEnabled", "phishing");

  // -------------------------------
  // Initialize Stored Data and Render Lists
  // -------------------------------
  const storedWhitelist = await chrome.storage.local.get("userWhitelistedDom");
  userWhitelistedDom = storedWhitelist.userWhitelistedDom || [];
  renderWhitelistedList();

  const storedBlocked = await chrome.storage.local.get("userBlockedDom");
  blockedSites = storedBlocked.userBlockedDom || [];
  renderBlockedList();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.disturbanceEnabled) {
        disturbanceCheckbox.checked = changes.disturbanceEnabled.newValue;
      }
      if (changes.phishingEnabled) {
        phishingCheckbox.checked = changes.phishingEnabled.newValue;
      }
      if (changes.userBlockedDom) {
        blockedSites = changes.userBlockedDom.newValue;
        renderBlockedList();
      }
      if (changes.userWhitelistedDom) {
        userWhitelistedDom = changes.userWhitelistedDom.newValue;
        renderWhitelistedList();
      }
    }
  });
});
