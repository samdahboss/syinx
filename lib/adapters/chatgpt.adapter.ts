/**
 * lib/adapters/chatgpt.adapter.ts
 *
 * DOM adapter for chatgpt.com.
 *
 * ⚠️  SELECTOR MAINTENANCE NOTICE
 * ──────────────────────────────────────────────────────────────────────────────
 * ChatGPT updates its markup frequently. All selectors are isolated as named
 * constants below — when a site update breaks the adapter, contributors only
 * need to update these constants, not hunt through logic.
 *
 * Last verified: 2026-07-02
 * Selector strategy: prefer aria-label / role / data-testid over class names.
 *   - The prompt box is a contenteditable div with role="textbox".
 *     It lives inside a form; there is typically one per page.
 *   - The send button has data-testid="send-button".
 *
 * If the send button selector breaks, fall back to dispatching Enter on the input.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { SiteAdapter } from "./types";

// ─────────────────────────────────────────────
// 🔧 SELECTOR CONSTANTS — edit here when ChatGPT changes their DOM
// ─────────────────────────────────────────────

/** The contenteditable prompt textarea. Role="textbox" is the most stable hook. */
const SEL_INPUT = 'div[contenteditable="true"][role="textbox"]';

/**
 * Fallback input selector — used if the role attribute is absent.
 * Targets the first contenteditable inside the composer form area.
 */
const SEL_INPUT_FALLBACK = "#prompt-textarea";

/** The send button. data-testid is stable across most ChatGPT UI refreshes. */
const SEL_SEND_BUTTON = 'button[data-testid="send-button"]';

/** Fallback send button — aria-label tends to survive minor UI refactors. */
const SEL_SEND_BUTTON_FALLBACK = 'button[aria-label="Send prompt"]';

// ─────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────

export const chatgptAdapter: SiteAdapter = {
  siteId: "chatgpt",

  findInputElement(): HTMLElement | null {
    // Try preferred selector first
    let el = document.querySelector<HTMLElement>(SEL_INPUT);
    if (el) return el;

    // Fallback: the legacy #prompt-textarea (older ChatGPT used a <textarea>)
    el = document.querySelector<HTMLElement>(SEL_INPUT_FALLBACK);
    return el;
  },

  insertPrompt(el: HTMLElement, prompt: string): void {
    // Focus the element first — required for React to register the change
    el.focus();

    // Clear any existing content
    el.textContent = "";

    // Strategy 1: execCommand (deprecated but still the most reliable for contenteditable + React)
    // We use a type assertion to silence the TS deprecation warning.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted: boolean = (document as any).execCommand("insertText", false, prompt) as boolean;

    if (!inserted) {
      // Strategy 2: Manually set textContent + dispatch InputEvent
      el.textContent = prompt;

      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Dispatch events so React's state picks up the change
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: prompt }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  },

  submit(el: HTMLElement): void {
    // Try clicking the send button first
    const sendBtn =
      document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON) ??
      document.querySelector<HTMLButtonElement>(SEL_SEND_BUTTON_FALLBACK);

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return;
    }

    // Fallback: simulate Enter keypress on the input element
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  },
};
