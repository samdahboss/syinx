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
    return document.querySelectorAll(RESPONSE_CONTAINER_SELECTOR).length;
  },

  async waitForResponse(priorCount: number, timeoutMs = 120_000, onGenerateStart?: () => void): Promise<string> {
    const deadline = Date.now() + timeoutMs;

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

    // Settle delay. Wait 1000ms for Claude to transition into the "generating" state
    await new Promise(r => setTimeout(r, 1000));

    // Wait for streaming to finish.
    // Claude follow-ups can have network latency before the streaming attribute appears.
    // We wait for the content to stabilize (no changes for 1.5s) AND have some content.
    let lastHtml = "";
    let stableCount = 0;

    await pollUntil(
      () => {
        const isStreaming = !!document.querySelector('[data-is-streaming="true"]');
        
        if (isStreaming) {
          stableCount = 0;
          return false;
        }
        
        const hasContent = container.innerText.trim().length > 0 || container.querySelectorAll('img, svg').length > 0;
        
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

    // Claude's actual response is inside .font-claude-message or .prose
    // We iterate backwards to find the last non-empty element
    const contentEls = container.querySelectorAll<HTMLElement>('.font-claude-message, .prose');
    for (let i = contentEls.length - 1; i >= 0; i--) {
      const el = contentEls[i].cloneNode(true) as HTMLElement;
      
      // Transform Claude Artifact cards into clean Syinx UI cards
      const allEls = Array.from(el.querySelectorAll('*'));
      let replacedCards = new Set<Element>();
      
      for (const node of allEls) {
        if (replacedCards.has(node) || replacedCards.has(node.parentElement!)) continue;
        
        let actionText = '';
        for (const child of Array.from(node.childNodes)) {
           if (child.nodeType === Node.TEXT_NODE) {
               const t = child.textContent?.trim() || '';
               if (t === 'Download' || t === 'Click to open' || t === 'Click to edit') {
                   actionText = t;
                   break;
               }
           }
        }
        
        if (actionText) {
          
          let card = node as HTMLElement | null;
          let levels = 0;
          while (card && card !== el && levels < 7) {
             const classes = card.classList.toString();
             const tag = card.tagName.toLowerCase();
             // Try to find the outermost card container
              if (classes.includes('border') || classes.includes('bg-') || tag === 'fieldset' || classes.includes('flex-col')) {
                 // Make sure it contains both title and action before breaking
                 if (card.textContent?.includes(actionText)) {
                     break;
                 }
             }
             card = card.parentElement;
             levels++;
          }
          
          if (!card || card === el) {
             card = node.parentElement?.parentElement || node.parentElement;
          }
          
          if (card && card !== el && !replacedCards.has(card)) {
             replacedCards.add(card);
             
             const texts = Array.from(card.querySelectorAll('*'))
               .map(e => {
                 let directText = '';
                 for (const child of Array.from(e.childNodes)) {
                   if (child.nodeType === Node.TEXT_NODE) {
                     directText += child.textContent;
                   }
                 }
                 return directText.trim();
               })
               .filter(t => t && t.length > 0 && t.length < 100 && t !== actionText);
               
             let title = texts[0] || "Artifact";
             let type = "Document";
             const typeCandidate = texts.find(t => t?.includes('•') || t?.includes('-') || t?.includes('Document') || t?.includes('Code'));
             if (typeCandidate) type = typeCandidate;
             else if (texts.length > 1) type = texts[1];
             
             const customCard = document.createElement('div');
             customCard.className = "my-4 p-4 rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between";
             customCard.innerHTML = `
               <div class="flex flex-col gap-1">
                 <span class="font-bold text-sm" style="color: inherit;">${title}</span>
                 <span class="text-xs text-black/50 dark:text-white/50 uppercase tracking-widest">${type}</span>
               </div>
               <a href="https://claude.ai" target="_blank" class="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-sm text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity" style="text-decoration: none;">
                 Open in Claude
               </a>
             `;
             card.replaceWith(customCard);
          }
        }
      }

      const html = el.innerHTML.trim();
      
      const outsideImgs = Array.from(container.querySelectorAll('img'))
        .filter(img => !contentEls[i].contains(img) && img.src && !img.src.includes('avatar') && !img.src.includes('favicon'));
        
      const imageHtml = outsideImgs.map(img => `<br/><img src="${img.src}" alt="${img.alt || 'Image'}" />`).join('');
      
      if (html || imageHtml) return imageHtml + html;
    }

    return container.innerHTML.trim();
  },
};
