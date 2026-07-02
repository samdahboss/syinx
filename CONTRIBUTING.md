# Contributing to PromptSync

Thank you for helping keep PromptSync working!

## The Most Needed Contribution: Fixing a Broken Adapter

ChatGPT, Claude, and Gemini update their UI regularly. When they do, the adapter for that site breaks. Here's how to fix it in under 10 minutes:

### 1. Open the site in Chrome DevTools
Press F12, go to the **Elements** tab, and find the prompt input box.

### 2. Find a stable selector
Prefer (in order of stability):
- `aria-label` attributes
- `data-testid` attributes
- `role` attributes (`role="textbox"`)
- Element type + `contenteditable="true"`
- **Never** use auto-generated class names like `css-abc123`

### 3. Edit the selector constant

Each adapter has selector constants at the very top of its file — that's the only place you need to change:

| Site | Adapter file |
|---|---|
| ChatGPT | `lib/adapters/chatgpt.adapter.ts` |
| Claude | `lib/adapters/claude.adapter.ts` |
| Gemini | `lib/adapters/gemini.adapter.ts` |

Look for the `SEL_INPUT` and `SEL_SEND_BUTTON` constants at the top.

### 4. Test it
Load the extension unpacked and try sending a prompt to the affected site.

### 5. Submit a PR
Include:
- Which selector broke
- What the new selector is
- How you verified it (screenshot of DevTools welcome)

## Development Setup

```sh
npm install
npm run dev     # Opens Chrome with extension loaded (HMR)
npm run test    # Unit tests
npm run build   # Production build
```

## Adding a New Site

1. Create `lib/adapters/newsite.adapter.ts` implementing `SiteAdapter`
2. Create `entrypoints/content/newsite.content.ts`
3. Add the site URL to `entrypoints/background.ts` `SITE_URLS` and `SITE_URL_PATTERNS`
4. Add the `SiteId` type to `lib/messaging.ts`
5. Add the toggle to `SiteToggleList.tsx`
6. Add `host_permissions` entry in `wxt.config.ts`

## Code Style

- TypeScript strict mode — no `any`, no `!` non-null assertions without a comment
- All selectors as named constants at the top of adapter files
- Run `npm run lint` before committing
