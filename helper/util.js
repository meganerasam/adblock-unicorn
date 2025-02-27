// helper/util.js
export function normalizeDomain(input) {
  // If the input doesn’t start with http:// or https://, prepend https://
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = "https://" + urlString;
  }
  try {
    const hostname = new URL(urlString).hostname;
    return hostname.replace(/^www\./, "");
  } catch (err) {
    return input.trim();
  }
}

export function removeDuplicates(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    const serialized = JSON.stringify(item);
    if (seen.has(serialized)) return false;
    seen.add(serialized);
    return true;
  });
}

export async function mergeNewData(existingValue, newData) {
  if (Array.isArray(existingValue) && Array.isArray(newData)) {
    const mergedArray = [...existingValue, ...newData];
    return removeDuplicates(mergedArray);
  }
  if (
    typeof existingValue === "object" &&
    existingValue !== null &&
    typeof newData === "object" &&
    newData !== null &&
    !Array.isArray(existingValue) &&
    !Array.isArray(newData)
  ) {
    const merged = { ...existingValue };
    for (const key in newData) {
      if (Object.prototype.hasOwnProperty.call(newData, key)) {
        if (Array.isArray(newData[key])) {
          if (Array.isArray(merged[key])) {
            merged[key] = removeDuplicates([...merged[key], ...newData[key]]);
          } else {
            merged[key] = newData[key];
          }
        } else {
          merged[key] = newData[key];
        }
      }
    }
    return merged;
  }
  return newData;
}
