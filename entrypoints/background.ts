/**
 * entrypoints/background.ts
 *
 * MV3 Service Worker — the orchestrator.
 */

import type { ExtensionMessage, SendPromptResponse, SiteId, SiteResult } from "@@/lib/messaging";
import { addHistoryEntry } from "@@/lib/history";
import { getSettings } from "@@/lib/storage";

// ─────────────────────────────────────────────
// Site URL patterns
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

// State
let currentGroupId: number | undefined;

export default defineBackground(() => {
  // ── Open Options on Icon Click ───────────────────────────────────────────
  chrome.action.onClicked.addListener(() => {
    void chrome.runtime.openOptionsPage();
  });

  // ── Handle Messages ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      const msg = message as ExtensionMessage;
      if (msg.type !== "SEND_PROMPT") return false;

      void (async () => {
        const settings = await getSettings();

        // 1. Open Side Panel if not follow-up
        if (!msg.isFollowUp && sender.tab?.windowId) {
          try {
            await chrome.sidePanel.open({ windowId: sender.tab.windowId });
          } catch (e) {
            console.error("Failed to open side panel:", e);
          }
        }

        // 2. Persist to history
        try {
          await addHistoryEntry(msg.prompt, msg.targets);
        } catch (e) {
          console.warn("[PromptSync] Failed to save history entry:", e);
        }

        const results: SiteResult[] = msg.targets.map(id => ({ siteId: id, status: "pending" }));
        const notifyProgress = () => {
          void chrome.runtime.sendMessage({ type: "PROGRESS_UPDATE", results } as ExtensionMessage);
        };

        notifyProgress();

        const tabIds: number[] = [];

        // 3. Process sequentially
        for (const siteId of msg.targets) {
          const resultRef = results.find(r => r.siteId === siteId)!;
          try {
            // Find or open tab
            const tab = await findOrOpenTab(siteId, settings.useNewTabs, msg.isFollowUp);
            if (tab.id) {
              tabIds.push(tab.id);
              await chrome.tabs.update(tab.id, { active: true });
              
              // Wait for readiness
              const ready = await waitForContentScript(tab.id);
              if (!ready) {
                resultRef.status = "error";
                resultRef.error = "Content script not found. Please refresh.";
              } else {
                // Send prompt
                const injectResult = await sendMessageWithRetry(tab.id, {
                  type: "INJECT_PROMPT",
                  prompt: msg.prompt,
                  autoSubmit: msg.autoSubmit,
                });

                if (injectResult && typeof injectResult === "object" && "type" in injectResult && injectResult.type === "INJECT_RESULT") {
                  const r = injectResult as Extract<ExtensionMessage, { type: "INJECT_RESULT" }>;
                  resultRef.status = r.success ? "success" : "error";
                  resultRef.error = r.error;
                } else {
                  resultRef.status = "error";
                  resultRef.error = "Unexpected response from content script";
                }
              }
            } else {
              resultRef.status = "error";
              resultRef.error = "Failed to create or find tab";
            }
          } catch (e) {
            resultRef.status = "error";
            resultRef.error = e instanceof Error ? e.message : String(e);
          }
          
          notifyProgress();
        }

        // 4. Group Tabs
        if (tabIds.length > 0) {
          try {
            if (msg.isFollowUp && currentGroupId) {
              // Ensure they are in the group
              await chrome.tabs.group({ tabIds, groupId: currentGroupId });
            } else {
              currentGroupId = await chrome.tabs.group({ tabIds });
              await chrome.tabGroups.update(currentGroupId, { title: "PromptSync", color: "blue" });
            }
          } catch (e) {
            console.warn("Failed to group tabs:", e);
          }
        }

        const response: SendPromptResponse = { results };
        sendResponse(response);
      })();

      return true; // Keep message channel open
    },
  );
});

// ─────────────────────────────────────────────
// Tab management
// ─────────────────────────────────────────────

async function findOrOpenTab(siteId: SiteId, useNewTabs: boolean, isFollowUp: boolean): Promise<chrome.tabs.Tab> {
  if (!useNewTabs || isFollowUp) {
    const existing = await chrome.tabs.query({ url: SITE_URL_PATTERNS[siteId] });
    
    // If follow up, prefer tabs in current group
    if (isFollowUp && currentGroupId) {
      const groupedTab = existing.find(t => t.groupId === currentGroupId);
      if (groupedTab) return groupedTab;
    }
    
    if (existing[0]?.id !== undefined) {
      return existing[0];
    }
  }

  // Open a new tab
  const newTab = await chrome.tabs.create({ url: SITE_URLS[siteId], active: false });
  return newTab;
}

// ─────────────────────────────────────────────
// Content script readiness
// ─────────────────────────────────────────────

async function waitForContentScript(
  tabId: number,
  timeoutMs = 15_000,
  pollMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "PING" }) as ExtensionMessage;
      if (res && res.type === "PONG") {
        return true;
      }
    } catch (e) {
      // Ignore
    }
    await delay(pollMs);
  }
  return false;
}

// ─────────────────────────────────────────────
// Message sending with retry
// ─────────────────────────────────────────────

async function sendMessageWithRetry(
  tabId: number,
  message: ExtensionMessage,
  maxAttempts = 3,
  backoffMs = 500,
): Promise<unknown> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      await delay(backoffMs * attempt);
    }
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
