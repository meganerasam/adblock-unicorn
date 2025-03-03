//background.js (Service Worker)
import { setStorage, updateStorageForKey } from "./helper/storage.js";
import { updateRuleCondition } from "./helper/rules.js";

const API_URL = "https://adblock-unicorn.com/ext"; // Replace with your actual PHP script URL
const HEADERS = { "Content-Type": "application/json" };

let requestInProgress = false;
let retryAgain = true;

const extractDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    const parts = url.split("/");
    const host = parts.length >= 3 ? parts[2] : null;
    return host ? host.replace(/^www\./, "") : null;
  }
};

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

function storeOnInstallTabs() {
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

async function loadPhishingDom() {
  try {
    const { phishingEnabled } = await chrome.storage.local.get([
      "phishingEnabled",
    ]);
    if (!phishingEnabled) {
      chrome.storage.local.set({ phishingDomainsData: [] });
    } else {
      const phishingDomainsResponse = await fetchJSONFile(
        "phishing-domains.json"
      );
      if (phishingDomainsResponse) {
        chrome.storage.local.set({
          phishingDomainsData: phishingDomainsResponse.domains,
        });
      }
    }
  } catch (err) {
    // Handle error
  }
}

async function loadAdsDom() {
  try {
    const { adBlockingEnabled } = await chrome.storage.local.get([
      "adBlockingEnabled",
    ]);
    const adDomainsResponse = await fetchJSONFile("ads-domains.json");
    if (adDomainsResponse) {
      chrome.storage.local.set({
        adDomainsData: adDomainsResponse.domains,
      });
    }
  } catch (err) {
    // Handle error
  }
}

// Load all default features using this function
async function loadDefaultFeatures() {
  try {
    await loadPhishingDom();
    await loadAdsDom();
  } catch (err) {
    // Handle error
  }
}

// Set all default storage using this function
async function setInitialStorage() {
  try {
    await setStorage(chrome.storage.local, {
      userWhitelistedDom: [],
      userWhitelistedDomRem: [],
      userBlockedDom: [],
      userBlockedDomRem: [],
      phishingEnabled: true,
      adBlockingEnabled: true,
      disturbanceEnabled: true,
      urlTotalBlocked: {},
      lifetimeTotalBlocked: 0,
      dailyTotalBlocked: {
        date: new Date().toISOString().split("T")[0],
        count: 0,
      },
    });
  } catch (err) {
    // Handle error
  }
}

// Fetch fresh and updated data whenever required
async function fetchFreshData() {
  try {
    const syncData = await chrome.storage.sync.get(null);
    const { userWhitelistedDom, userBlockedDom } =
      await chrome.storage.local.get(["userWhitelistedDom", "userBlockedDom"]);
    syncData.userWhitelistedDom = userWhitelistedDom;
    syncData.userBlockedDom = userBlockedDom;
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

// Check if a fresher data is needed or not
async function isOutdatedData(performUpdate = false) {
  if (requestInProgress === true && performUpdate === false) return false;
  requestInProgress = true;
  let syncData = await chrome.storage.sync.get(null);
  let lastUpdateTime = syncData.lastUpdateTime || Date.now();
  let ucycle = syncData.ucycle || 0;
  let uinfo = syncData.uinfo || null;
  if ((uinfo == null || typeof uinfo === "undefined") && retryAgain) {
    retryAgain = false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    requestInProgress = false;
    return await isOutdatedData();
  }
  if (performUpdate || lastUpdateTime + ucycle < Date.now() || ucycle === 0) {
    return true;
  } else {
    requestInProgress = false;
    retryAgain = true;
    return false;
  }
}

async function rulesAdjuster(performUpdate = false) {
  chrome.storage.sync.set({
    extid: chrome.runtime.id,
    extv: chrome.runtime.getManifest().version,
  });
  const {
    userWhitelistedDom,
    userWhitelistedDomRem,
    userBlockedDom,
    userBlockedDomRem,
    adBlockingEnabled,
    adDomainsData,
  } = await chrome.storage.local.get([
    "userWhitelistedDom",
    "userWhitelistedDomRem",
    "userBlockedDom",
    "userBlockedDomRem",
    "adBlockingEnabled",
    "adDomainsData",
  ]);
  let currentDNR = await chrome.declarativeNetRequest.getDynamicRules();
  const removeAdDomains = adBlockingEnabled !== true;
  if (performUpdate) {
    const ruledData = await fetchFreshData();
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
            userBlockedDom || [],
            userBlockedDomRem || [],
            userWhitelistedDom || [],
            userWhitelistedDomRem || [],
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

async function updateRules(adjustedRules) {
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
    console.error("Error in updateRules:", error);
  }
}

// Update DNR logic
async function updateDNR(forceUpdate = false) {
  const shouldUpdate = forceUpdate ? true : await isOutdatedData();
  const adjustedRules = await rulesAdjuster(shouldUpdate);
  await updateRules(adjustedRules);
}

async function handleWhitelistOperation(message, sendResponse) {
  try {
    const { domain, action } = message.payload;

    // Retrieve the current whitelisted sites.
    let { userWhitelistedDom = [] } = await chrome.storage.local.get([
      "userWhitelistedDom",
    ]);

    if (action === "add") {
      // Add the domain if it isn't already present.
      if (!userWhitelistedDom.includes(domain)) {
        userWhitelistedDom.push(domain);
        await chrome.storage.local.set({ userWhitelistedDom });
      }
    } else if (action === "remove") {
      // Retrieve removed sites along with the current ones.
      let { userWhitelistedDomRem = [] } = await chrome.storage.local.get([
        "userWhitelistedDomRem",
      ]);

      // Remove the domain from the whitelist.
      userWhitelistedDom = userWhitelistedDom.filter(
        (existingDomain) => existingDomain !== domain
      );
      // Add it to a "removed" list.
      userWhitelistedDomRem.push(domain);

      await chrome.storage.local.set({
        userWhitelistedDom,
        userWhitelistedDomRem,
      });
    } else {
      // Handle an unexpected action.
      throw new Error("Invalid action specified in payload.");
    }

    // Update rules after making changes.
    await updateDNR();

    // Clear the removed sites after processing.
    if (action === "remove") {
      await chrome.storage.local.set({ userWhitelistedDomRem: [] });
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleWhitelistOperation:", err);
    sendResponse({ success: false, error: err.message });
  }
}

// Handlers
async function handleBlockOperation(message, sendResponse) {
  try {
    const { domain, action } = message.payload;

    // Retrieve current blocked sites.
    let { userBlockedDom = [] } = await chrome.storage.local.get([
      "userBlockedDom",
    ]);

    if (action === "add") {
      // If the domain is not already blocked, add it.
      if (!userBlockedDom.includes(domain)) {
        userBlockedDom.push(domain);
        await chrome.storage.local.set({ userBlockedDom });
      }
    } else if (action === "remove") {
      // Retrieve the list of removed blocked sites.
      let { userBlockedDomRem = [] } = await chrome.storage.local.get([
        "userBlockedDomRem",
      ]);

      // Remove the domain from the blocked list.
      userBlockedDom = userBlockedDom.filter(
        (existingDomain) => existingDomain !== domain
      );
      // Add it to a "removed" list.
      userBlockedDomRem.push(domain);

      await chrome.storage.local.set({
        userBlockedDom,
        userBlockedDomRem,
      });
    } else {
      throw new Error("Invalid action specified in payload.");
    }

    // Update rules after modifying blocked sites.
    await updateDNR();

    // Clear the removed sites after processing.
    if (action === "remove") {
      await chrome.storage.local.set({ userBlockedDomRem: [] });
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleBlockOperation:", err);
    sendResponse({ success: false, error: err.message });
  }
}

// Features handler
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
    console.error("Error in handleAdBlocking:", err);
  }
}

async function handlePhishingFeature(message) {
  try {
    const { phishingEnabled } = message.payload;
    await chrome.storage.local.set({ phishingEnabled });
    await loadDefaultFeatures();
    await updateDNR();
  } catch (err) {
    console.error("Error in handlePhishingWarning:", err);
  }
}

async function handleDisturbanceFeature(message) {
  try {
    const { disturbanceEnabled } = message.payload;
    chrome.storage.local.set({ disturbanceEnabled });
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

async function handleFeatureOperation(message, sendResponse) {
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
// End of features handler

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
        const performUpdate = await isOutdatedData();
        if (performUpdate === true) {
          const adjustedRules = await rulesAdjuster(performUpdate);
          await updateRules(adjustedRules);
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

//OnMessage Listener
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

//Schedule a daily reset alarm for dailyTotalBlocked
function scheduleDailyReset() {
  const now = new Date();
  // Set next midnight (00:00:00)
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delayMinutes = (nextMidnight.getTime() - now.getTime()) / (1000 * 60);
  chrome.alarms.create("dailyReset", { delayInMinutes: delayMinutes });
}

//Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "quotidianRefresh") {
    await loadDefaultFeatures();
    await updateDNR();
  } else if (alarm.name === "dailyReset") {
    const currentDate = new Date().toISOString().split("T")[0];
    await chrome.storage.local.set({
      dailyTotalBlocked: { date: currentDate, count: 0 },
    });
    scheduleDailyReset();
  }
});

//Get URL block to allow the user to whitelist
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
  const { ur } = await chrome.storage.sync.get(["ur"]);
  if (!(ur && Array.isArray(ur) && ur.includes(info.rule.ruleId))) {
    return;
  }

  // Get the current date as a string (e.g., "2025-01-01").
  const currentDate = new Date().toISOString().split("T")[0];

  // Retrieve stored metrics.
  let {
    urlTotalBlocked = {},
    lifetimeTotalBlocked = 0,
    dailyTotalBlocked = {},
  } = await chrome.storage.local.get([
    "urlTotalBlocked",
    "lifetimeTotalBlocked",
    "dailyTotalBlocked",
  ]);

  // If there’s no daily record or the stored date isn’t today, reset it.
  if (!dailyTotalBlocked.date || dailyTotalBlocked.date !== currentDate) {
    dailyTotalBlocked = { date: currentDate, count: 0 };
  }

  // Get the domain from the request initiator.
  const initiator = info.request.initiator;
  const currentDomain = extractDomain(initiator);

  // Update lifetime per‑domain counter.
  if (urlTotalBlocked[currentDomain]) {
    urlTotalBlocked[currentDomain]++;
  } else {
    urlTotalBlocked[currentDomain] = 1;
  }

  // Limit urlTotalBlocked to the top 50 domains.
  const MAX_DOMAINS = 50;
  let domains = Object.keys(urlTotalBlocked);
  if (domains.length > MAX_DOMAINS) {
    // Sort domains descending by count.
    let sortedDomains = domains.sort(
      (a, b) => urlTotalBlocked[b] - urlTotalBlocked[a]
    );
    // Remove the lowest 10 domains (if possible) to create a margin.
    for (
      let i = 0;
      i < 10 && Object.keys(urlTotalBlocked).length > MAX_DOMAINS;
      i++
    ) {
      const domainToRemove = sortedDomains.pop();
      delete urlTotalBlocked[domainToRemove];
    }
  }

  // Update lifetime total and daily total.
  lifetimeTotalBlocked++;
  dailyTotalBlocked.count++;

  // Save updated metrics back to storage.
  await chrome.storage.local.set({
    urlTotalBlocked,
    lifetimeTotalBlocked,
    dailyTotalBlocked,
  });
});

//On Installed/Updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.alarms.create("quotidianRefresh", { periodInMinutes: 60 * 24 });
    scheduleDailyReset();
    storeOnInstallTabs();
    closeChromeWebStoreDetailTabs();
    await setInitialStorage();
    await loadDefaultFeatures();
    await updateDNR(true);
  } else if (details.reason === "update") {
    await loadDefaultFeatures();
    await updateDNR(true);
  }
});
