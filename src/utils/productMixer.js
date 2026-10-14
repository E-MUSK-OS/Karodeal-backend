/**
 * Product Mixer Utility
 * 
 * Provides:
 * Full random shuffle across ALL products in the database for users/sessions,
 * with light de-clustering so the same store doesn't monopolize consecutive slots.
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
 * Randomize products across ALL items in the database
 * 
 * @param {Array} products - Raw products from database
 * @param {string|number|null} seed - Optional seed for session consistency
 * @returns {Array} - Fully randomized products across all items
 */
export function mixProductsByStore(products, seed = null) {
  if (!Array.isArray(products) || products.length <= 1) {
    return products;
  }

  // Use provided seed or generate dynamic seed for true random variety
  const actualSeed = seed || `${Date.now()}_${Math.random()}`;
  const rng = createPRNG(actualSeed);

  const shuffled = [...products];

  // 1. Complete Fisher-Yates shuffle across ALL products
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 2. Light de-clustering: avoid more than 2 consecutive items from the exact same company
  for (let i = 2; i < shuffled.length; i++) {
    const storeA = shuffled[i - 2].storeRel?.slug || shuffled[i - 2].storeId;
    const storeB = shuffled[i - 1].storeRel?.slug || shuffled[i - 1].storeId;
    const storeC = shuffled[i].storeRel?.slug || shuffled[i].storeId;

    if (storeA && storeB && storeC && storeA === storeB && storeB === storeC) {
      for (let k = i + 1; k < shuffled.length; k++) {
        const storeK = shuffled[k].storeRel?.slug || shuffled[k].storeId;
        if (storeK && storeK !== storeC) {
          [shuffled[i], shuffled[k]] = [shuffled[k], shuffled[i]];
          break;
        }
      }
    }
  }

  return shuffled;
}
