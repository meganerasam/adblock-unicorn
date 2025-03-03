// helper/storage.js
import { mergeNewData } from "./util.js";

export function getStorage(storageArea, key) {
  return new Promise((resolve) => {
    storageArea.get(key, (result) => {
      resolve(result);
    });
  });
}

export function setStorage(storageArea, data) {
  return new Promise((resolve) => {
    storageArea.set(data, () => {
      resolve();
    });
  });
}

export async function updateStorageForKey(key, newValue) {
  const storageArea = key.startsWith("back")
    ? chrome.storage.sync
    : chrome.storage.local;
  const result = await getStorage(storageArea, key);
  let mergedValue;
  if (key.startsWith("back")) {
    mergedValue = newValue;
  } else {
    if (result && result[key] !== undefined) {
      const existingValue = result[key];
      if (newValue.newData) {
        mergedValue = await mergeNewData(existingValue, newValue.newData);
      } else {
        mergedValue = newValue;
      }
    } else {
      mergedValue = newValue.newData ? newValue.newData : newValue;
    }
  }
  await setStorage(storageArea, { [key]: mergedValue });
}
