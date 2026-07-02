# PromptSync

**Send one prompt to ChatGPT, Claude, and Gemini at once — free, open-source, no API keys, nothing leaves your browser.**

## What it does

PromptSync is a Chrome extension that injects your typed prompt into your already-logged-in ChatGPT, Claude, and Gemini tabs simultaneously. No backend, no API keys, no subscriptions. It rides your existing authenticated browser sessions.

> **v1 scope:** Sends prompts to all three sites. Response comparison is a planned v2 feature.

## Why

Existing tools like ChatHub:
- Limit free tier to 2 models
- Require $19–39/month for full access
- Need API keys or a paid relay for many models
- Break periodically when sites update their DOM

PromptSync solves this by operating directly on your logged-in browser tabs — like a power user copy-pasting, but automated.

## Install

### From Chrome Web Store
*(Coming soon — under review)*

### Load Unpacked (development)
1. Clone this repo
2. Run `npm install && npm run build`
3. Open `chrome://extensions`, enable **Developer Mode**
4. Click **Load Unpacked** → select the `.output/chrome-mv3` folder

## How it works

1. You type a prompt in the PromptSync popup.
2. You select which sites to target (ChatGPT / Claude / Gemini).
3. The extension opens or focuses a tab for each site, injects your prompt into the site's input field, and (optionally) submits it.
4. Your last 50 prompts are saved locally in `chrome.storage.local` and can be re-sent with one click.

**No data leaves your browser.** The extension never makes network requests — it only manipulates DOM elements in tabs you control.

See [`promptsync-architecture-spec.md`](./promptsync-architecture-spec.md) for the full technical spec.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

The most common contribution is **fixing a broken site adapter** when ChatGPT/Claude/Gemini updates their DOM. See the guide there.

## Privacy

See [PRIVACY.md](./PRIVACY.md).

## License

[MIT](./LICENSE)
