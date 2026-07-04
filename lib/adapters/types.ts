/**
 * lib/adapters/types.ts
 *
 * The SiteAdapter interface that every site adapter must implement.
 * Keeping the interface here lets adapters be independently testable and
 * makes it easy for contributors to add new sites.
 */

export interface SiteAdapter {
  siteId: "chatgpt" | "claude" | "gemini";

  /**
   * Locates the prompt input element on the current page.
   * Returns null if the element is not yet in the DOM (e.g. page still loading).
   */
  findInputElement(): HTMLElement | null;

  /**
   * Inserts text into the input element in a way the site's framework recognises.
   *
   * NOTE: All three targets use contenteditable divs (not plain <textarea>),
   * so naive .value assignment or .innerText = "..." won't update React/Angular state.
   * Each adapter must dispatch the appropriate synthetic events after mutating the DOM.
   */
  insertPrompt(el: HTMLElement, prompt: string): void;

  /**
   * Triggers form submission — either simulates Enter or clicks the send button.
   * Called only when autoSubmit = true.
   */
  submit(el: HTMLElement): void;

  /**
   * Waits for the AI response to complete streaming and returns the full text.
   *
   * Implementation contract:
   *   1. Poll or use MutationObserver to detect when the response element appears.
   *   2. Detect streaming completion (stop-indicator disappears, or text stabilises).
   *   3. Resolve with the final plain-text response content.
   *   4. Reject with an Error after `timeoutMs` milliseconds if no response appears.
   *
   * @param timeoutMs  Maximum wait time in ms. Default: 120_000 (2 minutes).
   */
  waitForResponse(timeoutMs?: number): Promise<string>;
}

/**
 * Repeatedly calls `predicate` until it returns a truthy value or the deadline passes.
 * Returns the truthy value, or null on timeout.
 */
export async function pollUntil<T>(
  predicate: () => T | null | undefined | false,
  deadlineMs: number,
  intervalMs = 300,
): Promise<T | null> {
  while (Date.now() < deadlineMs) {
    const result = predicate();
    if (result) return result;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  return null;
}
