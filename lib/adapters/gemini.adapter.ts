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
const SEL_SEND_BUTTON = 'button[aria-label="Send message"]';

/** Fallback: mat-icon-button with a send icon near the input */
const SEL_SEND_BUTTON_FALLBACK = 'button.send-button';

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
    el.textContent = "";

    // Strategy 1: execCommand
    const inserted = document.execCommand("insertText", false, prompt);

    if (!inserted) {
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
      // Angular needs a 'keyup' event to register input changes
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
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
