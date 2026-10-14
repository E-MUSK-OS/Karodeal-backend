/**
 * Product Mixer Utility
 * 
 * Provides:
 * 1. Pinned (Starred) Product locking - Pinned products stay at their exact sortOrder rank for all users
 * 2. Full random shuffle across unpinned products for user session variety
 * 3. Light de-clustering so the same store doesn't monopolize consecutive unpinned slots
 */

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createPRNG(seedValue) {
  let s = typeof seedValue === 'number' ? Math.abs(Math.floor(seedValue)) : hashString(String(seedValue));
  if (s === 0) s = 123456789;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mix/Randomize products while strictly locking pinned/starred products to their exact ranks.
 * 
 * @param {Array} products - Raw products from database (sorted by sortOrder asc)
 * @param {string|number|null} seed - Optional seed for user session
 * @returns {Array} - Array with pinned products fixed at their rank, and unpinned products randomized
 */
export function mixProductsByStore(products, seed = null) {
  if (!Array.isArray(products) || products.length <= 1) {
    return products;
  }

  // Separate pinned (starred) and unpinned products
  const pinnedProducts = products.filter(p => p.isPinned === true);
  const unpinnedProducts = products.filter(p => !p.isPinned);

  // If all products are pinned, return as-is
  if (unpinnedProducts.length === 0) {
    return products;
  }

  const actualSeed = seed || `${Date.now()}_${Math.random()}`;
  const rng = createPRNG(actualSeed);

  // 1. Shuffle unpinned products with Fisher-Yates
  const shuffledUnpinned = [...unpinnedProducts];
  for (let i = shuffledUnpinned.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledUnpinned[i], shuffledUnpinned[j]] = [shuffledUnpinned[j], shuffledUnpinned[i]];
  }

  // 2. Light de-clustering for unpinned items (prevent 3 consecutive identical stores)
  for (let i = 2; i < shuffledUnpinned.length; i++) {
    const storeA = shuffledUnpinned[i - 2].storeRel?.slug || shuffledUnpinned[i - 2].storeId;
    const storeB = shuffledUnpinned[i - 1].storeRel?.slug || shuffledUnpinned[i - 1].storeId;
    const storeC = shuffledUnpinned[i].storeRel?.slug || shuffledUnpinned[i].storeId;

    if (storeA && storeB && storeC && storeA === storeB && storeB === storeC) {
      for (let k = i + 1; k < shuffledUnpinned.length; k++) {
        const storeK = shuffledUnpinned[k].storeRel?.slug || shuffledUnpinned[k].storeId;
        if (storeK && storeK !== storeC) {
          [shuffledUnpinned[i], shuffledUnpinned[k]] = [shuffledUnpinned[k], shuffledUnpinned[i]];
          break;
        }
      }
    }
  }

  // If no products are pinned, return the randomized unpinned list directly
  if (pinnedProducts.length === 0) {
    return shuffledUnpinned;
  }

  // 3. Assemble final array: lock pinned products to their designated ranks (1-indexed sortOrder)
  const totalCount = products.length;
  const result = new Array(totalCount);

  // Sort pinned products by sortOrder ascending
  pinnedProducts.sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));

  for (const pinned of pinnedProducts) {
    let targetIndex = (pinned.sortOrder || 1) - 1;
    if (targetIndex < 0) targetIndex = 0;

    // If targetIndex is already occupied, find the next available slot
    while (targetIndex < totalCount && result[targetIndex] !== undefined) {
      targetIndex++;
    }
    if (targetIndex < totalCount) {
      result[targetIndex] = pinned;
    } else {
      const emptyIdx = result.findIndex(slot => slot === undefined);
      if (emptyIdx !== -1) result[emptyIdx] = pinned;
    }
  }

  // 4. Fill all remaining open slots with the shuffled unpinned items
  let unpinnedIdx = 0;
  for (let i = 0; i < totalCount; i++) {
    if (result[i] === undefined) {
      if (unpinnedIdx < shuffledUnpinned.length) {
        result[i] = shuffledUnpinned[unpinnedIdx++];
      }
    }
  }

  return result.filter(Boolean);
}
