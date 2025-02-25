/************************************************************
 * popup.js
 ************************************************************/

let currentDomain = null;
const pauseOptions = ["1 hour", "12 hours", "1 day", "Always"];
let currentPauseIndex = 0;
let pauseCountdownInterval = null;

/************************************************************
 * initializeAdBlockingToggle - Initializes the Ad-Blocking toggle state and event listener
 ************************************************************/
function initializeAdBlockingToggle() {
  const adBlockingToggle = document.getElementById("toggleAdBlocking");
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
            console.warn("Failed to update ad-blocking state.");
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
  const phishingToggle = document.getElementById("togglePhishingWarning");
  if (phishingToggle) {
    // Retrieve the current state from storage
    chrome.storage.local.get("phishingWarningEnabled", (data) => {
      phishingToggle.checked = data.phishingWarningEnabled !== false; // Default to true if not set
    });

    // Add event listener for changes
    phishingToggle.addEventListener("change", () => {
      const isEnabled = phishingToggle.checked;
      // Save the state to storage
      chrome.storage.local.set({ phishingWarningEnabled: isEnabled }, () => {});

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

document.addEventListener("DOMContentLoaded", () => {
  // Get the active tab's domain
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || !tabs.length) return;
    try {
      const url = new URL(tabs[0].url || "");
      currentDomain = url.hostname.replace(/^www\./, "");
    } catch (e) {
      console.error("Invalid URL in active tab");
    }

    // Update the .site-name text in the header
    const siteNameEl = document.querySelector(".site-name");
    if (siteNameEl) {
      siteNameEl.textContent = currentDomain;
    }

    // Check phishing status and update the new container
    await updatePhishingWarningContainer();
  });

  // Initialize Ad-Blocking Toggle
  initializeAdBlockingToggle();

  // Initialize Phishing Warning Toggle
  initializePhishingWarningToggle();

  // Settings Icon => open options page, then close popup
  const settingsIcon = document.getElementById("settingsIcon");
  if (settingsIcon) {
    settingsIcon.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  // Pause Mode Toggle
  const pauseToggle = document.getElementById("togglePause");
  const pauseSetupDiv = document.getElementById("pauseSetup");
  const pauseActiveDiv = document.getElementById("pauseActive");
  pauseToggle.addEventListener("change", () => {
    if (pauseToggle.checked) {
      pauseSetupDiv.style.display = "block";
      // Do NOT hide the phishing warning container here
    } else {
      pauseSetupDiv.style.display = "none";
      pauseActiveDiv.style.display = "none";
      const pauseCountdownEl = document.getElementById("pauseCountdown");
      if (pauseCountdownEl) {
        pauseCountdownEl.textContent = "00:00";
      }
      chrome.runtime.sendMessage({ type: "RESUME_EXTENSION" }, (response) => {
        window.close();
        if (response && response.success) {
          // Close the popup
        }
      });
      if (pauseCountdownInterval) {
        clearInterval(pauseCountdownInterval);
        pauseCountdownInterval = null;
      }

      // Update the phishing warning container only if pause is ended
      updatePhishingWarningVisibility(false);
    }
  });

  // Pause Duration Carousel functionality
  const prevPauseBtn = document.getElementById("prevPause");
  const nextPauseBtn = document.getElementById("nextPause");
  const pauseTimeSpan = document.getElementById("pauseTime");

  currentPauseIndex = 0;
  updatePauseCarouselDisplay();

  if (prevPauseBtn && nextPauseBtn) {
    prevPauseBtn.addEventListener("click", () => {
      currentPauseIndex =
        (currentPauseIndex - 1 + pauseOptions.length) % pauseOptions.length;
      updatePauseCarouselDisplay();
    });
    nextPauseBtn.addEventListener("click", () => {
      currentPauseIndex = (currentPauseIndex + 1) % pauseOptions.length;
      updatePauseCarouselDisplay();
    });
  }

  // Start Pause Action
  const startPauseBtn = document.getElementById("startPause");
  startPauseBtn.addEventListener("click", () => {
    const selectedPauseTime = pauseOptions[currentPauseIndex];
    chrome.runtime.sendMessage(
      { type: "PAUSE_EXTENSION", payload: { resumeOption: selectedPauseTime } },
      (response) => {
        if (response && response.success) {
          pauseSetupDiv.style.display = "none";
          pauseActiveDiv.style.display = "block";
          if (
            response.resumeTimestamp &&
            response.resumeTimestamp !== "Always"
          ) {
            const endTime = parseInt(response.resumeTimestamp, 10);
            if (!isNaN(endTime) && endTime > Date.now()) {
              startPauseCountdown(endTime);
            } else {
              console.error(
                "Invalid resumeTimestamp received:",
                response.resumeTimestamp
              );
              document.getElementById("pauseCountdown").textContent = "00:00";
            }
          } else if (response.resumeTimestamp === "Always") {
            document.getElementById("pauseCountdown").textContent = "Always";
          } else {
            console.error(
              "resumeTimestamp missing or invalid in response:",
              response.resumeTimestamp
            );
            document.getElementById("pauseCountdown").textContent = "00:00";
          }

          // Hide the phishing warning container since the extension is now paused
          updatePhishingWarningVisibility(true);
        } else {
          console.warn("Failed to start pause.");
        }
      }
    );
  });

  // Check saved Pause state when popup loads
  checkPausedStatus();
});

/************************************************************
 * updatePauseCarouselDisplay - updates the pause duration display
 ************************************************************/
function updatePauseCarouselDisplay() {
  const pauseTimeSpan = document.getElementById("pauseTime");
  if (pauseTimeSpan) {
    pauseTimeSpan.textContent = pauseOptions[currentPauseIndex];
  }
}

/************************************************************
 * Pause Countdown Functions
 ************************************************************/
function updatePauseCountdown(endTime) {
  const now = Date.now();
  const remaining = endTime - now;
  const countdownEl = document.getElementById("pauseCountdown");

  if (remaining <= 0) {
    countdownEl.textContent = "00:00";
    clearInterval(pauseCountdownInterval);
    pauseCountdownInterval = null;
    document.getElementById("togglePause").checked = false;
    pauseActiveDiv.style.display = "none";
    chrome.runtime.sendMessage({ type: "RESUME_EXTENSION" }, (response) => {
      if (response && response.success) {
      }
    });

    // Update the phishing warning container since the pause has ended
    updatePhishingWarningVisibility(false);
  } else {
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdownEl.textContent =
      (hours > 0 ? `${hours}h ` : "") +
      (minutes > 0 ? `${minutes}m ` : "") +
      `${seconds}s`;
  }
}

function startPauseCountdown(endTime) {
  if (pauseCountdownInterval) clearInterval(pauseCountdownInterval);
  updatePauseCountdown(endTime);
  pauseCountdownInterval = setInterval(() => {
    updatePauseCountdown(endTime);
  }, 1000); // Updated to 1000ms for proper countdown
}

/************************************************************
 * checkPausedStatus - checks stored pause state and updates UI
 ************************************************************/
function checkPausedStatus() {
  chrome.storage.local.get("pausedState", (data) => {
    const pausedState = data.pausedState;
    const pauseToggle = document.getElementById("togglePause");
    const pauseActiveDiv = document.getElementById("pauseActive");
    const pauseCountdownEl = document.getElementById("pauseCountdown");

    if (pausedState && pausedState.isPaused) {
      const now = Date.now();
      if (
        pausedState.resumeTimestamp !== "Always" &&
        pausedState.resumeTimestamp <= now
      ) {
        pauseToggle.checked = false;
        pauseActiveDiv.style.display = "none";
        chrome.runtime.sendMessage({ type: "RESUME_EXTENSION" }, (response) => {
          if (response && response.success) {
          }
        });

        // Update the phishing warning container since the pause has ended
        updatePhishingWarningVisibility(false);
      } else {
        pauseToggle.checked = true;
        pauseActiveDiv.style.display = "block";
        if (pausedState.resumeTimestamp !== "Always") {
          const endTime = parseInt(pausedState.resumeTimestamp, 10);
          if (!isNaN(endTime) && endTime > now) {
            startPauseCountdown(endTime);
          } else {
            console.error(
              "Invalid resumeTimestamp in pausedState:",
              pausedState.resumeTimestamp
            );
            pauseCountdownEl.textContent = "00:00";
          }
        } else {
          pauseCountdownEl.textContent = "Always";
        }

        // Hide the phishing warning container since the extension is paused
        updatePhishingWarningVisibility(true);
      }
    } else {
      pauseToggle.checked = false;
      pauseActiveDiv.style.display = "none";
      const pauseCountdownEl = document.getElementById("pauseCountdown");
      if (pauseCountdownEl) {
        pauseCountdownEl.textContent = "00:00";
      }

      // Update the phishing warning container since the extension is not paused
      updatePhishingWarningVisibility(false);
    }
  });
}

/************************************************************
 * updatePhishingWarningContainer - Determines and updates the phishing warning container
 ************************************************************/
async function updatePhishingWarningContainer() {
  const phishingWarningContainer = document.getElementById(
    "phishingWarningContainer"
  );
  const phishingMessageEl = document.getElementById("phishingMessage");
  const phishingIconEl = document.getElementById("phishingIcon");
  const phishingCharacteristicEl = document.getElementById(
    "phishingCharacteristic"
  ); // New Element

  if (!currentDomain) {
    phishingWarningContainer.style.display = "none";
    return;
  }

  // Retrieve phishingDomainsData from storage
  chrome.storage.local.get("phishingDomainsData", (data) => {
    const phishingDomainsData = data.phishingDomainsData || {};

    // Check if currentDomain is in phishingDomainsData
    const isPhishing = phishingDomainsData.hasOwnProperty(currentDomain);

    // Retrieve paused state
    chrome.storage.local.get("pausedState", (pauseData) => {
      const isPaused = pauseData.pausedState && pauseData.pausedState.isPaused;

      if (isPaused) {
        // If paused, hide the phishing warning container
        phishingWarningContainer.style.display = "none";
      } else {
        if (isPhishing) {
          // Show warning message and change icon
          phishingMessageEl.textContent = "Warning: Potential phishing site";
          phishingIconEl.className = "fas fa-exclamation-triangle";
          phishingIconEl.style.color = "#FFA500"; // Orange-Yellow
          phishingWarningContainer.style.display = "flex";
          phishingWarningContainer.style.alignItems = "center";

          // Populate Characteristic
          const characteristicItem = phishingDomainsData[currentDomain].find(
            (item) => item.type === "characteristics"
          );
          phishingCharacteristic.style.display = "block";
          phishingCharacteristicEl.textContent =
            characteristicItem && characteristicItem.characteristics
              ? characteristicItem.characteristics
              : "No additional details available.";
        } else {
          // Show safe message and change icon
          phishingMessageEl.textContent =
            "All clear! No issues detected on this site.";
          phishingIconEl.className = "fas fa-check-circle";
          phishingIconEl.style.color = "#00FF00"; // Green
          phishingWarningContainer.style.display = "flex";
          phishingWarningContainer.style.alignItems = "center";

          // Clear Characteristic
          phishingCharacteristicEl.textContent = "";
        }
      }
    });
  });
}

/************************************************************
 * updatePhishingWarningVisibility - Utility function to show/hide phishing warning container
 ************************************************************/
function updatePhishingWarningVisibility(isPaused) {
  const phishingWarningContainer = document.getElementById(
    "phishingWarningContainer"
  );

  if (isPaused) {
    phishingWarningContainer.style.display = "none";
  } else {
    updatePhishingWarningContainer();
  }
}
