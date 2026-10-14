/**
 * Product Mixer Utility
 * 
 * Provides:
 * 1. Store Interleaving (Company Mixing) - Balances products across stores so no single company dominates
 * 2. User Session Variety - Deterministic or random variety per user/session while respecting admin priority
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
 * Shuffles items within small windows/buckets (bucketSize)
 * so that top priority items stay near the top, but their relative order is varied.
 */
function bucketShuffle(array, bucketSize, rng) {
  const result = [...array];
  for (let i = 0; i < result.length; i += bucketSize) {
    const end = Math.min(i + bucketSize, result.length);
    for (let j = end - 1; j > i; j--) {
      const k = i + Math.floor(rng() * (j - i + 1));
      [result[j], result[k]] = [result[k], result[j]];
    }
  }
  return result;
}

/**
 * Mix products across stores (Interleaving) + User Session Variety
 * 
 * @param {Array} products - Raw products from database (ordered by sortOrder asc)
 * @param {string|number|null} seed - Optional seed from user session
 * @returns {Array} - Balanced, mixed products
 */
export function mixProductsByStore(products, seed = null) {
  if (!Array.isArray(products) || products.length <= 1) {
    return products;
  }

  // Use provided seed or generate dynamic seed
  const actualSeed = seed || `${Date.now()}_${Math.random()}`;
  const rng = createPRNG(actualSeed);

  // Group products by store
  const storeMap = new Map();
  for (const product of products) {
    const storeKey = product.storeRel?.slug || product.storeRel?.id || product.storeId || 'other';
    if (!storeMap.has(storeKey)) {
      storeMap.set(storeKey, []);
    }
    storeMap.get(storeKey).push(product);
  }

  // If only 1 store exists (e.g. filtered by store), bucket shuffle within that store
  if (storeMap.size <= 1) {
    return bucketShuffle(products, 4, rng);
  }

  // Prepare each store queue with varied ordering while respecting general admin priority
  const storeQueues = [];
  for (const [storeKey, items] of storeMap.entries()) {
    // Preserve sortOrder prioritization, then bucket shuffle so top deals stay near top
    items.sort((a, b) => {
      const rankA = a.sortOrder !== undefined && a.sortOrder !== null ? a.sortOrder : 999999;
      const rankB = b.sortOrder !== undefined && b.sortOrder !== null ? b.sortOrder : 999999;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const variedItems = bucketShuffle(items, 3, rng);
    storeQueues.push({
      storeKey,
      items: variedItems,
      index: 0
    });
  }

  // Randomize initial store sequence for this user's session
  for (let i = storeQueues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [storeQueues[i], storeQueues[j]] = [storeQueues[j], storeQueues[i]];
  }

  // Interleave products across stores (Fair Round-Robin)
  const mixed = [];
  let activeQueues = storeQueues.filter(q => q.index < q.items.length);

  while (activeQueues.length > 0) {
    for (let i = 0; i < activeQueues.length; i++) {
      const q = activeQueues[i];
      if (q.index < q.items.length) {
        mixed.push(q.items[q.index]);
        q.index++;
      }
    }
    activeQueues = activeQueues.filter(q => q.index < q.items.length);
  }

  return mixed;
}
