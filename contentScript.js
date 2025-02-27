(async function () {
  const type = self === top ? "top" : "iframe";

  // Helper function to normalize a domain name.
  function normalizeDomain(domain) {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  const domain = normalizeDomain(location.hostname);

  if (type === "top") {
    chrome.runtime.sendMessage({
      type: "GET_CURRENT_TAB_ID",
      payload: { option: 1, domain, name: "block" },
    });
  }

  // Retrieve phishing settings and data from storage.
  const { phishingDomainsData } = await chrome.storage.local.get([
    "phishingDomainsData",
  ]);

  let tabId = null;
  chrome.runtime.sendMessage(
    {
      type: "GET_CURRENT_TAB_ID",
      payload: { option: 2, domain, name: null },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Could not get tab ID:", chrome.runtime.lastError);
      } else {
        tabId = response.tabId;
      }
    }
  );

  if (!phishingDomainsData) {
    return;
  }

  const domainData = phishingDomainsData?.[domain] || [];
  if (!Array.isArray(domainData) || domainData.length === 0) {
    return;
  }

  // Extract configurations.
  const imageConfig = domainData.find((item) => item.type === "image");
  const messageConfig = domainData.find((item) => item.type === "message");
  const characteristicsConfig = domainData.find(
    (item) => item.type === "characteristics"
  );

  // Use the size, backgroundColor, and borderColor from characteristics.
  let initialWidth = "0"; // e.g., "60px" or "80px"
  let initialHeight = "0"; // e.g., "60px" or "80px"
  let backgroundColor = "transparent";

  // Wait for the DOM to be ready.
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  onReady(function () {
    // Create the container element.
    const bubble = document.createElement("div");
    bubble.id = "phishing-snackbar";

    // Create and append the image element.
    if (imageConfig && imageConfig.attributes) {
      const img = document.createElement("img");
      for (let key in imageConfig.attributes) {
        if (imageConfig.attributes.hasOwnProperty(key)) {
          const value =
            key === "src"
              ? chrome.runtime.getURL(imageConfig.attributes[key])
              : imageConfig.attributes[key];
          img.setAttribute(key, value);
        }
      }
      bubble.appendChild(img);
    }

    // Create the message element.
    let msg = null;
    if (messageConfig && messageConfig.message) {
      msg = document.createElement("div");
      msg.textContent = messageConfig.message;
      // Use the message style from JSON but force the message to be hidden initially.
      msg.style.cssText = messageConfig.style + "; visibility: hidden;";
      bubble.appendChild(msg);
    }

    if (characteristicsConfig) {
      initialWidth = characteristicsConfig.size.width
        ? characteristicsConfig.size.width
        : initialWidth;
      initialHeight = characteristicsConfig.size.height
        ? characteristicsConfig.size.height
        : initialHeight;

      console.log(backgroundColor);
    }

    let containerStyle = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: ${initialWidth};
        height: ${initialHeight};
        display: flex;
        align-items: center;
        justify-content: flex-start;
        cursor: pointer;
        overflow: hidden;
        background-color: ${backgroundColor};
        transition: width 0.3s ease, border-radius 0.3s ease, opacity 1s ease;
        opacity: 1;
      `;
    bubble.setAttribute("style", containerStyle);

    // Save the original width (as a number) for later.
    const originalWidth = parseInt(initialWidth, 10);

    // On hover, expand the bubble to display image and text as a normal snack bar.
    bubble.addEventListener("mouseenter", () => {
      if (msg) {
        // Temporarily make the message visible (but still hidden from view) to measure its width.
        msg.style.visibility = "visible";
        // Measure the intrinsic width of the message.
        const messageWidth = msg.scrollWidth;
        // Add extra padding (e.g., 20px) for spacing.
        const expandedWidth = originalWidth + messageWidth + 20;
        bubble.style.width = expandedWidth + "px";
        bubble.style.background = characteristicsConfig.backgroundColor
          ? characteristicsConfig.backgroundColor
          : backgroundColor;
        bubble.style.paddingLeft = "10px";
      }
    });

    // On mouse leave, revert to the original bubble (only the image visible).
    bubble.addEventListener("mouseleave", () => {
      bubble.style.width = initialWidth;
      bubble.style.background = "transparent";
      bubble.style.paddingLeft = "0";
      if (msg) {
        msg.style.visibility = "hidden";
      }
    });

    // Append the bubble to the document.
    document.body.appendChild(bubble);

    // After 15 seconds, fade the bubble out.
    setTimeout(() => {
      bubble.style.opacity = "0";
    }, 15000);
  });
})();
