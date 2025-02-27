/************************************************************
 * background.js (Service Worker)
 ************************************************************/
import { setStorage, updateStorageForKey } from "./helper/storage.js";
import { updateRuleCondition } from "./helper/rules.js";

const API_URL_RULES = "https://adblock-unicorn.com/ext/adbunicorn.php"; // Replace with your actual PHP script URL
const API_URL = "adblock-unicorn.com"; // Replace with your actual PHP script URL
const HEADERS = { "Content-Type": "application/json" };

let currentlyRequesting = false;
let retryTimeoutScheduled = true;

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
 * HELPER: reloadSpecificPage
 ************************************************************/
async function reloadSpecificPage(pageName, hash = "") {
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
 * reloadAllTab
 ************************************************************/
function reloadAllTab() {
  try {
    chrome.tabs.query({}, (tabs) => {
      for (let tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
    });
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
  const url = `https://${API_URL}/ext/uninstall-unicorn.php${queryParams}`;
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
    const response = await fetch(API_URL_RULES, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(syncData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      currentlyRequesting = false;
      retryTimeoutScheduled = true;
      throw new Error(
        `Failed to fetch data: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    let jsontext = await response.text();
    try {
      if (response.headers.get("Content-Type").includes("application/json")) {
        let data = JSON.parse(jsontext);
        currentlyRequesting = false;
        retryTimeoutScheduled = true;
        for (const [key, value] of Object.entries(data)) {
          await updateStorageForKey(key, value);
        }
        await chrome.storage.sync.set({ lastUpdateTime: Date.now() });
        configureUninstallUrl();
        return data;
      } else {
        currentlyRequesting = false;
        retryTimeoutScheduled = true;
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
  if (currentlyRequesting === true && updateAnyway === false) return false;
  currentlyRequesting = true;
  let syncData = await chrome.storage.sync.get(null);
  let lastUpdateTime = syncData.lastUpdateTime || Date.now();
  let ucycle = syncData.ucycle || 0;
  let uinfo = syncData.uinfo || null;
  if (
    (uinfo == null || typeof uinfo === "undefined") &&
    retryTimeoutScheduled
  ) {
    retryTimeoutScheduled = false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    currentlyRequesting = false;
    return await isDNRUpdateRequired();
  }
  if (updateAnyway || lastUpdateTime + ucycle < Date.now() || ucycle === 0) {
    return true;
  } else {
    currentlyRequesting = false;
    retryTimeoutScheduled = true;
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
 * Other Handlers (Whitelist, Block, etc.)
 ************************************************************/
async function handleWhitelistDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;
    let { whitelistedSites = [] } = await chrome.storage.local.get([
      "whitelistedSites",
    ]);
    if (!whitelistedSites.includes(domain)) {
      whitelistedSites.push(domain);
    }
    chrome.storage.local.set({ whitelistedSites });
    const updateAnyway = await isDNRUpdateRequired();
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleWhitelistDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleRemoveWhitelistDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;
    let { whitelistedSites = [], whitelistedSitesRemoved = [] } =
      await chrome.storage.local.get([
        "whitelistedSites",
        "whitelistedSitesRemoved",
      ]);
    whitelistedSites = whitelistedSites.filter(
      (existingDomain) => existingDomain !== domain
    );
    whitelistedSitesRemoved.push(domain);
    chrome.storage.local.set({ whitelistedSites, whitelistedSitesRemoved });
    const updateAnyway = await isDNRUpdateRequired();
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
    chrome.storage.local.set({ whitelistedSitesRemoved: [] });
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleRemoveWhitelistDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleBlockDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;
    let { foreverBlockedSites = [] } = await chrome.storage.local.get([
      "foreverBlockedSites",
    ]);
    if (!foreverBlockedSites.includes(domain)) {
      foreverBlockedSites.push(domain);
    }
    chrome.storage.local.set({ foreverBlockedSites });
    const updateAnyway = await isDNRUpdateRequired();
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleBlockDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleRemoveBlockDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;
    let { foreverBlockedSites = [], foreverBlockedSitesRemoved = [] } =
      await chrome.storage.local.get([
        "foreverBlockedSites",
        "foreverBlockedSitesRemoved",
      ]);
    foreverBlockedSites = foreverBlockedSites.filter(
      (existingDomain) => existingDomain !== domain
    );
    foreverBlockedSitesRemoved.push(domain);
    chrome.storage.local.set({
      foreverBlockedSites,
      foreverBlockedSitesRemoved,
    });
    const updateAnyway = await isDNRUpdateRequired();
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
    chrome.storage.local.set({ foreverBlockedSitesRemoved: [] });
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleRemoveBlockDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleResetExtension(message, sendResponse) {
  try {
    chrome.storage.local.set({
      whitelistedSites: [],
      whitelistedSitesRemoved: [],
      foreverBlockedSites: [],
      foreverBlockedSitesRemoved: [],
      phishingWarningEnabled: true,
      adBlockingEnabled: true,
      autoCloseAllEnabled: true,
    });
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();
    const updateAnyway = true;
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
    await reloadSpecificPage("options.html", "#/filters");
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleResetExtension:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleGetCurrentTabId(message, sendResponse) {
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
    console.error("Error in handleGetCurrentTabId:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function handleAutoCloseAll(message, sendResponse) {
  try {
    const { autoCloseAllEnabled } = message.payload;
    chrome.storage.local.set({ autoCloseAllEnabled });
    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleAutoCloseAll:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * OnMessage Listener
 ************************************************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "WHITELIST_DOMAIN":
      handleWhitelistDomain(message, sendResponse);
      return true;
    case "REMOVE_WHITELIST_DOMAIN":
      handleRemoveWhitelistDomain(message, sendResponse);
      return true;
    case "BLOCK_DOMAIN":
      handleBlockDomain(message, sendResponse);
      return true;
    case "REMOVE_BLOCK_DOMAIN":
      handleRemoveBlockDomain(message, sendResponse);
      return true;
    case "RESET_EXTENSION":
      handleResetExtension(message, sendResponse);
      return true;
    case "GET_CURRENT_TAB_ID":
      handleGetCurrentTabId(message, sendResponse);
      return true;
    case "AUTO_CLOSE_ALL":
      handleAutoCloseAll(message, sendResponse);
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
  if (alarm.name === "dailyReset") {
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();
    const updateAnyway = await isDNRUpdateRequired();
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
  }
});

/************************************************************
 * On Installed/Updated
 ************************************************************/
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.alarms.create("dailyReset", { periodInMinutes: 60 * 24 });
    processOnInstallTabs();
    closeChromeWebStoreDetailTabs();
    chrome.storage.local.set({
      whitelistedSites: [],
      whitelistedSitesRemoved: [],
      foreverBlockedSites: [],
      foreverBlockedSitesRemoved: [],
      phishingWarningEnabled: true,
      adBlockingEnabled: true,
      autoCloseAllEnabled: true,
    });
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();
    const updateAnyway = true;
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
  } else if (details.reason === "update") {
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();
    const updateAnyway = true;
    const adjustedRules = await adjustRules(updateAnyway);
    await updateBlockRules(adjustedRules);
  }
});
