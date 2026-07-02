/**
 * lib/storage.ts
 *
 * Typed wrapper around chrome.storage.local.
 * All data is stored locally on the user's device — nothing is transmitted anywhere.
 *
 * Keys:
 *   "history"  → PromptHistoryEntry[]  (capped at HISTORY_CAP entries)
 *   "settings" → Settings
 */

import type { SiteId } from "./messaging";

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

export interface PromptHistoryEntry {
  /** UUID v4 */
  id: string;
  prompt: string;
  targets: SiteId[];
  timestamp: number; // Unix ms
}

export interface Settings {
  defaultTargets: SiteId[];
  autoSubmit: boolean;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  defaultTargets: ["chatgpt", "claude", "gemini"],
  autoSubmit: true,
};

export const HISTORY_CAP = 50;

// ─────────────────────────────────────────────
// Storage keys (single source of truth)
// ─────────────────────────────────────────────

const KEYS = {
  history: "history",
  settings: "settings",
} as const;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Get prompt history. Returns [] if nothing stored yet. */
export async function getHistory(): Promise<PromptHistoryEntry[]> {
  const result = await chrome.storage.local.get(KEYS.history);
  return (result[KEYS.history] as PromptHistoryEntry[] | undefined) ?? [];
}

/** Replace the full history array. */
export async function setHistory(entries: PromptHistoryEntry[]): Promise<void> {
  await chrome.storage.local.set({ [KEYS.history]: entries });
}

/** Get settings. Returns DEFAULT_SETTINGS if nothing stored yet. */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEYS.settings);
  return (result[KEYS.settings] as Settings | undefined) ?? DEFAULT_SETTINGS;
}

/** Persist settings. */
export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEYS.settings]: settings });
}

/** Merge a partial settings update into the stored settings. */
export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await setSettings(updated);
  return updated;
}
