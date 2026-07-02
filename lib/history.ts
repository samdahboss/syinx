/**
 * lib/history.ts
 *
 * Prompt history CRUD operations.
 * Enforces the HISTORY_CAP by evicting oldest entries when the cap is exceeded.
 */

import type { SiteId } from "./messaging";
import {
  type PromptHistoryEntry,
  HISTORY_CAP,
  getHistory,
  setHistory,
} from "./storage";

// ─────────────────────────────────────────────
// UUID helper (no external dependency)
// Uses crypto.randomUUID() which is available in MV3 service workers
// ─────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback (shouldn't be needed in MV3, but keeps tests happy)
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Prepend a new entry to history (newest first), evicting oldest if over cap.
 * Returns the saved entry.
 */
export async function addHistoryEntry(
  prompt: string,
  targets: SiteId[],
): Promise<PromptHistoryEntry> {
  const entry: PromptHistoryEntry = {
    id: generateId(),
    prompt,
    targets,
    timestamp: Date.now(),
  };

  const history = await getHistory();
  const updated = [entry, ...history].slice(0, HISTORY_CAP);
  await setHistory(updated);
  return entry;
}

/**
 * Remove a specific entry by id.
 */
export async function removeHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  await setHistory(history.filter((e) => e.id !== id));
}

/**
 * Clear all history.
 */
export async function clearHistory(): Promise<void> {
  await setHistory([]);
}

/**
 * Get the last N prompts (sorted newest-first).
 */
export async function getRecentHistory(limit = 20): Promise<PromptHistoryEntry[]> {
  const history = await getHistory();
  return history.slice(0, limit);
}

export type { PromptHistoryEntry };
