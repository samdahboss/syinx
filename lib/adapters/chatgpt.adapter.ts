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

  getPriorResponseCount(): number {
    return document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR).length;
  },

  async waitForResponse(priorCount: number, timeoutMs = 120_000, onGenerateStart?: () => void): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    // Step 1: Wait for a new response container to appear.
    // The number of assistant messages should increase by 1.
    const container = await pollUntil(
      () => {
        const containers = document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR);
        if (containers.length > priorCount) {
          return containers[containers.length - 1] as HTMLElement;
        }
        return null;
      },
      deadline,
      500,
    );
    if (!container) throw new Error("No response appeared");

    // Signal that generation has started
    onGenerateStart?.();

    // Step 2: Settle delay. Wait 1000ms for ChatGPT to mount the streaming stop button mount
    await new Promise((r) => setTimeout(r, 1000));

    // Step 3: Wait until streaming is done.
    // ChatGPT follow-ups can have network latency before the stop button appears.
    // We wait for the content to stabilize (no changes for 1.5s) AND have some content.
    let lastHtml = "";
    let stableCount = 0;

    await pollUntil(
      () => {
        const stopBtn = document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop generating"]');
        const isStreaming = !!container.querySelector('.result-streaming');
        
        if (stopBtn || isStreaming) {
          stableCount = 0;
          return false;
        }
        
        const hasContent = container.innerText.trim().length > 0 || container.querySelectorAll('img').length > 0;
        
        if (hasContent) {
          const currentHtml = container.innerHTML;
          if (currentHtml === lastHtml) {
            stableCount++;
          } else {
            lastHtml = currentHtml;
            stableCount = 0;
          }
        } else {
          stableCount = 0;
        }
        
        return stableCount >= 3;
      },
      deadline,
      500,
    );

    // Step 4: Extract text. Use innerText for natural whitespace.
    // ChatGPT's actual markdown is inside .markdown.prose
    // We iterate backwards to find the last non-empty element
    const contentEls = container.querySelectorAll<HTMLElement>('.markdown.prose, .prose');
    for (let i = contentEls.length - 1; i >= 0; i--) {
      const el = contentEls[i];
      const html = el.innerHTML.trim();
      
      const outsideImgs = Array.from(container.querySelectorAll('img'))
        .filter(img => !el.contains(img) && img.src && !img.src.includes('avatar') && !img.src.includes('favicon'));
        
      const imageHtml = outsideImgs.map(img => `<br/><img src="${img.src}" alt="${img.alt || 'Image'}" />`).join('');
      
      if (html || imageHtml) return imageHtml + html;
    }

    return container.innerHTML.trim();
  },
};
