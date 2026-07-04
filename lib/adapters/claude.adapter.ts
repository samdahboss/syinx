/**
 * lib/adapters/claude.adapter.ts
 *
 * DOM adapter for claude.ai.
 *
 * ⚠️  SELECTOR MAINTENANCE NOTICE
 * ──────────────────────────────────────────────────────────────────────────────
 * Claude updates its markup. All selectors are isolated as named constants below.
 *
 * Last verified: 2026-07-02 (research-derived — verify in DevTools before QA)
 * Selector strategy: Claude uses a Lexical/ProseMirror-based contenteditable div.
 *   - The prompt box is a contenteditable div, usually with a data-placeholder attr.
 *   - The send button has an aria-label containing "Send".
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { SiteAdapter } from "./types";
import { pollUntil } from "./types";

// ─────────────────────────────────────────────
// 🔧 SELECTOR CONSTANTS — edit here when Claude changes their DOM
// ─────────────────────────────────────────────

/** Primary: the rich text editor div with contenteditable in the composer */
const SEL_INPUT = 'div[contenteditable="true"][data-placeholder]';

/** Fallback: any contenteditable div inside the main form area */
const SEL_INPUT_FALLBACK = 'div[contenteditable="true"]';

/** Send button — aria-label is the most stable hook on Claude */
const SEL_SEND_BUTTON = 'button[aria-label="Send message"]';

/** Fallback: button containing an SVG paper-plane icon near the composer */
const SEL_SEND_BUTTON_FALLBACK = 'button[type="submit"]';

const RESPONSE_CONTAINER_SELECTOR = '[data-is-streaming]';

// ─────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────

export const claudeAdapter: SiteAdapter = {
  siteId: "claude",

  findInputElement(): HTMLElement | null {
    let el = document.querySelector<HTMLElement>(SEL_INPUT);
    if (el) return el;

    // Fallback: pick the last contenteditable (usually the composer, not page headers)
    const all = document.querySelectorAll<HTMLElement>(SEL_INPUT_FALLBACK);
    return all.length > 0 ? all[all.length - 1] : null;
  },

  insertPrompt(el: HTMLElement, prompt: string): void {
    el.focus();

    // Select all existing content so the paste overwrites it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand("selectAll", false, null);

    // Modern SPAs (React/ProseMirror) break if you manually modify textContent.
    // The most robust way to inject text is to simulate a paste event.
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", prompt);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });

    const handled = el.dispatchEvent(pasteEvent);

    // If the site didn't natively handle the paste event (preventDefault), fallback
    if (handled) {
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
    const sendBtn =
      document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON) ??
      document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON_FALLBACK);

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return;
    }

    // Fallback: Enter keypress
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
    );
  },

  getPriorResponseCount(): number {
    return 0; // Claude waits for [data-is-streaming] which only appears for the new response, so priorCount isn't strictly needed.
  },

  async waitForResponse(priorCount: number, timeoutMs = 120_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    // Wait for a response element to appear
    const container = await pollUntil(
      () => {
        const el = document.querySelector(RESPONSE_CONTAINER_SELECTOR);
        return el as HTMLElement | null;
      },
      deadline,
      300,
    );
    if (!container) throw new Error("No response appeared");

    // Wait for streaming to finish (attribute is removed)
    await pollUntil(
      () => !document.querySelector('[data-is-streaming="true"]'),
      deadline,
      500,
    );

    return container.innerText.trim();
  },
};
