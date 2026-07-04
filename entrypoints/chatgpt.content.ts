/**
 * entrypoints/chatgpt.content.ts
 *
 * Content script for chatgpt.com — injected automatically via manifest match patterns.
 *
 * Responsibilities:
 *  1. Send CONTENT_SCRIPT_READY handshake to background on load.
 *  2. Listen for INJECT_PROMPT messages and delegate to chatgptAdapter.
 *  3. Reply with INJECT_RESULT so the background can track per-site status.
 */

import type { ExtensionMessage } from "@@/lib/messaging";
import { chatgptAdapter } from "@@/lib/adapters/chatgpt.adapter";

export default defineContentScript({
  matches: ["https://chatgpt.com/*"],
  runAt: "document_idle",

  main() {
    // We use a stateless polling model from the background script now.
    // The background will ping us until we respond.

    // ── 2. Listen for INJECT_PROMPT ────────────────────────────────────────
    chrome.runtime.onMessage.addListener(
      (
        message: unknown,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: ExtensionMessage) => void,
      ) => {
        const msg = message as ExtensionMessage;

        if (msg.type === "PING") {
          sendResponse({ type: "PONG" });
          return false;
        }

        if (msg.type !== "INJECT_PROMPT") return false;

        void (async () => {
          let success = false;
          let error: string | undefined;

          try {
            // Wait up to 30s for the input element (slow connections may take longer)
            const el = await waitForElement(() => chatgptAdapter.findInputElement(), 30_000);

            if (!el) {
              throw new Error("Could not find ChatGPT input element after waiting 30s");
            }

            chatgptAdapter.insertPrompt(el, msg.prompt);

            if (msg.autoSubmit) {
              // Small delay so the send button becomes enabled after state update
              await delay(300);
              chatgptAdapter.submit(el);
            }

            success = true;
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            console.error("[PromptSync] ChatGPT injection failed:", error);
          }

          sendResponse({
            type: "INJECT_RESULT",
            siteId: "chatgpt",
            success,
            error,
          });
        })();

        // Return true to keep the message channel open for the async response
        return true;
      },
    );
  },
});

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/** Poll for an element up to `timeoutMs`. Resolves null on timeout. */
async function waitForElement(
  finder: () => HTMLElement | null,
  timeoutMs: number,
  pollIntervalMs = 200,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const el = finder();
    if (el) return el;
    await delay(pollIntervalMs);
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
