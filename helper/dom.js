// helper/dom.js

// Toggle (i.e. show/hide) an add form for domains.
export function toggleAddForm(formElement, inputElement, errorElement, show) {
  formElement.style.display = show ? "flex" : "none";
  errorElement.textContent = "";
  if (show) {
    inputElement.focus();
  } else {
    inputElement.value = "";
  }
}

// Render a domain list in the given list element.
// If there are no domains, display the provided empty message.
export function renderDomainList(listElement, domains, emptyMessage) {
  listElement.innerHTML = "";
  if (!domains || domains.length === 0) {
    const li = document.createElement("li");
    li.classList.add("empty");
    li.textContent = emptyMessage;
    listElement.appendChild(li);
    return;
  }
  domains.forEach((domain) => {
    const li = document.createElement("li");
    li.innerHTML = `${domain} <button class="btn-remove" data-domain="${domain}"><i class="fas fa-trash"></i></button>`;
    listElement.appendChild(li);
  });
}

// Attach remove listeners to the remove buttons within the given list element.
// The callback will be invoked with the domain to remove.
export function attachRemoveListeners(listElement, callback) {
  const buttons = listElement.querySelectorAll(".btn-remove");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const domain = btn.getAttribute("data-domain");
      await callback(domain);
    });
  });
}

// Generic checkbox initializer.
// element: the checkbox element
// storageKey: key to retrieve/store its value (boolean)
// feature: determine which message to call
export function initializeCheckbox(element, storageKey, feature) {
  chrome.storage.local.get(storageKey, (data) => {
    element.checked = data[storageKey] !== false;
  });
  element.addEventListener("change", () => {
    const isChecked = element.checked;
    chrome.storage.local.set({ [storageKey]: isChecked });
    // Always send the unified 'featureOperation' message with the feature identifier
    chrome.runtime.sendMessage({
      type: "featureOperation",
      payload: {
        feature: feature,
        [storageKey]: isChecked,
      },
    });
  });
}
