// Presentation-side intent only. The server still owns funds, ownership and receipts.
export function displayedCosmeticIntent(item) {
  if (!item || typeof item.cosmeticId !== "string" || !item.cosmeticId
      || item.equipped || item.trophyUnlocked !== true || typeof item.owned !== "boolean"
      || !Number.isSafeInteger(item.price) || item.price < 0) return null;
  return Object.freeze({cosmeticId:item.cosmeticId,purchaseRequired:!item.owned,price:item.owned?0:item.price});
}

export function cosmeticQuoteMatchesIntent(intent, quote) {
  return Boolean(intent && quote && quote.cosmeticId === intent.cosmeticId
    && typeof quote.purchaseRequired === "boolean" && quote.purchaseRequired === intent.purchaseRequired
    && Number.isSafeInteger(quote.price) && quote.price >= 0 && quote.price === intent.price);
}

export function pendingCosmeticPresentation(pending) {
  if (!pending) return "idle";
  // A lost ACK is not a cancellation. Legacy failed records also require exact retry.
  if (pending.submitted === true || pending.failed === true) return "retry";
  if (pending.submitted === false && pending.rejection?.code === "STALE_VERSION") return "rejected";
  // Old pre-submit records and changed quotes require a fresh explicit action at the item.
  return "confirm";
}

// Only a first, authoritative revision rejection is known not to have committed.
// Never reinterpret an earlier unknown ACK (including ambiguous legacy state).
export function definiteCosmeticRejection(error, priorOutcomeUnknown) {
  return priorOutcomeUnknown === false && error?.code === "STALE_VERSION";
}
