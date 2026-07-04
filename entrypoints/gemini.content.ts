/**
 * entrypoints/gemini.content.ts
 *
 * Content script for gemini.google.com
 *
 * Strategy:
 *  - autoSubmit=true  → navigate to ?q=<encoded_prompt> (URL param, most stable)
 *  - autoSubmit=false → DOM injection (pre-fill without submitting)
 */

import type { ExtensionMessage } from "@@/lib/messaging";
import { geminiAdapter } from "@@/lib/adapters/gemini.adapter";

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
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
            const el = await waitForElement(() => geminiAdapter.findInputElement(), 30_000);
            if (!el) {
              throw new Error("Could not find Gemini input element after waiting 30s");
            }

            const priorCount = geminiAdapter.getPriorResponseCount();
            geminiAdapter.insertPrompt(el, msg.prompt);

            if (msg.autoSubmit) {
              // Small delay so the send button becomes enabled after state update
              await delay(300);
              geminiAdapter.submit(el);

              // Fire-and-forget: capture response asynchronously
              void (async () => {
                try {
                  const response = await geminiAdapter.waitForResponse(priorCount, 120_000, () => {
                    chrome.runtime.sendMessage({
                      type: "GENERATION_STARTED",
                      siteId: geminiAdapter.siteId,
                      sessionId: msg.sessionId,
                    } satisfies ExtensionMessage);
                  });
                  chrome.runtime.sendMessage({
                    type: "RESPONSE_CAPTURED",
                    siteId: geminiAdapter.siteId,
                    response,
                    sessionId: msg.sessionId,
                  } satisfies ExtensionMessage);
                } catch (e) {
                  chrome.runtime.sendMessage({
                    type: "RESPONSE_CAPTURED",
                    siteId: geminiAdapter.siteId,
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
            console.error("[Syinx] Gemini injection failed:", error);
          }

          sendResponse({
            type: "INJECT_RESULT",
            siteId: "gemini",
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
