/**
 * lib/messaging.ts
 *
 * Typed message contracts shared across popup, background worker, and content scripts.
 * Every message flowing through chrome.runtime or chrome.tabs MUST use one of these types.
 * Never send raw untyped objects — always cast through ExtensionMessage.
 */

/** The three site IDs supported by PromptSync v1. */
export type SiteId = "chatgpt" | "claude" | "gemini";

/**
 * Discriminated union of all messages in the system.
 *
 * SEND_PROMPT        popup → background
 * INJECT_PROMPT      background → content script
 * CONTENT_SCRIPT_READY  content script → background (handshake on load)
 * INJECT_RESULT      content script → background (result of injection)
 */
export type ExtensionMessage =
  | {
      type: "SEND_PROMPT";
      prompt: string;
      targets: SiteId[];
      autoSubmit: boolean;
    }
  | {
      type: "INJECT_PROMPT";
      prompt: string;
      autoSubmit: boolean;
    }
  | {
      type: "CONTENT_SCRIPT_READY";
      siteId: SiteId;
    }
  | {
      type: "INJECT_RESULT";
      siteId: SiteId;
      success: boolean;
      error?: string;
    };

/**
 * Response shape the background sends back to the popup after a SEND_PROMPT.
 */
export interface SendPromptResponse {
  results: Array<{
    siteId: SiteId;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Type-safe wrapper for chrome.runtime.sendMessage (popup → background).
 * Chrome's types don't provide generic overloads on sendMessage,
 * so we cast the Promise return value instead.
 */
export function sendToBackground(
  message: Extract<ExtensionMessage, { type: "SEND_PROMPT" }>,
): Promise<SendPromptResponse> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return chrome.runtime.sendMessage(message) as Promise<SendPromptResponse>;
}
