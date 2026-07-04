/**
 * lib/adapters/gemini.adapter.ts
 *
 * DOM adapter for gemini.google.com.
 *
 * ⚠️  SELECTOR MAINTENANCE NOTICE
 * ──────────────────────────────────────────────────────────────────────────────
 * Gemini is Angular-based and updates its markup frequently.
 * All selectors are isolated as named constants below.
 *
 * STRATEGY (approved in implementation plan):
 *   PRIMARY  — URL navigation: gemini.google.com/app?q=<encoded>
 *              This is officially supported by Google and most stable.
 *              When autoSubmit=true, the URL param triggers auto-send.
 *              When autoSubmit=false, we use ?q= without auto-submit (fills box).
 *
 *   FALLBACK — DOM injection into the contenteditable rich-textarea,
 *              used when the page is already at /app (tab already open).
 *
 * Last verified: 2026-07-02 (research-derived — verify in DevTools before QA)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { SiteAdapter } from "./types";
import { pollUntil } from "./types";

// ─────────────────────────────────────────────
// 🔧 SELECTOR CONSTANTS — edit here when Gemini changes their DOM
// ─────────────────────────────────────────────

/** Gemini's custom Angular element wrapping the rich text input */
const SEL_RICH_TEXTAREA = "rich-textarea";

/** contenteditable div inside rich-textarea */
const SEL_INPUT = `${SEL_RICH_TEXTAREA} div[contenteditable="true"]`;

/** Fallback: any contenteditable on the page */
const SEL_INPUT_FALLBACK = 'div[contenteditable="true"]';

/** Send button aria-label */
const SEL_SEND_BUTTON = 'button[aria-label*="Send"]';

/** Fallback: mat-icon-button with a send icon near the input */
const SEL_SEND_BUTTON_FALLBACK = 'button.send-button';

const RESPONSE_CONTAINER_SELECTOR = 'model-response';
const STREAMING_INDICATOR_SELECTOR = '.loading-indicator';

// ─────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────

export const geminiAdapter: SiteAdapter = {
  siteId: "gemini",

  findInputElement(): HTMLElement | null {
    let el = document.querySelector<HTMLElement>(SEL_INPUT);
    if (el) return el;

    el = document.querySelector<HTMLElement>(SEL_RICH_TEXTAREA);
    if (el) return el;

    const all = document.querySelectorAll<HTMLElement>(SEL_INPUT_FALLBACK);
    return all.length > 0 ? all[all.length - 1] : null;
  },

  insertPrompt(el: HTMLElement, prompt: string): void {
    el.focus();

    // Select all existing content so the paste overwrites it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand("selectAll", false, null);

    // Modern SPAs (Angular) break if you manually modify textContent.
    // The most robust way to inject text is to simulate a paste event.
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", prompt);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });

    // dispatchEvent returns false if the event was cancelled (i.e. handled by Gemini's
    // paste handler). If it returns true, Gemini did NOT handle it, so we fall back.
    const nativelyHandled = !el.dispatchEvent(pasteEvent);

    if (!nativelyHandled) {
      // Gemini ignored the paste — fall back to execCommand / textContent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inserted = (document as any).execCommand("insertText", false, prompt) as boolean;
      if (!inserted) {
        el.textContent = prompt;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: prompt }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // Collapse selection to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  },

  submit(el: HTMLElement): void {
    // Poll for the send button to become enabled — Gemini (Angular) needs a tick
    // or two to run change detection after the input event before enabling the button.
    const maxWaitMs = 3_000;
    const pollMs = 100;
    const deadline = Date.now() + maxWaitMs;

    const trySubmit = () => {
      const sendBtn =
        document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON) ??
        document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON_FALLBACK);

      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        return;
      }

      if (Date.now() < deadline) {
        setTimeout(trySubmit, pollMs);
        return;
      }

      // Timed out — last resort: Enter keypress
      console.warn("[Syinx] Gemini send button not ready after polling, trying Enter keypress");
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
      );
      el.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
      );
    };

    trySubmit();
  },

  getPriorResponseCount(): number {
    return document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR).length;
  },

  async waitForResponse(priorCount: number, timeoutMs = 120_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    const container = await pollUntil(
      () => {
        const all = document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR);
        return all.length > priorCount ? (all[all.length - 1] as HTMLElement) : null;
      },
      deadline,
      300,
    );
    if (!container) throw new Error("No response appeared");

    await pollUntil(
      () => !document.querySelector(STREAMING_INDICATOR_SELECTOR),
      deadline,
      500,
    );

    // Extract text specifically from .message-content to avoid "Searching the web" placeholders
    const messageContent = container.querySelector('.message-content') as HTMLElement;
    return (messageContent || container).innerText.trim();
  },
};
