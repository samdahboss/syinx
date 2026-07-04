/**
 * entrypoints/claude.content.ts
 *
 * Content script for claude.ai
 */

import type { ExtensionMessage } from "@@/lib/messaging";
import { claudeAdapter } from "@@/lib/adapters/claude.adapter";

export default defineContentScript({
  matches: ["https://claude.ai/*"],
  runAt: "document_idle",

  main() {

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
            const el = await waitForElement(() => claudeAdapter.findInputElement(), 30_000);
            if (!el) throw new Error("Could not find Claude input element after waiting 30s");

            const priorCount = claudeAdapter.getPriorResponseCount();
            claudeAdapter.insertPrompt(el, msg.prompt);

            if (msg.autoSubmit) {
              // Small delay so the send button becomes enabled after state update
              await delay(300);
              claudeAdapter.submit(el);

              // Fire-and-forget: capture response asynchronously
              void (async () => {
                try {
                  const response = await claudeAdapter.waitForResponse(priorCount, 120_000);
                  chrome.runtime.sendMessage({
                    type: "RESPONSE_CAPTURED",
                    siteId: claudeAdapter.siteId,
                    response,
                    sessionId: msg.sessionId,
                  } satisfies ExtensionMessage);
                } catch (e) {
                  chrome.runtime.sendMessage({
                    type: "RESPONSE_CAPTURED",
                    siteId: claudeAdapter.siteId,
                    response: "",
                    sessionId: msg.sessionId,
                    error: e instanceof Error ? e.message : String(e),
                  } satisfies ExtensionMessage);
                }
              })();
            }

            success = true;
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            console.error("[Syinx] Claude injection failed:", error);
          }

          sendResponse({
            type: "INJECT_RESULT",
            siteId: "claude",
            success,
            error,
          });
        })();

        return true;
      },
    );
  },
});

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
