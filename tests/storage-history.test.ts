/**
 * Vitest unit tests for lib/storage.ts and lib/history.ts
 *
 * These tests mock chrome.storage.local — they do NOT require a real browser.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─────────────────────────────────────────────
// Mock chrome.storage.local
// ─────────────────────────────────────────────

const store: Record<string, unknown> = {};

const mockStorage = {
  local: {
    get: vi.fn(async (key: string | string[]) => {
      if (typeof key === "string") return { [key]: store[key] };
      return Object.fromEntries((key as string[]).map((k) => [k, store[k]]));
    }),
    set: vi.fn(async (obj: Record<string, unknown>) => {
      Object.assign(store, obj);
    }),
    remove: vi.fn(async (key: string | string[]) => {
      const keys = typeof key === "string" ? [key] : key;
      keys.forEach((k) => { delete store[k]; });
    }),
  },
};

vi.stubGlobal("chrome", { storage: mockStorage });

// ─────────────────────────────────────────────
// Imports (after mock is set up)
// ─────────────────────────────────────────────

import {
  getHistory,
  setHistory,
  getSettings,
  setSettings,
  updateSettings,
  DEFAULT_SETTINGS,
  HISTORY_CAP,
} from "../lib/storage";

import {
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  getRecentHistory,
} from "../lib/history";

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

beforeEach(() => {
  // Clear in-memory store between tests
  for (const k of Object.keys(store)) delete store[k];
  vi.clearAllMocks();
});

describe("storage — getHistory", () => {
  it("returns [] when nothing stored", async () => {
    const result = await getHistory();
    expect(result).toEqual([]);
  });

  it("returns stored history", async () => {
    await setHistory([{ id: "1", prompt: "test", targets: ["chatgpt"], timestamp: 123 }]);
    const result = await getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].prompt).toBe("test");
  });
});

describe("storage — settings", () => {
  it("returns DEFAULT_SETTINGS when nothing stored", async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("persists and retrieves settings", async () => {
    await setSettings({ defaultTargets: ["claude"], autoSubmit: false, useNewTabs: true });
    const settings = await getSettings();
    expect(settings.autoSubmit).toBe(false);
    expect(settings.defaultTargets).toEqual(["claude"]);
    expect(settings.useNewTabs).toBe(true);
  });

  it("updateSettings merges partials correctly", async () => {
    await setSettings(DEFAULT_SETTINGS);
    await updateSettings({ autoSubmit: false });
    const settings = await getSettings();
    expect(settings.autoSubmit).toBe(false);
    // defaultTargets should be unchanged
    expect(settings.defaultTargets).toEqual(DEFAULT_SETTINGS.defaultTargets);
  });
});

describe("history — addHistoryEntry", () => {
  it("adds an entry to the top of history", async () => {
    await addHistoryEntry("hello world", ["chatgpt", "claude"], "test-id-1");
    const history = await getHistory();
    const entry = history[0];
    
    expect(entry.prompt).toBe("hello world");
    expect(entry.targets).toEqual(["chatgpt", "claude"]);
    expect(entry.id).toBe("test-id-1");
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it("prepends (newest first)", async () => {
    await addHistoryEntry("first", ["chatgpt"], "id-1");
    await addHistoryEntry("second", ["claude"], "id-2");
    const history = await getHistory();
    expect(history[0].prompt).toBe("second");
    expect(history[1].prompt).toBe("first");
  });

  it(`caps history at ${HISTORY_CAP} entries`, async () => {
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      await addHistoryEntry(`prompt ${i}`, ["chatgpt"], `id-${i}`);
    }
    const history = await getHistory();
    expect(history).toHaveLength(HISTORY_CAP);
    // Newest entry should be prompt 54 (HISTORY_CAP+4)
    expect(history[0].prompt).toBe(`prompt ${HISTORY_CAP + 4}`);
  });
});

describe("history — removeHistoryEntry", () => {
  it("removes an entry by id", async () => {
    await addHistoryEntry("to remove", ["gemini"], "remove-id");
    await removeHistoryEntry("remove-id");
    const history = await getHistory();
    expect(history.find((e) => e.id === "remove-id")).toBeUndefined();
  });

  it("is a no-op for unknown ids", async () => {
    await addHistoryEntry("keep me", ["chatgpt"], "keep-id");
    await removeHistoryEntry("nonexistent-id");
    const history = await getHistory();
    expect(history).toHaveLength(1);
  });
});

describe("history — clearHistory", () => {
  it("clears all entries", async () => {
    await addHistoryEntry("a", ["chatgpt"], "id-a");
    await addHistoryEntry("b", ["claude"], "id-b");
    await clearHistory();
    const history = await getHistory();
    expect(history).toHaveLength(0);
  });
});

describe("history — getRecentHistory", () => {
  it("returns at most `limit` entries", async () => {
    for (let i = 0; i < 30; i++) {
      await addHistoryEntry(`p${i}`, ["chatgpt"], `id-${i}`);
    }
    const recent = await getRecentHistory(10);
    expect(recent).toHaveLength(10);
  });
});
