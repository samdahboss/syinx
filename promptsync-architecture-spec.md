# Syinx — Technical Specification & Build Plan

> Working name: **Syinx** (rename freely). This document is written to be handed directly to a coding agent to scaffold and build the project. It specifies scope, architecture, file structure, and build order in enough detail that no additional product decisions should be needed to get a working v1.

---

## 1. Problem Statement

Users who regularly consult multiple AI chat products (ChatGPT, Claude, Gemini) keep them open in separate browser tabs and manually copy-paste the same prompt into each one, losing time and context on every comparison.

An existing product, **ChatHub**, solves a version of this but has documented user complaints (from Chrome Web Store reviews):

- Free tier limited to 2 models and capped queries; full functionality requires a $19–39/month subscription.
- Model integrations (DeepSeek, Gemini, Perplexity) reported as breaking periodically.
- Requires either a paid backend relay or the user's own API keys for many models.
- Membership/session has to be re-activated when switching browsers.

**Syinx's differentiation:** a free, open-source extension that syncs a single prompt into the user's _already-authenticated_ native web tabs (chatgpt.com, claude.ai, gemini.google.com) — no API keys, no backend relay, no subscription, no data ever leaving the browser. It rides the user's existing logged-in sessions rather than proxying through a paid service.

---

## 2. Goals (v1 scope)

1. User opens the extension popup/sidebar, types one prompt.
2. User selects which target sites to send it to (checkboxes: ChatGPT, Claude, Gemini — all pre-checked by default).
3. Clicking "Send" opens/focuses a tab for each selected site (if not already open), injects the prompt into that site's input box, and submits it.
4. Local prompt history (last N prompts) stored in `chrome.storage.local`, viewable and re-sendable from the popup.
5. Zero network calls initiated by the extension itself — it never talks to a server. All it does is manipulate the DOM of tabs the user already controls.
6. Works entirely client-side; no build-time secrets, no user accounts, no telemetry.

## 3. Non-Goals (explicitly out of scope for v1)

- Reading/scraping the AI responses back into a unified comparison view (this is a stretch goal for v2 — it's what makes ChatHub's UX good but also what breaks most often when sites change their DOM, so ship without it first).
- Support for any model beyond ChatGPT, Claude, Gemini in v1.
- Any form of user accounts, cloud sync, or analytics.
- Mobile browser support.

## 4. User Stories

- As a user, I want to type one prompt and have it appear (and auto-submit) in ChatGPT, Claude, and Gemini tabs without touching each tab myself.
- As a user, I want to see my last 20 prompts and re-send any of them with one click.
- As a user, I want to be able to disable auto-submit and just have the prompt pre-filled, in case I want to review it first (settings toggle).
- As a user, I want to add/remove which sites are targeted without editing code.

---

## 5. High-Level Architecture

```
┌─────────────────────────┐
│   Popup / Side Panel UI │  (React) — prompt input, site toggles, history list
└────────────┬─────────────┘
             │ chrome.runtime.sendMessage
             ▼
┌─────────────────────────┐
│  Background Service      │  (MV3 service worker)
│  Worker (orchestrator)   │  - receives "send prompt" request
│                           │  - for each target site:
│                           │      finds or opens a tab
│                           │      sends message to that tab's content script
│                           │  - writes prompt to chrome.storage.local (history)
└────────────┬─────────────┘
             │ chrome.tabs.sendMessage (per tab)
             ▼
┌─────────────────────────┐
│  Content Script          │  One per site, injected via manifest match patterns.
│  (site adapter)          │  - finds the site's input element
│                           │  - inserts prompt text
│                           │  - triggers submit (Enter / click send button)
└─────────────────────────┘
```

No backend server exists anywhere in this system. The service worker is purely an in-browser message router — it does not call any external API.

---

## 6. Tech Stack

| Layer               | Choice                                                                                                                                               | Why                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Extension framework | **WXT** (`wxt.dev`)                                                                                                                                  | Handles MV3 manifest generation, HMR during dev, and packaging. Far less boilerplate than hand-rolled MV3. |
| UI                  | **React + TypeScript**                                                                                                                               | Matches existing skill set; WXT has first-class React support.                                             |
| Styling             | **Tailwind CSS**                                                                                                                                     | Fast to build a clean popup UI.                                                                            |
| Storage             | `chrome.storage.local` (via WXT's `storage` utility)                                                                                                 | No backend; all data stays on-device.                                                                      |
| Messaging           | `chrome.runtime` / `chrome.tabs` message passing                                                                                                     | Standard MV3 pattern, no external libraries needed.                                                        |
| Testing             | **Vitest** for unit tests on adapter logic; manual QA checklist for DOM injection (DOM structure of third-party sites can't be reliably unit-tested) |                                                                                                            |
| Linting/formatting  | ESLint + Prettier                                                                                                                                    | Standard, keeps the open-source repo clean for contributors.                                               |

Verify current WXT CLI flags against `wxt.dev` docs before running — framework tooling changes over time and I can't guarantee the exact command syntax below is current.

---

## 7. Project Structure

```
Syinx/
├── .github/
│   └── workflows/
│       └── ci.yml                 # lint + typecheck + unit tests on PR
├── public/
│   └── icon/
│       ├── 16.png
│       ├── 48.png
│       └── 128.png
├── entrypoints/
│   ├── background.ts               # service worker (orchestrator)
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.html
│   │   └── components/
│   │       ├── PromptInput.tsx
│   │       ├── SiteToggleList.tsx
│   │       ├── HistoryList.tsx
│   │       └── SettingsPanel.tsx
│   └── content/
│       ├── chatgpt.content.ts      # match: chatgpt.com/*
│       ├── claude.content.ts       # match: claude.ai/*
│       └── gemini.content.ts       # match: gemini.google.com/*
├── lib/
│   ├── adapters/
│   │   ├── types.ts                # SiteAdapter interface
│   │   ├── chatgpt.adapter.ts
│   │   ├── claude.adapter.ts
│   │   └── gemini.adapter.ts
│   ├── messaging.ts                # typed message contracts between popup/background/content
│   ├── storage.ts                  # typed wrapper around chrome.storage.local
│   └── history.ts                  # prompt history CRUD
├── tests/
│   └── adapters/*.test.ts
├── wxt.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── LICENSE                         # MIT or GPL-3.0 (pick MIT for max adoption/reuse)
├── README.md
├── CONTRIBUTING.md
└── PRIVACY.md                      # required for Chrome Web Store listing
```

---

## 8. Manifest Configuration (via `wxt.config.ts`)

Key manifest fields WXT should generate:

```ts
export default defineConfig({
  manifest: {
    name: "Syinx",
    description:
      "Send one prompt to ChatGPT, Claude, and Gemini at once — free, open-source, no API keys, nothing leaves your browser.",
    permissions: ["storage", "tabs"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
    ],
    action: {
      default_popup: "popup/index.html",
    },
  },
});
```

Notes:

- `host_permissions` is the minimal set — do not request `<all_urls>`. This matters both for review approval speed and for the "we only touch what we say we touch" privacy pitch.
- No `activeTab`-only approach here, because the extension needs to act on tabs the user hasn't necessarily clicked into (opening/focusing a ChatGPT tab from the popup) — hence explicit host permissions instead.

---

## 9. Core Components in Detail

### 9.1 Background Service Worker (`entrypoints/background.ts`)

Responsibilities:

1. Listen for a `SEND_PROMPT` message from the popup containing `{ prompt: string, targets: SiteId[] }`.
2. For each target site:
   - Query open tabs matching that site's URL pattern (`chrome.tabs.query`).
   - If a matching tab exists, focus it (`chrome.tabs.update({ active: true })`).
   - If none exists, open one (`chrome.tabs.create`) and wait for `tabs.onUpdated` status `complete` before proceeding.
   - Send an `INJECT_PROMPT` message to that tab's content script via `chrome.tabs.sendMessage`, containing `{ prompt, autoSubmit: boolean }`.
3. Write the prompt (with timestamp and target list) to history via `lib/history.ts`.
4. Return a result summary to the popup (which targets succeeded/failed) so the UI can show status per site.

Edge case to handle explicitly: if a newly-opened tab's content script isn't ready yet when the message is sent, the message will silently fail. Use a retry-with-backoff (e.g., 3 attempts, 500ms apart) or listen for an explicit `CONTENT_SCRIPT_READY` handshake message sent from each content script on load.

### 9.2 Content Scripts / Site Adapters

Each site gets its own content script entrypoint (WXT supports per-match-pattern entrypoints) that:

1. On load, sends `CONTENT_SCRIPT_READY` to the background worker.
2. Listens for `INJECT_PROMPT` messages.
3. Delegates the actual DOM manipulation to a shared adapter module (`lib/adapters/*.adapter.ts`) implementing a common interface — this keeps the "find the input box and submit" logic testable and separated from the messaging plumbing.

**`lib/adapters/types.ts`:**

```ts
export interface SiteAdapter {
  siteId: "chatgpt" | "claude" | "gemini";
  /** Locates the prompt input element on the current page. Returns null if not found. */
  findInputElement(): HTMLElement | null;
  /** Inserts text into the input element in a way the site's framework recognizes (see note below). */
  insertPrompt(el: HTMLElement, prompt: string): void;
  /** Triggers submission — either simulates Enter or clicks the send button. */
  submit(el: HTMLElement): void;
}
```

**Important implementation note for the agent:** ChatGPT, Claude, and Gemini all use React/rich-text-editor-style input fields (often `contenteditable` divs, not plain `<textarea>`), so naively setting `.value` or `.innerText` will not update the site's internal framework state, and the send button will stay disabled. The reliable pattern is:

1. Focus the element.
2. Use the native `execCommand('insertText', ...)` approach, or dispatch a proper `InputEvent` (`new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt })`) after setting the content, so React's synthetic event system picks up the change.
3. As a fallback, simulate individual `keydown`/`keypress`/`keyup` events per character if the InputEvent approach doesn't register (slower but more robust against frameworks that specifically listen for real keystrokes).

**Selectors will need live verification and ongoing maintenance** — these three sites change their DOM/class names periodically, which is the single biggest maintenance burden of this category of extension (visible in ChatHub's own review complaints). Do not hardcode brittle auto-generated class names (e.g., `css-1x2y3z`) if a stable `data-testid`, `aria-label`, `role`, or `contenteditable` attribute is available instead — inspect the live page first and prefer the most semantically stable selector. Structure each adapter so the selector strings are isolated at the top of the file as named constants, making them a one-line fix when a site changes its markup — this is the main thing outside contributors will patch, so it should be the easiest part of the codebase to touch.

### 9.3 Popup UI (`entrypoints/popup/`)

Components:

- **`PromptInput.tsx`** — textarea + "Send" button.
- **`SiteToggleList.tsx`** — checkbox per site (ChatGPT / Claude / Gemini), persisted to storage as default selection.
- **`HistoryList.tsx`** — last 20 prompts from storage, each with a "resend" button and timestamp.
- **`SettingsPanel.tsx`** — toggle for "auto-submit" vs "just fill the box and let me press Enter myself."

State management: plain React `useState`/`useEffect` is sufficient at this scope — no need for Redux/Zustand.

### 9.4 Storage Schema (`lib/storage.ts`, `lib/history.ts`)

```ts
interface PromptHistoryEntry {
  id: string; // uuid
  prompt: string;
  targets: SiteId[];
  timestamp: number;
}

interface Settings {
  defaultTargets: SiteId[];
  autoSubmit: boolean;
}
```

Stored under two keys in `chrome.storage.local`: `history: PromptHistoryEntry[]` (capped at 50 entries, oldest evicted first) and `settings: Settings`.

---

## 10. Message Contracts (`lib/messaging.ts`)

Define every message type as a discriminated union so popup/background/content scripts share one typed contract:

```ts
type ExtensionMessage =
  | { type: "SEND_PROMPT"; prompt: string; targets: SiteId[] }
  | { type: "INJECT_PROMPT"; prompt: string; autoSubmit: boolean }
  | { type: "CONTENT_SCRIPT_READY"; siteId: SiteId }
  | { type: "INJECT_RESULT"; siteId: SiteId; success: boolean; error?: string };
```

---

## 11. Permissions Justification (for Chrome Web Store review)

| Permission                   | Justification to write in the listing                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                    | Store prompt history and settings locally on the user's device; never transmitted anywhere.                                                                                                                        |
| `tabs`                       | Detect whether a ChatGPT/Claude/Gemini tab is already open, and switch to or open one, when the user sends a prompt.                                                                                               |
| `host_permissions` (3 sites) | Required to insert the user's typed prompt into that site's own input box on the user's behalf. No data from these pages is read, stored, or transmitted — the extension only writes the prompt text it was given. |

---

## 12. Build Order for the Agent

1. Scaffold with WXT (`npx wxt@latest init Syinx` — choose the React template; verify current flags in WXT docs since CLI options change).
2. Set up Tailwind, ESLint, Prettier, TypeScript strict mode.
3. Build `lib/messaging.ts` types first — everything else depends on this contract.
4. Build `lib/storage.ts` + `lib/history.ts` with unit tests.
5. Build one adapter end-to-end first (recommend ChatGPT, likely the most stable/documented DOM) — get prompt injection + submit working manually before generalizing.
6. Build the background service worker orchestration logic against that one adapter.
7. Build the popup UI wired to the single adapter, confirm the full loop works.
8. Add Claude and Gemini adapters following the same pattern.
9. Add settings panel + history UI polish.
10. Write README, CONTRIBUTING, PRIVACY.md, pick a LICENSE.
11. Manual QA pass across all three sites (this category of project cannot be fully automated-tested because it depends on live third-party DOMs).
12. Package and submit to Chrome Web Store (see prior conversation for submission steps: dev account $5 fee, zip build output, store listing assets, privacy policy URL, permission justifications, submit for review).

---

## 13. Known Risks & Constraints (document these in the README for credibility)

- **DOM fragility**: the three target sites can change their markup at any time, breaking an adapter with no warning. Mitigate with isolated, well-commented selector constants and a GitHub issue template specifically for "adapter broke" reports.
- **ToS gray area**: automating text entry/submission on a site's own web UI (rather than using an official API) is common practice among this category of tool but isn't officially sanctioned by OpenAI/Anthropic/Google. Worth a line in the README under "how this works" for transparency.
- **Not a response-comparison tool (yet)**: v1 only sends the prompt; it doesn't pull the answers back into one view. Set that expectation clearly in the store listing so reviews don't ding it for something out of scope.

---

## 14. Suggested README structure (for the open-source repo)

1. What it does (one paragraph + GIF demo)
2. Why (the ChatHub free-tier/reliability complaints, cited)
3. Install (Chrome Web Store link once published, or "load unpacked" for dev)
4. How it works (brief architecture summary, link to this spec)
5. Contributing (especially: how to fix a broken adapter when a site changes its DOM)
6. Privacy (link to PRIVACY.md — no data leaves the browser, no accounts, no analytics)
7. License
