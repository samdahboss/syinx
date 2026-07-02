import { useState, useEffect, useCallback } from "react";
import { PromptInput } from "./components/PromptInput";
import { SiteToggleList } from "./components/SiteToggleList";
import { HistoryList } from "./components/HistoryList";
import { SettingsPanel } from "./components/SettingsPanel";
import type { SiteId, SendPromptResponse } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import type { PromptHistoryEntry } from "@@/lib/history";
import { getRecentHistory, removeHistoryEntry } from "@@/lib/history";
import type { Settings } from "@@/lib/storage";
import { getSettings, updateSettings } from "@@/lib/storage";

// ─────────────────────────────────────────────
// Status types for per-site feedback
// ─────────────────────────────────────────────

type SiteStatus = "idle" | "pending" | "success" | "error";

interface SiteResult {
  siteId: SiteId;
  status: SiteStatus;
  error?: string;
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

type Tab = "send" | "history" | "settings";

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [targets, setTargets] = useState<SiteId[]>(["chatgpt", "claude", "gemini"]);
  const [settings, setSettings] = useState<Settings>({ defaultTargets: ["chatgpt", "claude", "gemini"], autoSubmit: true });
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [results, setResults] = useState<SiteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("send");

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
    setResults(targets.map((siteId) => ({ siteId, status: "pending" })));

    try {
      const response: SendPromptResponse = await sendToBackground({
        type: "SEND_PROMPT",
        prompt: prompt.trim(),
        targets,
        autoSubmit: settings.autoSubmit,
      });

      setResults(
        response.results.map((r) => ({
          siteId: r.siteId,
          status: r.success ? "success" : "error",
          error: r.error,
        })),
      );

      await refreshHistory();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      setResults(targets.map((siteId) => ({ siteId, status: "error", error: errorMsg })));
    } finally {
      setIsLoading(false);
    }
  }

  // ── Resend from history ───────────────────────────────────────────────────
  function handleResend(entry: PromptHistoryEntry) {
    setPrompt(entry.prompt);
    setTargets(entry.targets);
    setActiveTab("send");
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
    <div className="flex flex-col min-h-[400px] max-h-[580px] bg-[#0f1117]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-brand-900/40">
            P
          </div>
          <h1 className="text-sm font-semibold text-white tracking-tight">PromptSync</h1>
        </div>
        <span className="text-[10px] text-slate-600 font-medium">v0.1</span>
      </header>

      {/* ── Tabs ── */}
      <nav className="flex gap-0 px-4 pt-1 border-b border-slate-800">
        {(["send", "history", "settings"] as Tab[]).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            onClick={() => { setActiveTab(tab); }}
            className={`px-3 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors duration-100 ${
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
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {activeTab === "send" && (
          <>
            {/* Site toggles */}
            <SiteToggleList
              selected={targets}
              onChange={setTargets}
              disabled={isLoading}
            />

            {/* Prompt input */}
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSend={() => { void handleSend(); }}
              isLoading={isLoading}
            />

            {/* Per-site results */}
            {results.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Result</p>
                {results.map((r) => (
                  <div
                    key={r.siteId}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/50"
                  >
                    <span className="text-xs text-slate-400 capitalize">{r.siteId}</span>
                    <StatusBadge status={r.status} error={r.error} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <HistoryList
            entries={history}
            onResend={handleResend}
            onDelete={(id) => { void handleDelete(id); }}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            onUpdate={(partial) => { void handleSettingsUpdate(partial); }}
          />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

function StatusBadge({ status, error }: { status: SiteStatus; error?: string }) {
  switch (status) {
    case "pending":
      return <span className="badge-pending">Sending…</span>;
    case "success":
      return <span className="badge-success">✓ Sent</span>;
    case "error":
      return (
        <span className="badge-error" title={error}>
          ✕ Failed
        </span>
      );
    default:
      return null;
  }
}
