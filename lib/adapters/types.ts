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
}
