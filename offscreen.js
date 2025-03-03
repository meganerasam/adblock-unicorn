chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "startPreciseTimer") {
    const { domain, delayInMs } = msg.payload;
    setTimeout(() => {
      // Call your whitelist removal operation
      chrome.runtime.sendMessage(
        {
          type: "whitelistOperation",
          payload: { domain, action: "remove" },
        },
        (response) => {
          if (!response || !response.success) {
            console.error("Failed to remove transient whitelist domain");
          }
          sendResponse({ success: true });
          // Request the background script to close the offscreen document.
          chrome.runtime.sendMessage({ type: "closeOffscreen" });
        }
      );
    }, delayInMs);
    // Return true to indicate asynchronous response.
    return true;
  }
});
