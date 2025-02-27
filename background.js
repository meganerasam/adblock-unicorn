/************************************************************
 * background.js (Service Worker)
 ************************************************************/
import { setStorage, updateStorageForKey } from "./helper/storage.js";
import { updateRuleCondition } from "./helper/rules.js";

const API_URL = "https://adblock-unicorn.com/ext"; // Replace with your actual PHP script URL
const HEADERS = { "Content-Type": "application/json" };

let requestInProgress = false;
let retryAgain = true;

/************************************************************
 * HELPER: extractDomain
 ************************************************************/
const extractDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    const parts = url.split("/");
    const host = parts.length >= 3 ? parts[2] : null;
    return host ? host.replace(/^www\./, "") : null;
  }
};

/************************************************************
 * HELPER: fetchJSONFile
 ************************************************************/
async function fetchJSONFile(fileName) {
  try {
    const response = await fetch(chrome.runtime.getURL(`json/${fileName}`));
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching JSON file:", error);
    throw error;
  }
}

/************************************************************
 * HELPER: redirectToSpecificPage
 ************************************************************/
async function redirectToSpecificPage(pageName, hash = "") {
  try {
    const pageUrl = chrome.runtime.getURL(pageName) + hash;
    const queryUrl = chrome.runtime.getURL(pageName) + "*";
    const tabs = await chrome.tabs.query({ url: queryUrl });
    for (const tab of tabs) {
      await chrome.tabs.update(tab.id, { url: pageUrl });
    }
  } catch (error) {
    throw error;
  }
}

/************************************************************
 * configureUninstallUrl
 ************************************************************/
async function configureUninstallUrl() {
  const uninstallParams = await chrome.storage.sync.get(["uinfo"]);
  let queryParams = uninstallParams.uinfo
    ? `?uid=${uninstallParams.uinfo}`
    : "";
  queryParams += `&extid=${chrome.runtime.id}&extv=${
    chrome.runtime.getManifest().version
  }`;
  const url = `${API_URL}/uninstall-unicorn.php${queryParams}`;
  chrome.runtime.setUninstallURL(url);
}

/************************************************************
 * processOnInstallTabs
 ************************************************************/
function processOnInstallTabs() {
  chrome.tabs.query({}, function (tabs) {
    const uniqueDomains = new Set();
    const collectedUTM = {};
    tabs.forEach(function (tab) {
      if (!tab.url) return;
      const domain = extractDomain(tab.url);
      if (domain) uniqueDomains.add(domain);
      if (
        tab.url.includes("chromewebstore.google.com") &&
        tab.url.includes("an")
      ) {
        try {
          const urlObj = new URL(tab.url);
          const paramsObj = Object.fromEntries(urlObj.searchParams.entries());
          Object.assign(collectedUTM, paramsObj);
        } catch (error) {}
      }
    });
    chrome.storage.sync.set({ onInstallTabDomains: Array.from(uniqueDomains) });
    if (Object.keys(collectedUTM).length > 0) {
      chrome.storage.sync.set(collectedUTM);
    }
  });
}

/************************************************************
 * closeChromeWebStoreDetailTabs
 ************************************************************/
function closeChromeWebStoreDetailTabs() {
  chrome.windows.getAll({ populate: true }, function (windows) {
    windows.forEach(function (win) {
      win.tabs.forEach(function (tab) {
        if (tab.url && tab.url.includes("chromewebstore.google.com/detail")) {
          chrome.tabs.remove(tab.id);
        }
      });
    });
  });
}

/************************************************************
 * fetchAndStoreDefaultPhishingSites
 ************************************************************/
async function fetchAndStoreDefaultPhishingSites() {
  try {
    const { phishingWarningEnabled } = await chrome.storage.local.get([
      "phishingWarningEnabled",
    ]);
    console.log("phishingWarningEnabled", phishingWarningEnabled);
    if (!phishingWarningEnabled) {
      chrome.storage.local.set({ phishingDomainsData: [] });
    } else {
      const phishingDomainsResponse = await fetchJSONFile(
        "phishingDomains.json"
      );
      if (phishingDomainsResponse) {
        chrome.storage.local.set({
          phishingDomainsData: phishingDomainsResponse.phishingDomains,
        });
      }
    }
  } catch (err) {
    // Handle error
  }
}

/************************************************************
 * fetchAndStoreDefaultAdSites
 ************************************************************/
async function fetchAndStoreDefaultAdSites() {
  try {
    const { adBlockingEnabled } = await chrome.storage.local.get([
      "adBlockingEnabled",
    ]);
    if (!adBlockingEnabled) {
      // Do nothing if ad blocking is disabled
    } else {
      const adDomainsResponse = await fetchJSONFile("adDomains.json");
      if (adDomainsResponse) {
        chrome.storage.local.set({
          adDomainsData: adDomainsResponse.adDomains,
        });
      }
    }
  } catch (err) {
    // Handle error
  }
}

/************************************************************
 * loadDefaultFeatures
 ************************************************************/
async function loadDefaultFeatures() {
  try {
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();
  } catch (err) {
    // Handle error
  }
}

/************************************************************
 * setInitialStorage
 ************************************************************/
async function setInitialStorage() {
  try {
    await setStorage(chrome.storage.local, {
      whitelistedSites: [],
      whitelistedSitesRemoved: [],
      foreverBlockedSites: [],
      foreverBlockedSitesRemoved: [],
      phishingWarningEnabled: true,
      adBlockingEnabled: true,
      autoCloseAllEnabled: true,
    });
  } catch (err) {
    // Handle error
  }
}

/************************************************************
 * fetchAndStoreUpToDateData
 ************************************************************/
async function fetchAndStoreUpToDateData() {
  try {
    const syncData = await chrome.storage.sync.get(null);
    const { whitelistedSites, foreverBlockedSites } =
      await chrome.storage.local.get([
        "whitelistedSites",
        "foreverBlockedSites",
      ]);
    syncData.whitelistedSites = whitelistedSites;
    syncData.foreverBlockedSites = foreverBlockedSites;
    const response = await fetch(`${API_URL}/adbunicorn.php`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(syncData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      requestInProgress = false;
      retryAgain = true;
      throw new Error(
        `Failed to fetch data: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    let jsontext = await response.text();
    try {
      if (response.headers.get("Content-Type").includes("application/json")) {
        let data = JSON.parse(jsontext);
        requestInProgress = false;
        retryAgain = true;
        for (const [key, value] of Object.entries(data)) {
          await updateStorageForKey(key, value);
        }
        await chrome.storage.sync.set({ lastUpdateTime: Date.now() });
        configureUninstallUrl();
        return data;
      } else {
        requestInProgress = false;
        retryAgain = true;
      }
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
  } catch (error) {
    console.error("Error fetching data from API:", error);
    return null;
  }
}

/************************************************************
 * isDNRUpdateRequired
 ************************************************************/
async function isDNRUpdateRequired(updateAnyway = false) {
  if (requestInProgress === true && updateAnyway === false) return false;
  requestInProgress = true;
  let syncData = await chrome.storage.sync.get(null);
  let lastUpdateTime = syncData.lastUpdateTime || Date.now();
  let ucycle = syncData.ucycle || 0;
  let uinfo = syncData.uinfo || null;
  if ((uinfo == null || typeof uinfo === "undefined") && retryAgain) {
    retryAgain = false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    requestInProgress = false;
    return await isDNRUpdateRequired();
  }
  if (updateAnyway || lastUpdateTime + ucycle < Date.now() || ucycle === 0) {
    return true;
  } else {
    requestInProgress = false;
    retryAgain = true;
    return false;
  }
}

/************************************************************
 * adjustRules
 ************************************************************/
async function adjustRules(updateAnyway = false) {
  chrome.storage.sync.set({
    extid: chrome.runtime.id,
    extv: chrome.runtime.getManifest().version,
  });
  const {
    whitelistedSites,
    whitelistedSitesRemoved,
    foreverBlockedSites,
    foreverBlockedSitesRemoved,
    adBlockingEnabled,
    adDomainsData,
  } = await chrome.storage.local.get([
    "whitelistedSites",
    "whitelistedSitesRemoved",
    "foreverBlockedSites",
    "foreverBlockedSitesRemoved",
    "adBlockingEnabled",
    "adDomainsData",
  ]);
  let currentDNR = await chrome.declarativeNetRequest.getDynamicRules();
  const removeAdDomains = adBlockingEnabled !== true;
  if (updateAnyway) {
    const ruledData = await fetchAndStoreUpToDateData();
    currentDNR = ruledData.rules;
  }
  if (currentDNR.length > 0) {
    const adjustedRules = await Promise.all(
      currentDNR.map(async (rule) => {
        let newRule = { ...rule };
        if (
          newRule.action.type === "redirect" ||
          newRule.action.type === "block"
        ) {
          newRule = updateRuleCondition(
            newRule,
            adDomainsData || [],
            foreverBlockedSites || [],
            foreverBlockedSitesRemoved || [],
            whitelistedSites || [],
            whitelistedSitesRemoved || [],
            removeAdDomains
          );
        }
        return newRule;
      })
    );

    return adjustedRules;
  } else {
    return [];
  }
}

/************************************************************
 * updateBlockRules
 ************************************************************/
async function updateBlockRules(adjustedRules) {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    if (
      !adjustedRules ||
      !Array.isArray(adjustedRules) ||
      adjustedRules.length === 0
    ) {
      return;
    }

    const removeRuleIds = existingRules.map((r) => r.id);
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: adjustedRules,
      });
    } else {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: adjustedRules,
      });
    }
    if (chrome.runtime.lastError) {
      console.error("DNR update error:", chrome.runtime.lastError);
    }
  } catch (error) {
    console.error("Error in updateBlockRules:", error);
  }
}

/************************************************************
 * updateDNR
 ************************************************************/
async function updateDNR(forceUpdate = false) {
  const shouldUpdate = forceUpdate ? true : await isDNRUpdateRequired();
  const adjustedRules = await adjustRules(shouldUpdate);
  await updateBlockRules(adjustedRules);
}

/************************************************************
 * FEATURES FUNCTIONS
 ************************************************************/
async function handleAdbFeature(message) {
  try {
    const { adBlockingEnabled } = message.payload;
    chrome.storage.local.set({ adBlockingEnabled });
    await loadDefaultFeatures();
    if (adBlockingEnabled) {
      await updateDNR(true);
    } else {
      await updateDNR();
    }
  } catch (err) {
    console.error("Error in handleToggleAdBlocking:", err);
  }
}

async function handlePhishingFeature(message) {
  try {
    const { phishingWarningEnabled } = message.payload;
    await chrome.storage.local.set({ phishingWarningEnabled });
    await loadDefaultFeatures();
    await updateDNR();
  } catch (err) {
    console.error("Error in handleTogglePhishingWarning:", err);
  }
}

async function handleDisturbanceFeature(message) {
  try {
    const { autoCloseAllEnabled } = message.payload;
    chrome.storage.local.set({ autoCloseAllEnabled });
  } catch (err) {
    console.error("Error in handleHideDisturbance:", err);
  }
}

async function handleReseFeature() {
  try {
    await setInitialStorage();
    await loadDefaultFeatures();
    await updateDNR(true);
    await redirectToSpecificPage("options.html", "#/filters");
  } catch (err) {
    console.error("Error in handleReseFeature:", err);
  }
}

/************************************************************
 * Other Handlers (Whitelist, Block, etc.)
 ************************************************************/
async function handleWhitelistOperation(message, sendResponse) {
  try {
    const { domain, action } = message.payload;

    // Retrieve the current whitelisted sites.
    let { whitelistedSites = [] } = await chrome.storage.local.get([
      "whitelistedSites",
    ]);

    if (action === "add") {
      // Add the domain if it isn't already present.
      if (!whitelistedSites.includes(domain)) {
        whitelistedSites.push(domain);
        await chrome.storage.local.set({ whitelistedSites });
      }
    } else if (action === "remove") {
      // Retrieve removed sites along with the current ones.
      let { whitelistedSitesRemoved = [] } = await chrome.storage.local.get([
        "whitelistedSitesRemoved",
      ]);

      // Remove the domain from the whitelist.
      whitelistedSites = whitelistedSites.filter(
        (existingDomain) => existingDomain !== domain
      );
      // Optionally add it to a "removed" list.
      whitelistedSitesRemoved.push(domain);

      await chrome.storage.local.set({
        whitelistedSites,
        whitelistedSitesRemoved,
      });
    } else {
      // Handle an unexpected action.
      throw new Error("Invalid action specified in payload.");
    }

    // Update rules after making changes.
    await updateDNR();

    // Optionally, clear the removed sites after processing.
    if (action === "remove") {
      await chrome.storage.local.set({ whitelistedSitesRemoved: [] });
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleWhitelistOperation:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleBlockOperation(message, sendResponse) {
  try {
    const { domain, action } = message.payload;

    console.log(action);

    // Retrieve current blocked sites.
    let { foreverBlockedSites = [] } = await chrome.storage.local.get([
      "foreverBlockedSites",
    ]);

    if (action === "add") {
      // If the domain is not already blocked, add it.
      if (!foreverBlockedSites.includes(domain)) {
        foreverBlockedSites.push(domain);
        await chrome.storage.local.set({ foreverBlockedSites });
      }
    } else if (action === "remove") {
      // Retrieve the list of removed blocked sites.
      let { foreverBlockedSitesRemoved = [] } = await chrome.storage.local.get([
        "foreverBlockedSitesRemoved",
      ]);

      // Remove the domain from the blocked list.
      foreverBlockedSites = foreverBlockedSites.filter(
        (existingDomain) => existingDomain !== domain
      );
      // Optionally, add it to a "removed" list.
      foreverBlockedSitesRemoved.push(domain);

      await chrome.storage.local.set({
        foreverBlockedSites,
        foreverBlockedSitesRemoved,
      });
    } else {
      throw new Error("Invalid action specified in payload.");
    }

    // Update rules after modifying blocked sites.
    await updateDNR();

    // Optionally, clear the removed sites after processing.
    if (action === "remove") {
      await chrome.storage.local.set({ foreverBlockedSitesRemoved: [] });
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleBlockOperation:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleFeatureOperation(message, sendResponse) {
  console.log(message.payload);
  try {
    const payload = message.payload;
    switch (payload.feature) {
      case "abd":
        handleAdbFeature(message);
      case "phishing":
        handlePhishingFeature(message);
        break;
      case "disturbance":
        handleDisturbanceFeature(message);
        break;
      case "reset":
        handleReseFeature();
        break;
      default:
        console.log("Unknown feature:", message);
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleFeatureOperation:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleCurrentTabInfo(message, sendResponse) {
  try {
    const { option, domain, name } = message.payload;
    if (option === 1 && name === "block") {
      chrome.storage.sync.get([name], async (result) => {
        let data = result[name] || {};
        if (data.hasOwnProperty(domain)) {
          data[domain]++;
        } else {
          data[domain] = 1;
          if (Object.keys(data).length > 50) {
            const sortedDomains = Object.keys(data).sort(
              (a, b) => data[a] - data[b]
            );
            for (let i = 0; i < 10; i++) {
              delete data[sortedDomains[i]];
            }
          }
        }
        await setStorage(chrome.storage.sync, { [name]: data });
        const updateAnyway = await isDNRUpdateRequired();
        if (updateAnyway === true) {
          const adjustedRules = await adjustRules(updateAnyway);
          await updateBlockRules(adjustedRules);
        }
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const tabId = currentTab ? currentTab.id : null;
        sendResponse({ tabId });
      });
    }
  } catch (err) {
    console.error("Error in handleCurrentTabInfo:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * OnMessage Listener
 ************************************************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "whitelistOperation":
      handleWhitelistOperation(message, sendResponse);
      return true;
    case "blockOperation":
      handleBlockOperation(message, sendResponse);
      return true;
    case "featureOperation":
      handleFeatureOperation(message, sendResponse);
      return true;
    case "currentTabInfo":
      handleCurrentTabInfo(message, sendResponse);
      return true;
    default:
      console.warn("Unknown message type:", message.type);
      break;
  }
});

/************************************************************
 * Alarms
 ************************************************************/
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "quotidianRefresh") {
    await loadDefaultFeatures();
    await updateDNR();
  }
});

/************************************************************
 * On Installed/Updated
 ************************************************************/
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.alarms.create("quotidianRefresh", { periodInMinutes: 60 * 24 });
    processOnInstallTabs();
    closeChromeWebStoreDetailTabs();
    await setInitialStorage();
    await loadDefaultFeatures();
    await updateDNR(true);
  } else if (details.reason === "update") {
    await loadDefaultFeatures();
    await updateDNR(true);
  }
});
