/**
 * entrypoints/background.ts
 *
 * MV3 Service Worker — the orchestrator.
 *
 * Responsibilities:
 *  1. Listen for SEND_PROMPT from the popup.
 *  2. For each target site:
 *       a. Find an existing tab or open a new one.
 *       b. Wait for the content script's CONTENT_SCRIPT_READY handshake.
 *       c. Send INJECT_PROMPT to the tab's content script.
 *       d. Collect INJECT_RESULT per tab.
 *  3. Write the prompt to history (chrome.storage.local).
 *  4. Return a SendPromptResponse to the popup.
 *
 * No network calls. No external APIs. Pure in-browser message routing.
 */

import type { ExtensionMessage, SendPromptResponse, SiteId } from "@@/lib/messaging";
import { addHistoryEntry } from "@@/lib/history";

// ─────────────────────────────────────────────
// Site URL patterns (used for tab.query + tab.create)
// ─────────────────────────────────────────────

const SITE_URLS: Record<SiteId, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
};

const SITE_URL_PATTERNS: Record<SiteId, string> = {
  chatgpt: "https://chatgpt.com/*",
  claude: "https://claude.ai/*",
  gemini: "https://gemini.google.com/*",
};

// ─────────────────────────────────────────────
// Ready-tab registry
// Tracks which tabs have sent CONTENT_SCRIPT_READY.
// Keyed by tabId.
// ─────────────────────────────────────────────

const readyTabs = new Set<number>();

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export default defineBackground(() => {
  // ── Track content script readiness ────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message: unknown, sender) => {
    const msg = message as ExtensionMessage;
    if (msg.type === "CONTENT_SCRIPT_READY" && sender.tab?.id !== undefined) {
      readyTabs.add(sender.tab.id);
    }
    // Don't return true here — we're not sending an async response
  });

  // Clean up when a tab closes
  chrome.tabs.onRemoved.addListener((tabId) => {
    readyTabs.delete(tabId);
  });

  // ── Handle SEND_PROMPT from popup ──────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      const msg = message as ExtensionMessage;
      if (msg.type !== "SEND_PROMPT") return false;

      void (async () => {
        // Persist to history before attempting injection (best-effort)
        try {
          await addHistoryEntry(msg.prompt, msg.targets);
        } catch (e) {
          console.warn("[PromptSync] Failed to save history entry:", e);
        }

        // Inject into each target site in parallel
        const results = await Promise.all(
          msg.targets.map((siteId) =>
            injectIntoSite(siteId, msg.prompt, msg.autoSubmit),
          ),
        );

        const response: SendPromptResponse = { results };
        sendResponse(response);
      })();

      return true; // Keep message channel open for async response
    },
  );
});

// ─────────────────────────────────────────────
// Per-site injection logic
// ─────────────────────────────────────────────

async function injectIntoSite(
  siteId: SiteId,
  prompt: string,
  autoSubmit: boolean,
): Promise<SendPromptResponse["results"][number]> {
  try {
    const tab = await findOrOpenTab(siteId);

    // Focus the tab
    await chrome.tabs.update(tab.id!, { active: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Wait for content script readiness (with retry/backoff)
    const ready = await waitForContentScript(tab.id!, siteId);
    if (!ready) {
      return { siteId, success: false, error: "Content script did not become ready in time" };
    }

    // Send INJECT_PROMPT to the tab's content script
    const result = await sendMessageWithRetry<ExtensionMessage>(tab.id!, {
      type: "INJECT_PROMPT",
      prompt,
      autoSubmit,
    });

    if (result?.type === "INJECT_RESULT") {
      return { siteId, success: result.success, error: result.error };
    }

    return { siteId, success: false, error: "Unexpected response from content script" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[PromptSync] Failed to inject into ${siteId}:`, error);
    return { siteId, success: false, error };
  }
}

// ─────────────────────────────────────────────
// Tab management
// ─────────────────────────────────────────────

async function findOrOpenTab(siteId: SiteId): Promise<chrome.tabs.Tab> {
  // Look for an existing tab matching the site's URL pattern
  const [existing] = await chrome.tabs.query({ url: SITE_URL_PATTERNS[siteId] });
  if (existing?.id !== undefined) return existing;

  // Open a new tab and wait for it to finish loading
  const newTab = await chrome.tabs.create({ url: SITE_URLS[siteId], active: false });
  await waitForTabLoad(newTab.id!);

  // Refresh tab info after load
  return chrome.tabs.get(newTab.id!);
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    function listener(
      updatedTabId: number,
      info: chrome.tabs.TabChangeInfo,
    ) {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ─────────────────────────────────────────────
// Content script readiness
// ─────────────────────────────────────────────

/**
 * Wait for a content script to announce CONTENT_SCRIPT_READY.
 * Uses polling against the readyTabs registry.
 * The content script sends this message on every page load.
 */
async function waitForContentScript(
  tabId: number,
  _siteId: SiteId,
  timeoutMs = 10_000,
  pollMs = 250,
): Promise<boolean> {
  if (readyTabs.has(tabId)) return true;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await delay(pollMs);
    if (readyTabs.has(tabId)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// Message sending with retry
// ─────────────────────────────────────────────

/**
 * Send a message to a tab's content script, retrying up to 3 times
 * with 500ms backoff. Handles the case where the content script isn't
 * ready yet when the first message arrives.
 */
async function sendMessageWithRetry<T>(
  tabId: number,
  message: ExtensionMessage,
  maxAttempts = 3,
  backoffMs = 500,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage<ExtensionMessage, T>(tabId, message);
      return response;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      console.warn(`[PromptSync] sendMessage attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
      await delay(backoffMs * attempt);
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
