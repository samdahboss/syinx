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
import { pollUntil } from "./types";

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

const RESPONSE_CONTAINER_SELECTOR = '[data-message-author-role="assistant"]';
const STREAMING_STOP_SELECTOR = 'button[data-testid="stop-button"]';

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

  async waitForResponse(timeoutMs = 120_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    // Step 1: Wait until at least one assistant message container appears.
    const container = await pollUntil(
      () => {
        const all = document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR);
        return all.length > 0 ? (all[all.length - 1] as HTMLElement) : null;
      },
      deadline,
      300,
    );
    if (!container) throw new Error("No response container appeared");

    // Step 2: Wait until streaming is done (stop button disappears).
    await pollUntil(
      () => !document.querySelector(STREAMING_STOP_SELECTOR),
      deadline,
      500,
    );

    // Step 3: Extract text. Use innerText for natural whitespace.
    return container.innerText.trim();
  },
};
