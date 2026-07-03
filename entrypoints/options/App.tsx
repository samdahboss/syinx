import { useState, useEffect, useCallback } from "react";
import { PromptInput } from "@@/components/PromptInput";
import { SiteToggleList } from "@@/components/SiteToggleList";
import { HistoryList } from "@@/components/HistoryList";
import { SettingsPanel } from "@@/components/SettingsPanel";
import type { SiteId, SendPromptResponse } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import type { PromptHistoryEntry } from "@@/lib/history";
import { getRecentHistory, removeHistoryEntry } from "@@/lib/history";
import type { Settings } from "@@/lib/storage";
import { getSettings, updateSettings } from "@@/lib/storage";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Tab = "chat" | "history" | "settings";
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

  // ── Load persisted state on mount ────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [savedSettings, savedHistory] = await Promise.all([
        getSettings(),
        getRecentHistory(20),
      ]);
      setSettings(savedSettings);
      setTargets(savedSettings.defaultTargets);
      setHistory(savedHistory);
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

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // ── Refresh history after sending ────────────────────────────────────────
  const refreshHistory = useCallback(async () => {
    const h = await getRecentHistory(20);
    setHistory(h);
  }, []);

  // ── Send prompt ───────────────────────────────────────────────────────────
  async function handleSend() {
    if (!prompt.trim() || isLoading || targets.length === 0) return;
    setIsLoading(true);
    try {
      await sendToBackground({
        type: "SEND_PROMPT",
        prompt: prompt.trim(),
        targets,
        autoSubmit: settings.autoSubmit,
        isFollowUp: false,
      });
      await refreshHistory();
    } catch (e) {
      console.error("Failed to send prompt", e);
    } finally {
      setIsLoading(false);
    }
  }

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
            <div className="w-7 h-7 bg-black dark:bg-white rounded-sm flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path d="M2 8h5M9 4l4 4-4 4" stroke={theme === "dark" ? "black" : "white"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-widest uppercase">PromptSync</span>
          </div>

          {/* Right side: tabs + theme toggle */}
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              {(["chat", "history", "settings"] as Tab[]).map((tab) => (
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
        <span className="text-xs text-black/25 dark:text-white/25 uppercase tracking-widest font-semibold">PromptSync v0.1.0</span>
        <span className="text-xs text-black/25 dark:text-white/25">Free · Open Source · No API Keys</span>
      </footer>
    </div>
  );
}
