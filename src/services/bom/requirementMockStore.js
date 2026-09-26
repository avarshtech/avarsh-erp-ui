/**
 * localStorage persistence for the process requirement mock layer (UI design phase).
 *
 * Same contract as services/expdoc/expDocMockStore.js: write-through after every
 * mutation so demo data survives reloads; bumping a module's seed version discards
 * the stored copy and reseeds (the documented demo-reset path); when localStorage is
 * unavailable or full the store lives in memory, and loads read that copy first so
 * edits are not silently lost in a private window. Multi-tab is last-write-wins.
 */
const memory = {};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const loadMockStore = (key, seedVersion, buildSeed) => {
  if (memory[key]?.seedVersion === seedVersion) return memory[key];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.seedVersion === seedVersion) return parsed;
    }
  } catch { /* fall through to a fresh seed */ }
  const seeded = { ...buildSeed(), seedVersion };
  saveMockStore(key, seeded);
  return seeded;
};

export const saveMockStore = (key, db) => {
  try {
    localStorage.setItem(key, JSON.stringify(db));
    delete memory[key];
  } catch {
    memory[key] = db;
  }
};

/** Deep copy for anything handed to a screen, so it can never mutate the store. */
export const detach = clone;

export const mockDelay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mock server error, shaped like an axios error so screens handle both the same way. */
export const mockError = (message, status = 400) => {
  const err = new Error(message);
  err.response = { status, data: { message } };
  return err;
};
