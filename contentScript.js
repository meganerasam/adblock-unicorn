(async function () {
  const type = self === top ? "top" : "iframe";

  // Helper function to normalize a domain name.
  function normalizeDomain(domain) {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  const currentDomain = normalizeDomain(location.hostname);

  if (type === "top") {
    chrome.runtime.sendMessage({
      type: "currentTabInfo",
      payload: { option: 1, domain: currentDomain, name: "block" },
    });
  }

  // Retrieve phishing settings and data from storage.
  const { phishingDomainsData } = await chrome.storage.local.get([
    "phishingDomainsData",
  ]);

  let tabId = null;
  chrome.runtime.sendMessage(
    {
      type: "currentTabInfo",
      payload: { option: 2, domain: currentDomain, name: null },
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

  const domainData = phishingDomainsData.find(
    (item) => normalizeDomain(item.domain) === currentDomain
  );
  if (!domainData) {
    return;
  }

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
    const imageConfig = domainData.image;
    const analysisConfig = domainData.analysis ? domainData.analysis : null;
    const styleConfig = domainData.style;

    let initialWidth = imageConfig?.width ? imageConfig.width + "px" : "0";
    let initialHeight = imageConfig?.height ? imageConfig.height + "px" : "0";
    let backgroundColor = "transparent";

    if (imageConfig) {
      const img = document.createElement("img");
      for (let key in imageConfig) {
        if (imageConfig.hasOwnProperty(key)) {
          const value =
            key === "src"
              ? chrome.runtime.getURL(`res/warning-${imageConfig[key]}.png`)
              : imageConfig[key];
          img.setAttribute(key, value);
        }
      }
      bubble.appendChild(img);
    }

    let analysis = null;
    if (analysisConfig) {
      analysis = document.createElement("div");
      analysis.textContent = analysisConfig;
      analysis.style.cssText = styleConfig.css;
      analysis.style.visibility = "hidden";
      bubble.appendChild(analysis);
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
        border-radius: 50px;
        opacity: 1;
      `;
    bubble.setAttribute("style", containerStyle);

    // Save the original width (as a number) for later.
    const originalWidth = parseInt(initialWidth, 10);

    // On hover, expand the bubble to display image and text.
    bubble.addEventListener("mouseenter", () => {
      if (analysis) {
        // Make the message visible (temporarily) to measure its width.
        analysis.style.visibility = "visible";
        const messageWidth = analysis.scrollWidth;
        // Add extra padding (e.g., 20px) for spacing.
        const expandedWidth = originalWidth + messageWidth + 20;
        bubble.style.width = expandedWidth + "px";
        bubble.style.height = originalWidth + 20 + "px";
        bubble.style.background = styleConfig?.background
          ? styleConfig.background
          : backgroundColor;
        bubble.style.paddingLeft = "10px";
      }
    });

    // On mouse leave, revert to the original bubble state.
    bubble.addEventListener("mouseleave", () => {
      bubble.style.width = initialWidth;
      bubble.style.background = "transparent";
      bubble.style.paddingLeft = "0";
      if (analysis) {
        analysis.style.visibility = "hidden";
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
