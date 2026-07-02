import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  srcDir: "entrypoints",
  entrypointsDir: ".",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "PromptSync",
    description:
      "Send one prompt to ChatGPT, Claude, and Gemini at once — free, open-source, no API keys, nothing leaves your browser.",
    version: "0.1.0",
    permissions: ["storage", "tabs", "sidePanel", "tabGroups"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
    ],
    icons: {
      "128": "icon/128.png"
    },
    action: {
      default_popup: "",
      default_icon: {
        "128": "icon/128.png"
      }
    }
  },
  commands: {
    "send-to-chatgpt": {
      suggested_key: { default: "Ctrl+Alt+C" },
      description: "Send prompt to ChatGPT",
    },
    "send-to-claude": {
      suggested_key: { default: "Ctrl+Alt+L" },
      description: "Send prompt to Claude",
    },
    "send-to-gemini": {
      suggested_key: { default: "Ctrl+Alt+G" },
      description: "Send prompt to Gemini",
    },
    "sync-prompts": {
      suggested_key: { default: "Ctrl+Alt+S" },
      description: "Sync prompts to all AI",
    },
  },
});
