/**
 * entrypoints/background.ts
 *
 * MV3 Service Worker — the orchestrator.
 */

import type { ExtensionMessage, SendPromptResponse, SiteId, SiteResult } from "@@/lib/messaging";
import { addHistoryEntry } from "@@/lib/history";
import { getSettings, addResponseToEntry } from "@@/lib/storage";

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
  // ── Open Options Page on Icon Click ──────────────────────────────────────
  chrome.action.onClicked.addListener(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  });

  // ── Keyboard Shortcut Commands ────────────────────────────────────────────
  chrome.commands.onCommand.addListener((command) => {
    const knownCommands = ["send-to-chatgpt", "send-to-claude", "send-to-gemini", "sync-prompts"] as const;
    type KnownCommand = typeof knownCommands[number];
    if (!knownCommands.includes(command as KnownCommand)) return;

    void (async () => {
      // Find an already-open options tab to forward the command to
      const optionsTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("options.html") });

      if (optionsTabs.length > 0 && optionsTabs[0].id !== undefined) {
        // Focus the options tab so the user sees what's happening
        const tab = optionsTabs[0];
        await chrome.tabs.update(tab.id!, { active: true });
        if (tab.windowId !== undefined) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        // Forward the command so the options page can fire the right targets
        void chrome.tabs.sendMessage(tab.id!, {
          type: "TRIGGER_COMMAND",
          command: command as KnownCommand,
        } satisfies ExtensionMessage);
      } else {
        // Options page not open — open it; user will need to type a prompt
        await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
      }
    })();
  });

  // ── Handle Messages ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      const msg = message as ExtensionMessage;

      if (msg.type === "RESPONSE_CAPTURED") {
        void (async () => {
          try {
            await addResponseToEntry(msg.sessionId, {
              siteId: msg.siteId,
              text: msg.response,
              capturedAt: Date.now(),
              error: msg.error,
            });
          } catch (e) {
            console.warn("[Syinx] Failed to save captured response:", e);
          }
          void chrome.runtime.sendMessage({
            type: "RESPONSE_UPDATE",
            siteId: msg.siteId,
            response: msg.response,
            sessionId: msg.sessionId,
            error: msg.error,
          } satisfies ExtensionMessage);
        })();
        return false;
      }

      if (msg.type === "GENERATION_STARTED") {
        void chrome.runtime.sendMessage(msg);
        return false;
      }

      // ── RETRY_PROMPT: retry a single failed site ──────────────────────────
      if (msg.type === "RETRY_PROMPT") {
        void (async () => {
          const settings = await getSettings();
          const result: SiteResult = { siteId: msg.siteId, status: "pending" };

          const notifyProgress = (results: SiteResult[]) => {
            void chrome.runtime.sendMessage({ type: "PROGRESS_UPDATE", results, sessionId: msg.sessionId } as ExtensionMessage);
          };

          notifyProgress([result]);

          try {
            const tab = await findOrOpenTab(msg.siteId, settings.useNewTabs, true);
            if (tab.id) {
              await chrome.tabs.update(tab.id, { active: true });
              const ready = await waitForContentScript(tab.id);
              if (!ready) {
                result.status = "error";
                result.error = "Content script not found. Please refresh.";
              } else {
                const injectResult = await sendMessageWithRetry(tab.id, {
                  type: "INJECT_PROMPT",
                  prompt: msg.prompt,
                  autoSubmit: msg.autoSubmit,
                  sessionId: msg.sessionId,
                });
                if (injectResult && typeof injectResult === "object" && "type" in injectResult && injectResult.type === "INJECT_RESULT") {
                  const r = injectResult as Extract<ExtensionMessage, { type: "INJECT_RESULT" }>;
                  result.status = r.success ? "success" : "error";
                  result.error = r.error;
                } else {
                  result.status = "error";
                  result.error = "Unexpected response from content script";
                }
              }
            } else {
              result.status = "error";
              result.error = "Failed to create or find tab";
            }
          } catch (e) {
            result.status = "error";
            result.error = e instanceof Error ? e.message : String(e);
          }

          notifyProgress([result]);
          sendResponse({ results: [result] });
        })();
        return true;
      }

      if (msg.type !== "SEND_PROMPT") return false;

      void (async () => {
        const settings = await getSettings();

        // 1. Persist to history
        try {
          await addHistoryEntry(msg.prompt, msg.targets, msg.sessionId);
        } catch (e) {
          console.warn("[Syinx] Failed to save history entry:", e);
        }

        const results: SiteResult[] = msg.targets.map(id => ({ siteId: id, status: "pending" }));
        const notifyProgress = () => {
          void chrome.runtime.sendMessage({ type: "PROGRESS_UPDATE", results, sessionId: msg.sessionId } as ExtensionMessage);
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
                  sessionId: msg.sessionId,
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
              await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]], groupId: currentGroupId });
            } else {
              currentGroupId = await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] });
              await chrome.tabGroups.update(currentGroupId, { title: "Syinx", color: "blue" });
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
      // "Receiving end does not exist" is expected while the tab/content script
      // is still loading — suppress it and keep polling.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Receiving end does not exist")) {
        console.warn("[Syinx] Unexpected ping error:", e);
      }
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
