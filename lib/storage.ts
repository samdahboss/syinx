/**
 * lib/storage.ts
 *
 * Typed wrapper around chrome.storage.local.
 * All data is stored locally on the user's device — nothing is transmitted anywhere.
 *
 * Keys:
 *   "history"  → PromptHistoryEntry[]  (capped at HISTORY_CAP entries)
 *   "settings" → Settings
 *   "templates"→ PromptTemplate[]      (capped at TEMPLATES_CAP entries)
 */

import type { SiteId } from "./messaging";

// ─────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────

export interface CapturedResponse {
  siteId: SiteId;
  text: string;
  capturedAt: number;
  error?: string;
}

export interface PromptHistoryEntry {
  /** UUID v4 */
  id: string;
  prompt: string;
  targets: SiteId[];
  timestamp: number; // Unix ms
  responses?: CapturedResponse[];
}

export interface Settings {
  defaultTargets: SiteId[];
  autoSubmit: boolean;
  useNewTabs: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  defaultTargets: ["chatgpt", "claude", "gemini"],
  autoSubmit: true,
  useNewTabs: false,
};

export const HISTORY_CAP = 50;
export const TEMPLATES_CAP = 30;

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "default-summarize",
    name: "Summarizer",
    content: "Summarize the following text in {{n}} bullet points:\n\n{{text}}",
    createdAt: Date.now(),
  },
  {
    id: "default-translate",
    name: "Translator",
    content: "Translate the following text to {{language}}:\n\n{{text}}",
    createdAt: Date.now(),
  }
];

// ─────────────────────────────────────────────
// Storage keys (single source of truth)
// ─────────────────────────────────────────────

const KEYS = {
  history: "history",
  settings: "settings",
  templates: "templates",
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

/**
 * Appends a captured response to an existing history entry.
 * Called by the background worker when a RESPONSE_CAPTURED arrives.
 */
export async function addResponseToEntry(
  sessionId: string,
  response: CapturedResponse,
): Promise<void> {
  const entries = await getHistory();
  const idx = entries.findIndex((e) => e.id === sessionId);
  if (idx === -1) return; // Session may have been evicted; silently ignore.
  const entry = entries[idx];
  entry.responses = [...(entry.responses ?? []), response];
  await setHistory(entries);
}

/** Get prompt templates. Returns DEFAULT_TEMPLATES if nothing stored yet. */
export async function getTemplates(): Promise<PromptTemplate[]> {
  const result = await chrome.storage.local.get(KEYS.templates);
  return (result[KEYS.templates] as PromptTemplate[] | undefined) ?? DEFAULT_TEMPLATES;
}

/** Replace the full templates array. */
export async function setTemplates(templates: PromptTemplate[]): Promise<void> {
  await chrome.storage.local.set({ [KEYS.templates]: templates });
}

/** Add a new template. Enforces TEMPLATES_CAP. */
export async function addTemplate(template: PromptTemplate): Promise<void> {
  const templates = await getTemplates();
  const updated = [template, ...templates].slice(0, TEMPLATES_CAP);
  await setTemplates(updated);
}

/** Update an existing template by id. */
export async function updateTemplate(template: PromptTemplate): Promise<void> {
  const templates = await getTemplates();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx !== -1) {
    templates[idx] = template;
    await setTemplates(templates);
  }
}

/** Delete a template by id. */
export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const updated = templates.filter((t) => t.id !== id);
  await setTemplates(updated);
}
