/**
 * entrypoints/content/gemini.content.ts
 *
 * Content script for gemini.google.com
 *
 * Strategy: Gemini supports URL parameters (?q=prompt) which is more reliable
 * than DOM injection for this Angular-based site.
 *
 * When a INJECT_PROMPT message arrives:
 *   1. If the current URL is already /app (tab was already open at /app),
 *      we try DOM injection via geminiAdapter.
 *   2. If the tab was freshly opened to /app, the URL param was already set
 *      by the background (via SITE_URLS), so we just ensure the input gets filled.
 *
 * For autoSubmit=false: we pre-fill only, no submit.
 * For autoSubmit=true: we allow the page's natural submit behavior.
 */

import type { ExtensionMessage } from "@@/lib/messaging";
import { geminiAdapter } from "@@/lib/adapters/gemini.adapter";

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
  runAt: "document_idle",

  main() {
    // Announce readiness
    chrome.runtime.sendMessage({
      type: "CONTENT_SCRIPT_READY",
      siteId: "gemini",
    } satisfies ExtensionMessage);

    chrome.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse) => {
        const msg = message as ExtensionMessage;
        if (msg.type !== "INJECT_PROMPT") return false;

        void (async () => {
          let success = false;
          let error: string | undefined;

          try {
            // Try URL param approach first (most stable for Gemini)
            const encodedPrompt = encodeURIComponent(msg.prompt);
            const targetUrl = `https://gemini.google.com/app?q=${encodedPrompt}`;

            if (msg.autoSubmit) {
              // Navigate to the URL — Gemini will auto-submit the prompt
              window.location.href = targetUrl;
              // Wait briefly for navigation to kick off
              await delay(500);
              success = true;
            } else {
              // Pre-fill only: use DOM injection so user reviews before sending
              const el = await waitForElement(() => geminiAdapter.findInputElement(), 5000);
              if (!el) throw new Error("Could not find Gemini input element after waiting 5s");

              geminiAdapter.insertPrompt(el, msg.prompt);
              success = true;
            }
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            console.error("[PromptSync] Gemini injection failed:", error);
          }

          sendResponse({
            type: "INJECT_RESULT",
            siteId: "gemini",
            success,
            error,
          } satisfies ExtensionMessage);
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
