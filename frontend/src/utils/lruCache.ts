/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts oldest entries when max size is reached
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  private accessOrder: K[];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Get value from cache
   * Updates access order (moves key to end)
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move key to end (most recently used)
    this.updateAccessOrder(key);

    return this.cache.get(key);
  }

  /**
   * Set value in cache
   * Evicts least recently used entry if max size reached
   */
  set(key: K, value: V): void {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
      return;
    }

    // If max size reached, evict oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Update access order for a key (move to end)
   */
  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
}
