// helper/rules.js

// Updates a rule's condition based on provided domain arrays.
// If removeAdDomains is true, the adDomainsData values are removed from the merged set.
export function updateRuleCondition(
  rule,
  adDomainsData,
  foreverBlockedSites,
  foreverBlockedSitesRemoved,
  whitelistedSites,
  whitelistedSitesRemoved,
  removeAdDomains
) {
  if (!rule.condition) rule.condition = {};

  // Update requestDomains.
  const existingDomains = Array.isArray(rule.condition.requestDomains)
    ? rule.condition.requestDomains
    : [];
  const mergedSet = new Set([
    ...existingDomains,
    ...adDomainsData,
    ...foreverBlockedSites,
    ...foreverBlockedSitesRemoved,
  ]);
  if (removeAdDomains) {
    adDomainsData.forEach((domain) => mergedSet.delete(domain));
  }
  foreverBlockedSitesRemoved.forEach((domain) => mergedSet.delete(domain));
  const mergedArray = Array.from(mergedSet);
  if (mergedArray.length > 0) {
    rule.condition.requestDomains = mergedArray;
  } else {
    delete rule.condition.requestDomains;
  }

  // Update excludedRequestDomains.
  const existingExcludedDomains = Array.isArray(
    rule.condition.excludedRequestDomains
  )
    ? rule.condition.excludedRequestDomains
    : [];
  const mergedWhitelistedSet = new Set([
    ...existingExcludedDomains,
    ...whitelistedSites,
    ...whitelistedSitesRemoved,
  ]);
  whitelistedSitesRemoved.forEach((domain) =>
    mergedWhitelistedSet.delete(domain)
  );
  rule.condition.excludedRequestDomains = Array.from(mergedWhitelistedSet);

  // Update excludedInitiatorDomains.
  const existingExcludedInitiatorDomains = Array.isArray(
    rule.condition.excludedInitiatorDomains
  )
    ? rule.condition.excludedInitiatorDomains
    : [];
  const mergedWhitelistedInitiatorSet = new Set([
    ...existingExcludedInitiatorDomains,
    ...whitelistedSites,
    ...whitelistedSitesRemoved,
  ]);
  whitelistedSitesRemoved.forEach((domain) =>
    mergedWhitelistedInitiatorSet.delete(domain)
  );
  rule.condition.excludedInitiatorDomains = Array.from(
    mergedWhitelistedInitiatorSet
  );

  return rule;
}
