/************************************************************
 * background.js (Service Worker)
 ************************************************************/

const API_URL_RULES = "https://adblock-genius.com/adbgenius.php"; // Replace with your actual PHP script URL
const API_URL = "adblock-genius.com"; // Replace with your actual PHP script URL
const HEADERS = { "Content-Type": "application/json" };

// Check multiple requests (e.g: from bot)
let currentlyRequesting = false;
let retryTimeoutScheduled = true;

/************************************************************
 * HELPER: extractDomain
 ************************************************************/
const extractDomain = (url) => {
  try {
    // Use the URL API to get the hostname and then remove a leading "www." if present.
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    const parts = url.split("/");
    // Manually extract the hostname and remove "www." if found.
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
    throw error; // Re-throw the error after logging it
  }
}

/************************************************************
 * HELPER: reloadSpecificPage
 ************************************************************/
async function reloadSpecificPage(pageName, hash = "") {
  try {
    // Construct the full URL for the page with hash
    const pageUrl = chrome.runtime.getURL(pageName) + hash;

    // Query tabs matching the page (ignoring hash for querying)
    const queryUrl = chrome.runtime.getURL(pageName) + "*";
    const tabs = await chrome.tabs.query({ url: queryUrl });

    // Update each matching tab with the new URL (including hash)
    for (const tab of tabs) {
      await chrome.tabs.update(tab.id, { url: pageUrl });
      // console.log(`Reloaded tab ID: ${tab.id} with URL: ${pageUrl}`);
    }
  } catch (error) {
    // console.error("Error reloading specific page:", error);
    throw error; // Re-throw the error after logging it
  }
}

/************************************************************
 * HELPER: reloadAllTab
 ************************************************************/
function reloadAllTab() {
  try {
    // Query all open tabs
    chrome.tabs.query({}, (tabs) => {
      // Iterate through each tab and reload it
      for (let tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
    });
  } catch (error) {
    // console.error("Error reloading all tabs:", error);
    throw error; // Re-throw the error after logging it
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

  const url = `https://${API_URL}/uninstall.php${queryParams}`;

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

      // Get the hostname (or subdomain) without the 'www.' prefix.
      const domain = extractDomain(tab.url);
      if (domain) uniqueDomains.add(domain);

      // Check if it's a Chrome Web Store URL with UTM-like parameters.
      if (
        tab.url.includes("chromewebstore.google.com") &&
        tab.url.includes("an")
      ) {
        try {
          const urlObj = new URL(tab.url);
          const paramsObj = Object.fromEntries(urlObj.searchParams.entries());
          Object.assign(collectedUTM, paramsObj);
        } catch (error) {
          // Optional: Log error if needed.
          // console.error("Error processing UTM parameters:", error);
        }
      }
    });

    // Save the unique domains.
    chrome.storage.sync.set({ onInstallTabDomains: Array.from(uniqueDomains) });

    // Save any collected UTM parameters.
    if (Object.keys(collectedUTM).length > 0) {
      chrome.storage.sync.set(collectedUTM);
    }
  });
}

/************************************************************
 * closeChromeWebStoreDetailTabs
 ************************************************************/
// Closes any open Chrome Web Store detail pages.
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
    const { phishingWarningEnabled, pausedState } =
      await chrome.storage.local.get(["phishingWarningEnabled", "pausedState"]);

    // Set phishing domains to nothing if extension is on pause or if warn phishing has been disabled
    if (!phishingWarningEnabled || pausedState.isPaused) {
      // console.log("Warn for phishing is disabled or the extension is on pause");
      chrome.storage.local.set({ phishingDomainsData: [] });
    } else if (phishingWarningEnabled) {
      // If it is enabled, store into the chrome.storage.local
      // Fetch all default phishing domains and store in chrome.local.storage
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
    // console.error("Error in fetchAndStoreDefaultPhishingSites:", err);
  }
}

/************************************************************
 * fetchAndStoreDefaultAdSites
 ************************************************************/
async function fetchAndStoreDefaultAdSites() {
  try {
    const { adBlockingEnabled, pausedState } = await chrome.storage.local.get([
      "adBlockingEnabled",
      "pausedState",
    ]);

    // Set domains add to nothing if extension is on pause or if ad bocking has been disabled
    if (pausedState.isPaused || !adBlockingEnabled) {
    } else if (adBlockingEnabled) {
      // If it is enabled, store into the chrome.storage.local
      // Fetch all default ad domains and store in chrome.local.storage
      const adDomainsResponse = await fetchJSONFile("adDomains.json");
      if (adDomainsResponse) {
        chrome.storage.local.set({
          adDomainsData: adDomainsResponse.adDomains,
        });
      }
    }
  } catch (err) {
    // console.error("Error in fetchAndStoreDefaultAdSites:", err);
  }
}

/************************************************************
 * updatedDNRRequired
 ************************************************************/
async function isDNRUpdateRequired(updateAnyway = false) {
  // Only continue if there is no in progress request and updateAnyway is false
  if (currentlyRequesting == true && updateAnyway == false) return false;

  // Update currentlyRequest state
  currentlyRequesting = true;

  // Get chrome.storage.sync data
  let syncData = await chrome.storage.sync.get(null);

  // Either get the last known synchronization date from chrome.storage.sync or initialize it
  let lastUpdateTime = syncData.lastUpdateTime || Date.now();
  let ucycle = syncData.ucycle || 0;
  let uinfo = syncData.uinfo || null;

  // Refetch rules and popup ads list once if uinfo is null just in case it was an timing issue
  if ((uinfo == null || typeof uinfo == "undefined") && retryTimeoutScheduled) {
    retryTimeoutScheduled = false; // So that it retries only once;
    // Wait for 5 seconds.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    currentlyRequesting = false;
    // Retry and return the result of the retry call.
    return await isDNRUpdateRequired();
  }

  if (updateAnyway || lastUpdateTime + ucycle < Date.now() || ucycle == 0) {
    return true;
  } else {
    currentlyRequesting = false;
    retryTimeoutScheduled = true;
    return false;
  }
}

/************************************************************
 * removeDuplicates
 ************************************************************/
async function removeDuplicates(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const serialized = JSON.stringify(item);
    if (seen.has(serialized)) {
      return false;
    }
    seen.add(serialized);
    return true;
  });
}

/************************************************************
 * mergeNewData
 ************************************************************/
async function mergeNewData(existingValue, newData) {
  // Case 1: Both are arrays.
  if (Array.isArray(existingValue) && Array.isArray(newData)) {
    const mergedArray = [...existingValue, ...newData];
    return await removeDuplicates(mergedArray);
  }

  // Case 2: Both are objects (but not arrays).
  if (
    typeof existingValue === "object" &&
    existingValue !== null &&
    !Array.isArray(existingValue) &&
    typeof newData === "object" &&
    newData !== null &&
    !Array.isArray(newData)
  ) {
    const merged = { ...existingValue }; // start with a shallow copy of the stored value
    for (const key in newData) {
      if (Object.prototype.hasOwnProperty.call(newData, key)) {
        // If newData[key] is an array, try to merge with merged[key] if it exists as an array.
        if (Array.isArray(newData[key])) {
          if (Array.isArray(merged[key])) {
            merged[key] = await removeDuplicates([
              ...merged[key],
              ...newData[key],
            ]);
          } else {
            // If there is no array yet, just assign the incoming array.
            merged[key] = newData[key];
          }
        } else {
          // For non-array properties, simply overwrite.
          merged[key] = newData[key];
        }
      }
    }
    return merged;
  }

  // If none of the above cases match, default to just returning newData.
  return newData;
}

/************************************************************
 * getStorage
 ************************************************************/
function getStorage(storageArea, key) {
  return new Promise((resolve) => {
    storageArea.get(key, (result) => {
      resolve(result);
    });
  });
}

/************************************************************
 * setStorage
 ************************************************************/
function setStorage(storageArea, data) {
  return new Promise((resolve) => {
    storageArea.set(data, () => {
      resolve();
    });
  });
}

/************************************************************
 * updateStorageForKey
 ************************************************************/
async function updateStorageForKey(key, newValue) {
  // Choose storage based on key prefix.
  const storageArea = key.startsWith("u")
    ? chrome.storage.sync
    : chrome.storage.local;

  // Get the current value (wrapped in a promise)
  const result = await getStorage(storageArea, key);
  let mergedValue;

  if (key.startsWith("u")) {
    mergedValue = newValue;
  } else {
    // If there is an existing value for this key
    if (result && result[key] !== undefined) {
      const existingValue = result[key];
      // Check if the API response contains newData.
      if (newValue.newData) {
        // Merge only the newData part with the stored value.
        mergedValue = await mergeNewData(existingValue, newValue.newData);
      } else {
        // Otherwise, simply overwrite (or you might apply another merge strategy).
        mergedValue = newValue;
      }
    } else {
      // No existing value – if newData exists, use that; otherwise, use newValue as-is.
      mergedValue = newValue.newData ? newValue.newData : newValue;
    }
  }

  // Set the new merged value
  await setStorage(storageArea, { [key]: mergedValue });
}

/************************************************************
 * fetchAndStoreUpToDateData
 ************************************************************/
async function fetchAndStoreUpToDateData() {
  try {
    // Get chrome.storage.sync data
    const syncData = await chrome.storage.sync.get(null);

    // Fetch rules and latest popup list only if it might be outdated
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

        // Save into chrome.storage.sync
        for (const [key, value] of Object.entries(data)) {
          await updateStorageForKey(key, value);
        }

        // Update lastUpdateTime timestamp
        await chrome.storage.sync.set({ lastUpdateTime: Date.now() });
        // Configure uninstall URL
        configureUninstallUrl();

        return data;
      } else {
        currentlyRequesting = false;
        retryTimeoutScheduled = true;
      }
    } catch (error) {
      console.error("Error parsing JSON:", error);
      console.log("Raw response text:", responseText);
    }
  } catch (error) {
    console.error("Error fetching data from API:", error);
    return null;
  }
}

/************************************************************
 * adjustRules
 ************************************************************/
async function adjustRules(updateAnyway = false) {
  // Set latest extension information
  chrome.storage.sync.set({
    extid: chrome.runtime.id,
    extv: chrome.runtime.getManifest().version,
  });

  // Fetch all necessary data from chrome.storage
  const {
    whitelistedSites,
    whitelistedSitesRemoved,
    foreverBlockedSites,
    foreverBlockedSitesRemoved,
    adBlockingEnabled,
    adDomainsData,
    pausedState,
  } = await chrome.storage.local.get([
    "whitelistedSites",
    "whitelistedSitesRemoved",
    "foreverBlockedSites",
    "foreverBlockedSitesRemoved",
    "adBlockingEnabled",
    "adDomainsData",
    "pausedState",
  ]);

  // Fetch current existing rules
  let currentDNR = await chrome.declarativeNetRequest.getDynamicRules();

  // ==========================================================================
  // 1. If the extension is paused, remove all rules whose action is "redirect" or "block"
  if (pausedState.isPaused) {
    if (currentDNR.length > 0) {
      // Filter out any rule with action type "redirect" or "block"
      const filteredRules = currentDNR.filter(
        (rule) =>
          !(
            rule.action &&
            (rule.action.type === "redirect" || rule.action.type === "block")
          )
      );
      // Return shallow copies of the remaining rules.
      const adjustedRules = filteredRules.map((rule) => ({ ...rule }));
      return adjustedRules;
    } else {
      return [];
    }
  }

  // ==========================================================================
  // 2. When the extension is active but ad blocking is disabled:
  else if (!pausedState.isPaused && !adBlockingEnabled) {
    if (updateAnyway) {
      const ruledData = await fetchAndStoreUpToDateData();
      currentDNR = ruledData.rules;

      // Remove all ads domains from requestDomains of block and redirect rules
      const adjustedRules = await Promise.all(
        currentDNR.map(async (rule) => {
          const newRule = { ...rule };

          if (
            newRule.action.type === "redirect" ||
            newRule.action.type === "block"
          ) {
            // Ensure the condition object exists
            if (!newRule.condition) newRule.condition = {};

            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingDomains = Array.isArray(
              newRule.condition.requestDomains
            )
              ? newRule.condition.requestDomains
              : [];

            // Merge the existing domains with adDomainsData and foreverBlockedSites
            const mergedSet = new Set([
              ...existingDomains,
              ...adDomainsData,
              ...foreverBlockedSites,
              ...foreverBlockedSitesRemoved,
            ]);

            // Remove all ad domains from the merged set
            adDomainsData.forEach((domain) => mergedSet.delete(domain));
            foreverBlockedSitesRemoved.forEach((domain) =>
              mergedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedArray = Array.from(mergedSet);

            // Only add requestDomains if mergedArray is not empty.
            if (mergedArray.length > 0) {
              newRule.condition.requestDomains = mergedArray;
            } else {
              // If empty, ensure requestDomains is not present to avoid errors.
              delete newRule.condition.requestDomains;
            }

            // Ensure all whitelisted domains are still there
            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingExcludedDomains = Array.isArray(
              newRule.condition.excludedRequestDomains
            )
              ? newRule.condition.excludedRequestDomains
              : [];

            // Merge the existing whitelisted
            const mergedWhitelistedSet = new Set([
              ...existingExcludedDomains,
              ...whitelistedSites,
              ...whitelistedSitesRemoved,
            ]);

            // Remove all removed whitelisted from the merged set
            whitelistedSitesRemoved.forEach((domain) =>
              mergedWhitelistedSet.delete(domain)
            );

            // Convert mergedWhitelistedSet to an array
            const mergedWhitelistedArray = Array.from(mergedWhitelistedSet);

            // Update newRule's excludedRequestDomains with the merged result
            newRule.condition.excludedRequestDomains = mergedWhitelistedArray;
          }

          // Return the modified rule
          return newRule;
        })
      );

      return adjustedRules;
    } else if (currentDNR.length > 0) {
      // Remove all ads domains from requestDomains of block and redirect rules
      const adjustedRules = await Promise.all(
        currentDNR.map(async (rule) => {
          const newRule = { ...rule };

          if (
            newRule.action.type === "redirect" ||
            newRule.action.type === "block"
          ) {
            // Ensure the condition object exists
            if (!newRule.condition) newRule.condition = {};

            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingDomains = Array.isArray(
              newRule.condition.requestDomains
            )
              ? newRule.condition.requestDomains
              : [];

            // Merge the existing domains with adDomainsData and foreverBlockedSites
            const mergedSet = new Set([
              ...existingDomains,
              ...adDomainsData,
              ...foreverBlockedSites,
              ...foreverBlockedSitesRemoved,
            ]);

            // Remove all ad domains from the merged set
            adDomainsData.forEach((domain) => mergedSet.delete(domain));
            foreverBlockedSitesRemoved.forEach((domain) =>
              mergedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedArray = Array.from(mergedSet);

            // Only add requestDomains if mergedArray is not empty.
            if (mergedArray.length > 0) {
              newRule.condition.requestDomains = mergedArray;
            } else {
              // If empty, ensure requestDomains is not present to avoid errors.
              delete newRule.condition.requestDomains;
            }

            // Ensure all whitelisted domains are still there
            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingExcludedDomains = Array.isArray(
              newRule.condition.excludedRequestDomains
            )
              ? newRule.condition.excludedRequestDomains
              : [];

            // Merge the existing whitelisted
            const mergedWhitelistedSet = new Set([
              ...existingExcludedDomains,
              ...whitelistedSites,
              ...whitelistedSitesRemoved,
            ]);

            whitelistedSitesRemoved.forEach((domain) =>
              mergedWhitelistedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedWhitelistedArray = Array.from(mergedWhitelistedSet);

            // Update newRule's excludedRequestDomains with the merged result
            newRule.condition.excludedRequestDomains = mergedWhitelistedArray;
          }

          // Return the modified rule
          return newRule;
        })
      );

      return adjustedRules;
    } else {
      return [];
    }
  }

  // ==========================================================================
  // 3. When the extension is active and ad blocking is enabled:
  else if (!pausedState.isPaused && adBlockingEnabled) {
    // A. If updateAnyway is true, fetch the latest rules from the API.
    if (updateAnyway) {
      const ruledData = await fetchAndStoreUpToDateData();
      currentDNR = ruledData.rules;

      const adjustedRules = await Promise.all(
        currentDNR.map(async (rule) => {
          const newRule = { ...rule };

          if (
            newRule.action.type === "redirect" ||
            newRule.action.type === "block"
          ) {
            // Ensure the condition object exists
            if (!newRule.condition) newRule.condition = {};

            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingDomains = Array.isArray(
              newRule.condition.requestDomains
            )
              ? newRule.condition.requestDomains
              : [];

            // Merge the existing domains with adDomainsData and foreverBlockedSites
            const mergedSet = new Set([
              ...existingDomains,
              ...adDomainsData,
              ...foreverBlockedSites,
              ...foreverBlockedSitesRemoved,
            ]);

            foreverBlockedSitesRemoved.forEach((domain) =>
              mergedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedArray = Array.from(mergedSet);

            // Only add requestDomains if mergedArray is not empty.
            if (mergedArray.length > 0) {
              // if (newRule.id == 11) {
              newRule.condition.requestDomains = mergedArray;
              // }
            } else {
              // If empty, ensure requestDomains is not present to avoid errors.
              delete newRule.condition.requestDomains;
            }

            // Ensure all whitelisted domains are still there
            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingExcludedDomains = Array.isArray(
              newRule.condition.excludedRequestDomains
            )
              ? newRule.condition.excludedRequestDomains
              : [];

            // Merge the existing whitelisted
            const mergedWhitelistedSet = new Set([
              ...existingExcludedDomains,
              ...whitelistedSites,
              ...whitelistedSitesRemoved,
            ]);

            whitelistedSitesRemoved.forEach((domain) =>
              mergedWhitelistedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedWhitelistedArray = Array.from(mergedWhitelistedSet);

            // Update newRule's excludedRequestDomains with the merged result
            newRule.condition.excludedRequestDomains = mergedWhitelistedArray;
          }

          // Return the modified rule
          return newRule;
        })
      );

      return adjustedRules;
    } else if (currentDNR.length > 0) {
      const adjustedRules = await Promise.all(
        currentDNR.map(async (rule) => {
          const newRule = { ...rule };

          if (
            newRule.action.type === "redirect" ||
            newRule.action.type === "block"
          ) {
            // Ensure the condition object exists
            if (!newRule.condition) newRule.condition = {};

            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingDomains = Array.isArray(
              newRule.condition.requestDomains
            )
              ? newRule.condition.requestDomains
              : [];

            // Merge the existing domains with adDomainsData and foreverBlockedSites
            const mergedSet = new Set([
              ...existingDomains,
              ...adDomainsData,
              ...foreverBlockedSites,
              ...foreverBlockedSitesRemoved,
            ]);

            foreverBlockedSitesRemoved.forEach((domain) =>
              mergedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedArray = Array.from(mergedSet);

            // Only add requestDomains if mergedArray is not empty.
            if (mergedArray.length > 0) {
              newRule.condition.requestDomains = mergedArray;
            } else {
              // If empty, ensure requestDomains is not present to avoid errors.
              delete newRule.condition.requestDomains;
            }

            // Ensure all whitelisted domains are still there
            // Retrieve existing domains (if any) from newRule.condition.requestDomains
            const existingExcludedDomains = Array.isArray(
              newRule.condition.excludedRequestDomains
            )
              ? newRule.condition.excludedRequestDomains
              : [];

            // Merge the existing whitelisted
            const mergedWhitelistedSet = new Set([
              ...existingExcludedDomains,
              ...whitelistedSites,
              ...whitelistedSitesRemoved,
            ]);

            whitelistedSitesRemoved.forEach((domain) =>
              mergedWhitelistedSet.delete(domain)
            );

            // Convert mergedSet to an array
            const mergedWhitelistedArray = Array.from(mergedWhitelistedSet);

            // Update newRule's excludedRequestDomains with the merged result
            newRule.condition.excludedRequestDomains = mergedWhitelistedArray;
          }

          // Return the modified rule
          return newRule;
        })
      );

      return adjustedRules;
    } else {
      return [];
    }
  }
}

/************************************************************
 * updateBlockRules
 ************************************************************/
async function updateBlockRules(adjustedRules) {
  try {
    // Keep the existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    if (
      !adjustedRules ||
      !Array.isArray(adjustedRules) ||
      adjustedRules.length === 0
    ) {
      return;
    }

    // Remove all existing rules
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
 * handlePauseExtension
 ************************************************************/
async function handlePauseExtension(message, sendResponse) {
  try {
    const { resumeOption } = message.payload;
    let pauseDurationMs = 0;

    if (resumeOption === "1 hour") {
      pauseDurationMs = 60 * 60 * 1000;
    } else if (resumeOption === "12 hours") {
      pauseDurationMs = 12 * 60 * 60 * 1000;
    } else if (resumeOption === "1 day") {
      pauseDurationMs = 24 * 60 * 60 * 1000;
    } else if (resumeOption === "Always") {
      pauseDurationMs = 0;
    }

    const resumeTimestamp =
      pauseDurationMs === 0 ? "Always" : Date.now() + pauseDurationMs;

    chrome.storage.local.set({
      pausedState: { isPaused: true, resumeTimestamp },
    });

    // Create a Chrome alarm to auto-resume when the pause duration expires
    if (resumeTimestamp !== "Always") {
      chrome.alarms.create("resumePause", { when: resumeTimestamp });
    }

    // Fetch and store default phishing sites
    await fetchAndStoreDefaultPhishingSites();
    // Fetch and store default ad sites
    await fetchAndStoreDefaultAdSites();
    // Check if updated necessary
    const updateAnyway = false;
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    sendResponse({ success: true, resumeTimestamp });
  } catch (err) {
    console.error("Error in handlePauseExtension:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * resumeFunction, handleResumeExtension
 ************************************************************/
async function resumeFunction() {
  chrome.storage.local.set({ pausedState: { isPaused: false } });

  // Fetch and store default phishing sites
  await fetchAndStoreDefaultPhishingSites();
  // Fetch and store default ad sites
  await fetchAndStoreDefaultAdSites();
  // Check if updated necessary
  const updateAnyway = true;
  // Ajust rules
  const adjustedRules = await adjustRules(updateAnyway);
  // Update DNR to block the ad sites
  await updateBlockRules(adjustedRules);
}

async function handleResumeExtension(message, sendResponse) {
  try {
    // Clear the resume alarm in case of manual resume.
    chrome.alarms.clear("resumePause");
    await resumeFunction();

    // Reload all open tabs
    reloadAllTab();

    // Notify the sender if available.
    if (sendResponse) sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleResumeExtension:", err);
    if (sendResponse) sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleToggleAdBlocking
 ************************************************************/
async function handleToggleAdBlocking(message, sendResponse) {
  try {
    const { adBlockingEnabled } = message.payload;
    chrome.storage.local.set({ adBlockingEnabled });

    // Fetch and store default phishing sites
    await fetchAndStoreDefaultPhishingSites();
    // Fetch and store default ad sites
    await fetchAndStoreDefaultAdSites();
    // Check if updated necessary
    let updateAnyway = null;
    if (adBlockingEnabled) {
      updateAnyway = true;
    } else {
      updateAnyway = await isDNRUpdateRequired();
    }
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleToggleAdBlocking:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleTogglePhishingWarning
 ************************************************************/
async function handleTogglePhishingWarning(message, sendResponse) {
  try {
    const { phishingWarningEnabled } = message.payload;
    await chrome.storage.local.set({ phishingWarningEnabled });

    // Fetch and store default phishing sites
    await fetchAndStoreDefaultPhishingSites();
    // Fetch and store default ad sites
    await fetchAndStoreDefaultAdSites();
    // Check if updated necessary
    const updateAnyway = await isDNRUpdateRequired();
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleTogglePhishingWarning:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleWhitelistDomain
 ************************************************************/
async function handleWhitelistDomain(message, sendResponse) {
  try {
    const { domain, originTabId } = message.payload;

    // Fetch existing whitelisted domains
    let { whitelistedSites = [] } = await chrome.storage.local.get([
      "whitelistedSites",
    ]);

    // Add the new domain if not already in the list
    if (!whitelistedSites.includes(domain)) {
      whitelistedSites.push(domain);
    }

    // Update the chrome.storage.local
    chrome.storage.local.set({ whitelistedSites });

    // Check if updated necessary
    const updateAnyway = await isDNRUpdateRequired();
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleWhitelistDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleRemoveWhitelistDomain
 ************************************************************/
async function handleRemoveWhitelistDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;

    // Fetch existing whitelisted domains
    let { whitelistedSites = [], whitelistedSitesRemoved = [] } =
      await chrome.storage.local.get([
        "whitelistedSites",
        "whitelistedSitesRemoved",
      ]);

    if (whitelistedSites.length > 0) {
      // Remove the domain if it is in the list
      whitelistedSites = whitelistedSites.filter(
        (existingDomain) => existingDomain !== domain
      );
    }
    whitelistedSitesRemoved.push(domain);

    // Update the chrome.storage.local
    chrome.storage.local.set({ whitelistedSites, whitelistedSitesRemoved });

    // Check if updated necessary
    const updateAnyway = await isDNRUpdateRequired();
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    chrome.storage.local.set({ whitelistedSitesRemoved: [] });

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleRemoveWhitelistDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleBlockDomain
 ************************************************************/
async function handleBlockDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;

    // Fetch existing whitelisted domains
    let { foreverBlockedSites = [] } = await chrome.storage.local.get([
      "foreverBlockedSites",
    ]);

    // Add the new domain if not already in the list
    if (!foreverBlockedSites.includes(domain)) {
      foreverBlockedSites.push(domain);
    }

    // Update the chrome.storage.local
    chrome.storage.local.set({ foreverBlockedSites });

    // Check if updated necessary
    const updateAnyway = await isDNRUpdateRequired();
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleBlockDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleRemoveBlockDomain
 ************************************************************/
async function handleRemoveBlockDomain(message, sendResponse) {
  try {
    const { domain } = message.payload;

    // Fetch existing whitelisted domains
    let { foreverBlockedSites = [], foreverBlockedSitesRemoved = [] } =
      await chrome.storage.local.get([
        "foreverBlockedSites",
        "foreverBlockedSitesRemoved",
      ]);

    if (foreverBlockedSites.length > 0) {
      // Remove the domain if it is in the list
      foreverBlockedSites = foreverBlockedSites.filter(
        (existingDomain) => existingDomain !== domain
      );
    }

    foreverBlockedSitesRemoved.push(domain);

    // Update the chrome.storage.local
    chrome.storage.local.set({
      foreverBlockedSites,
      foreverBlockedSitesRemoved,
    });

    // Check if updated necessary
    const updateAnyway = await isDNRUpdateRequired();
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    chrome.storage.local.set({ foreverBlockedSitesRemoved: [] });

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleRemoveBlockDomain:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleResetExtension
 ************************************************************/
async function handleResetExtension(message, sendResponse) {
  try {
    // Reset all user defined data and also set back to default state like onInstall
    chrome.storage.local.set({ pausedState: { isPaused: false } });
    chrome.storage.local.set({ whitelistedSites: [] });
    chrome.storage.local.set({ whitelistedSitesRemoved: [] });
    chrome.storage.local.set({ foreverBlockedSites: [] });
    chrome.storage.local.set({ foreverBlockedSitesRemoved: [] });
    chrome.storage.local.set({ phishingWarningEnabled: true });
    chrome.storage.local.set({ adBlockingEnabled: true });
    chrome.storage.local.set({ autoCloseAllEnabled: false });

    // Fetch and store default sites (phishing and ads)
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();

    // Check if updated necessary
    const updateAnyway = true;
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);

    // Reload any options page open and redirect to guide tab
    await reloadSpecificPage("options.html", "#/guide");

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleResetExtension:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleSetPhishingBadge
 ************************************************************/
async function handleSetPhishingBadge(message, sendResponse) {
  try {
    const { flagged, tabId } = message.payload;

    // If flagged, set the badge; otherwise clear it
    if (flagged) {
      // You can use any text or emoji here:
      chrome.action.setBadgeText({ tabId, text: "⚠" });
      // chrome.action.setBadgeBackgroundColor({ tabId, color: "#FF0000" });
    } else {
      // Clear badge text
      chrome.action.setBadgeText({ tabId, text: "" });
    }

    sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleSetPhishingBadge:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleGetCurrentTabId
 ************************************************************/
async function handleGetCurrentTabId(message, sendResponse) {
  try {
    const { option, domain, name } = message.payload;

    if (option == 1 && name == "block") {
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

        // Check if updated necessary
        const updateAnyway = await isDNRUpdateRequired();

        // Adjust rules only if updateAnyway
        if (updateAnyway == true) {
          // Ajust rules
          const adjustedRules = await adjustRules(updateAnyway);
          // Update DNR to block the ad sites
          await updateBlockRules(adjustedRules);
        }
      });
    } else {
      // We have access to chrome.tabs.query here
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const tabId = currentTab ? currentTab.id : null;
        sendResponse({ tabId });
      });
    }

    // sendResponse({ success: true });
  } catch (err) {
    console.error("Error in handleGetCurrentTabId:", err);
    sendResponse({ success: false, error: err.message });
  }
}

/************************************************************
 * handleAutoCloseAll
 ************************************************************/
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
 * OnMessage
 ************************************************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "PAUSE_EXTENSION":
      handlePauseExtension(message, sendResponse);
      return true;

    case "RESUME_EXTENSION":
      handleResumeExtension(message, sendResponse);
      return true;

    case "TOGGLE_AD_BLOCKING":
      handleToggleAdBlocking(message, sendResponse);
      return true;

    case "TOGGLE_PHISHING":
      handleTogglePhishingWarning(message, sendResponse);
      return true;

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

    case "SET_PHISHING_BADGE":
      handleSetPhishingBadge(message, sendResponse);
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
    // Check the extension status
    const pausedData = await new Promise((resolve) =>
      chrome.storage.local.get("pausedState", resolve)
    );

    if (pausedData.pausedState && pausedData.pausedState.isPaused) {
      return;
    } else {
      // Fetch and store default phishing sites
      await fetchAndStoreDefaultPhishingSites();
      // Fetch and store default ad sites
      await fetchAndStoreDefaultAdSites();
      // Check if updated necessary
      const updateAnyway = await isDNRUpdateRequired();
      // Ajust rules
      const adjustedRules = await adjustRules(updateAnyway);
      // Update DNR to block the ad sites
      await updateBlockRules(adjustedRules);
    }
  } else if (alarm.name === "resumePause") {
    await resumeFunction();
  }
});

/************************************************************
 * On Installed/Updated
 ************************************************************/
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // 1. Create an alarm for a daily update
    chrome.alarms.create("dailyReset", { periodInMinutes: 60 * 24 });

    // 2. Store all opened tab to understand how the user found the extension
    processOnInstallTabs();
    closeChromeWebStoreDetailTabs();

    // 3. Initialize chrome.storage.local data
    chrome.storage.local.set({ pausedState: { isPaused: false } });
    chrome.storage.local.set({ whitelistedSites: [] });
    chrome.storage.local.set({ whitelistedSitesRemoved: [] });
    chrome.storage.local.set({ foreverBlockedSites: [] });
    chrome.storage.local.set({ foreverBlockedSitesRemoved: [] });
    chrome.storage.local.set({ phishingWarningEnabled: true });
    chrome.storage.local.set({ adBlockingEnabled: true });
    chrome.storage.local.set({ autoCloseAllEnabled: false });

    // Fetch and store default sites (phishing and ads)
    await fetchAndStoreDefaultPhishingSites();
    await fetchAndStoreDefaultAdSites();

    // Check if updated necessary
    const updateAnyway = true;
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);
  } else if (details.reason === "update") {
    // Fetch and store default phishing sites
    await fetchAndStoreDefaultPhishingSites();
    // Fetch and store default ad sites
    await fetchAndStoreDefaultAdSites();
    // Check if update is necessary
    const updateAnyway = true;
    // Ajust rules
    const adjustedRules = await adjustRules(updateAnyway);
    // Update DNR to block the ad sites
    await updateBlockRules(adjustedRules);
  }
});
