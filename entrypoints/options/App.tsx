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
// Tabs
// ─────────────────────────────────────────────

type Tab = "chat" | "history" | "settings";

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
  }, []);

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
      // Send message to background to start workflow
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

  // ── Resend from history ───────────────────────────────────────────────────
  function handleResend(entry: PromptHistoryEntry) {
    setPrompt(entry.prompt);
    setTargets(entry.targets);
    setActiveTab("chat");
  }

  // ── Delete from history ───────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await removeHistoryEntry(id);
    await refreshHistory();
  }

  // ── Settings update ───────────────────────────────────────────────────────
  async function handleSettingsUpdate(partial: Partial<Settings>) {
    const updated = await updateSettings(partial);
    setSettings(updated);
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#0f1117] text-white">
      {/* ── Header ── */}
      <header className="flex flex-col items-center justify-center pt-16 pb-8">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-4">PromptSync</h1>
        <p className="text-slate-400">Sync prompts across ChatGPT, Claude, and Gemini.</p>
      </header>

      {/* ── Main Container ── */}
      <div className="max-w-3xl w-full mx-auto px-4">
        {/* ── Tabs ── */}
        <nav className="flex justify-center gap-4 px-4 pt-1 mb-8 border-b border-slate-800">
          {(["chat", "history", "settings"] as Tab[]).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => {
                setActiveTab(tab);
              }}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors duration-100 ${
                activeTab === tab
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-slate-500 hover:text-slate-400"
              }`}
            >
              {tab === "history" ? `History (${history.length})` : tab}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {activeTab === "chat" && (
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
              {/* Prompt input */}
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onSend={() => {
                  void handleSend();
                }}
                isLoading={isLoading}
              />

              <div className="mt-6 border-t border-slate-800 pt-6">
                {/* Site toggles */}
                <SiteToggleList selected={targets} onChange={setTargets} disabled={isLoading} />
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <HistoryList
                entries={history}
                onResend={handleResend}
                onDelete={(id) => {
                  void handleDelete(id);
                }}
              />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <SettingsPanel
                settings={settings}
                onUpdate={(partial) => {
                  void handleSettingsUpdate(partial);
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
