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
// Background Script
// ─────────────────────────────────────────────

export default defineBackground(() => {
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

    // Focus the tab (chrome.windows requires extra permission, so we skip window focus)
    await chrome.tabs.update(tab.id!, { active: true });

    // Wait for content script readiness (with retry/backoff)
    const ready = await waitForContentScript(tab.id!);
    if (!ready) {
      return { siteId, success: false, error: "Content script not found. Please refresh this tab." };
    }

    // Send INJECT_PROMPT to the tab's content script
    const result = await sendMessageWithRetry(tab.id!, {
      type: "INJECT_PROMPT",
      prompt,
      autoSubmit,
    });

    if (result !== null && typeof result === "object" && "type" in result && result.type === "INJECT_RESULT") {
      const r = result as Extract<ExtensionMessage, { type: "INJECT_RESULT" }>;
      return { siteId, success: r.success, error: r.error };
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
  if (existing?.id !== undefined) {
    return existing;
  }

  // Open a new tab
  const newTab = await chrome.tabs.create({ url: SITE_URLS[siteId], active: false });
  return newTab;
}

// ─────────────────────────────────────────────
// Content script readiness
// ─────────────────────────────────────────────

/**
 * Polls the content script with PING messages until it responds with PONG.
 */
async function waitForContentScript(
  tabId: number,
  timeoutMs = 15_000,
  pollMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      const res = await chrome.tabs.sendMessage(tabId, { type: "PING" }) as ExtensionMessage;
      if (res && res.type === "PONG") {
        return true;
      }
    } catch (e) {
      // Ignore "Could not establish connection" while the page is loading
    }
    await delay(pollMs);
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
async function sendMessageWithRetry(
  tabId: number,
  message: ExtensionMessage,
  maxAttempts = 3,
  backoffMs = 500,
): Promise<unknown> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await chrome.tabs.sendMessage(tabId, message);
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
