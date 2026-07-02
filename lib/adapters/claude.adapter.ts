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
    el.textContent = "";

    // Strategy 1: execCommand
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted: boolean = (document as any).execCommand("insertText", false, prompt) as boolean;

    if (!inserted) {
      // Strategy 2: set content + dispatch InputEvent
      el.textContent = prompt;

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);

      el.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: prompt,
        }),
      );
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
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
};
