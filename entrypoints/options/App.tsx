import { useState, useEffect, useCallback, useRef } from "react";
import { PromptInput } from "@@/components/PromptInput";
import { SiteToggleList } from "@@/components/SiteToggleList";
import { HistoryList } from "@@/components/HistoryList";
import { SettingsPanel } from "@@/components/SettingsPanel";
import { TemplatesList } from "@@/components/TemplatesList";
import { TemplateSelector } from "@@/components/TemplateSelector";
import { TemplateFillInline } from "@@/components/TemplateFillInline";
import type { SiteId, ExtensionMessage } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import type { PromptHistoryEntry } from "@@/lib/history";
import { getRecentHistory, removeHistoryEntry, generateId } from "@@/lib/history";
import type { Settings, PromptTemplate } from "@@/lib/storage";
import { getSettings, updateSettings, getTemplates } from "@@/lib/storage";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Tab = "chat" | "history" | "settings" | "templates";
type Theme = "dark" | "light";

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [targets, setTargets] = useState<SiteId[]>(["chatgpt", "claude", "gemini"]);
  const [settings, setSettings] = useState<Settings>({
    defaultTargets: ["chatgpt", "claude", "gemini"],
    autoSubmit: true,
    useNewTabs: false,
  });
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [theme, setTheme] = useState<Theme>("dark");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const windowIdRef = useRef<number | undefined>(undefined);

  // ── Load persisted state on mount ────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [savedSettings, savedHistory, currentWindow, savedTemplates] = await Promise.all([
        getSettings(),
        getRecentHistory(20),
        chrome.windows.getCurrent(),
        getTemplates(),
      ]);
      setSettings(savedSettings);
      setTargets(savedSettings.defaultTargets);
      setHistory(savedHistory);
      setTemplates(savedTemplates);
      windowIdRef.current = currentWindow.id;
    })();

    // Load persisted theme
    const saved = localStorage.getItem("ps-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  // ── Apply theme class to html element ────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("ps-theme", theme);
  }, [theme]);

  // ── Refresh templates when switching to chat tab ─────────────────────────
  useEffect(() => {
    if (activeTab === "chat") {
      void getTemplates().then(setTemplates);
    }
  }, [activeTab]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // ── Refresh history after sending ────────────────────────────────────────
  const refreshHistory = useCallback(async () => {
    const h = await getRecentHistory(20);
    setHistory(h);
  }, []);

  // ── Core send logic (shared by button click and keyboard shortcuts) ───────
  const handleSendToTargets = useCallback(async (
    overrideTargets?: SiteId[],
    openPanel = false,
  ) => {
    const currentPrompt = prompt.trim();
    const currentTargets = overrideTargets ?? targets;
    if (!currentPrompt || isLoading || currentTargets.length === 0) return;
    setIsLoading(true);

    if (openPanel) {
      // Only allowed when called from a direct user gesture (button click)
      try {
        const wid = windowIdRef.current;
        if (wid !== undefined) await chrome.sidePanel.open({ windowId: wid });
      } catch (e) {
        console.warn("[Syinx] Could not open sidepanel:", e);
      }
    }

    try {
      const sessionId = generateId();
      await sendToBackground({
        type: "SEND_PROMPT",
        prompt: currentPrompt,
        targets: currentTargets,
        autoSubmit: settings.autoSubmit,
        isFollowUp: false,
        sessionId,
      });
      await refreshHistory();
    } catch (e) {
      console.error("Failed to send prompt", e);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, targets, isLoading, settings.autoSubmit, refreshHistory, windowIdRef]);

  // ── Button click → send to currently selected targets + open sidepanel ────
  function handleSend() {
    void handleSendToTargets(undefined, true);
  }

  // ── Keyboard shortcut commands forwarded from background ──────────────────
  useEffect(() => {
    const COMMAND_TARGETS: Record<string, SiteId[]> = {
      "send-to-chatgpt": ["chatgpt"],
      "send-to-claude":  ["claude"],
      "send-to-gemini":  ["gemini"],
      "sync-prompts":    ["chatgpt", "claude", "gemini"],
    };

    const listener = (message: unknown) => {
      const msg = message as ExtensionMessage;
      if (msg.type !== "TRIGGER_COMMAND") return;
      const commandTargets = COMMAND_TARGETS[msg.command];
      if (!commandTargets) return;
      // Navigate to the chat tab so the user sees the prompt field
      setActiveTab("chat");
      // Fire without opening sidepanel (no user gesture context here)
      void handleSendToTargets(commandTargets as SiteId[], false);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleSendToTargets]);

  function handleResend(entry: PromptHistoryEntry) {
    setPrompt(entry.prompt);
    setTargets(entry.targets);
    setActiveTab("chat");
  }

  async function handleDelete(id: string) {
    await removeHistoryEntry(id);
    await refreshHistory();
  }

  async function handleSettingsUpdate(partial: Partial<Settings>) {
    const updated = await updateSettings(partial);
    setSettings(updated);
  }

  function handleTemplateSelect(template: PromptTemplate) {
    const hasVars = /\{\{([^}]+)\}\}/.test(template.content);
    if (hasVars) {
      setSelectedTemplate(template);
    } else {
      setPrompt(template.content);
      setSelectedTemplate(null);
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-300 font-sans">
      {/* ── Header ── */}
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-8 py-5 flex items-center justify-between">
          {/* Logo wordmark */}
          <div className="flex items-center gap-3">
            <img src="/icon-128.png" alt="Syinx Logo" className="w-8 h-8 rounded-sm" />
            <span className="text-sm font-bold tracking-widest uppercase">Syinx</span>
          </div>

          {/* Right side: tabs + theme toggle */}
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              {(["chat", "history", "templates", "settings"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all duration-150 rounded-sm
                    ${activeTab === tab
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                    }`}
                >
                  {tab === "history" ? `History (${history.length})` : tab}
                </button>
              ))}
            </nav>

            {/* Theme toggle */}
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle light/dark mode"
              className="w-8 h-8 flex items-center justify-center rounded-sm border border-black/15 dark:border-white/15 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero title ── */}
      <div className="max-w-3xl mx-auto px-8 pt-16 pb-10">
        <p className="text-xs font-bold tracking-widest uppercase text-black/30 dark:text-white/30 mb-3">
          {activeTab === "chat" && "One prompt. All AIs."}
          {activeTab === "history" && "Prompt history"}
          {activeTab === "settings" && "Preferences"}
        </p>
        <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-black dark:text-white">
          {activeTab === "chat" && "SEND YOUR\nPROMPT"}
          {activeTab === "history" && "RECENT\nACTIVITY"}
          {activeTab === "templates" && "PROMPT\nTEMPLATES"}
          {activeTab === "settings" && "CONFIGURE\nSYNC"}
        </h1>
      </div>

      {/* ── Divider ── */}
      <div className="max-w-3xl mx-auto px-8">
        <div className="h-px bg-black/10 dark:bg-white/10" />
      </div>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-8 py-10">
        {activeTab === "chat" && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <TemplateSelector 
                templates={templates} 
                onSelect={handleTemplateSelect} 
                selectedTemplateId={selectedTemplate?.id}
              />
              {selectedTemplate && (
                <TemplateFillInline 
                  template={selectedTemplate} 
                  onApply={(compiled) => {
                    setPrompt(compiled);
                    setSelectedTemplate(null);
                  }}
                  onCancel={() => setSelectedTemplate(null)}
                />
              )}
            </div>
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSend={() => { void handleSend(); }}
              isLoading={isLoading}
              theme={theme}
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-4">
                Send to
              </p>
              <SiteToggleList selected={targets} onChange={setTargets} disabled={isLoading} theme={theme} />
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <HistoryList
            entries={history}
            onResend={handleResend}
            onDelete={(id) => { void handleDelete(id); }}
            theme={theme}
          />
        )}

        {activeTab === "templates" && (
          <TemplatesList theme={theme} />
        )}

        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            onUpdate={(partial) => { void handleSettingsUpdate(partial); }}
            theme={theme}
          />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-3xl mx-auto px-8 py-8 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
        <span className="text-xs text-black/25 dark:text-white/25 uppercase tracking-widest font-semibold">Syinx v0.1.0</span>
        <span className="text-xs text-black/25 dark:text-white/25">Free · Open Source · No API Keys</span>
      </footer>
    </div>
  );
}
