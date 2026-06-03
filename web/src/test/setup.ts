import '@testing-library/jest-dom/vitest';

// Node 26 exposes an experimental global `localStorage` (gated behind a CLI flag,
// otherwise undefined) that shadows jsdom's window.localStorage in the test global
// scope. Install a deterministic in-memory Storage shim so theme/persistence tests
// work regardless of the Node/jsdom storage quirk.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memory = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memory });
}
