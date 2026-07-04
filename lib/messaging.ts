/**
 * lib/messaging.ts
 *
 * Typed message contracts shared across popup, background worker, and content scripts.
 * Every message flowing through chrome.runtime or chrome.tabs MUST use one of these types.
 * Never send raw untyped objects — always cast through ExtensionMessage.
 */

/** The three site IDs supported by Syinx v1. */
export type SiteId = "chatgpt" | "claude" | "gemini";

export type SiteStatus = "idle" | "pending" | "success" | "error";

export interface SiteResult {
  siteId: SiteId;
  status: SiteStatus;
  error?: string;
}

/**
 * Discriminated union of all messages in the system.
 *
 * SEND_PROMPT        popup/options/sidepanel → background
 * INJECT_PROMPT      background → content script
 * CONTENT_SCRIPT_READY  content script → background (handshake on load)
 * INJECT_RESULT      content script → background (result of injection)
 * PROGRESS_UPDATE    background → sidepanel
 */
export type ExtensionMessage =
  | {
    type: "SEND_PROMPT";
    prompt: string;
    targets: SiteId[];
    autoSubmit: boolean;
    isFollowUp: boolean;
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
  }
  | {
    type: "PROGRESS_UPDATE";
    results: SiteResult[];
  }
  | { type: "PING" }
  | { type: "PONG" }
  | { type: "RETRY_PROMPT"; siteId: SiteId; prompt: string; autoSubmit: boolean };

/**
 * Response shape the background sends back after a SEND_PROMPT.
 */
export interface SendPromptResponse {
  results: SiteResult[];
}

/**
 * Type-safe wrapper for chrome.runtime.sendMessage (popup/options → background).
 */
export function sendToBackground(
  message: Extract<ExtensionMessage, { type: "SEND_PROMPT" }>,
): Promise<SendPromptResponse> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return chrome.runtime.sendMessage(message) as Promise<SendPromptResponse>;
}
