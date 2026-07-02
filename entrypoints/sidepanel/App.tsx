import { useState, useEffect } from "react";
import type { SiteResult, ExtensionMessage } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import { getSettings } from "@@/lib/storage";
import { PromptInput } from "@@/components/PromptInput";

export default function App() {
  const [results, setResults] = useState<SiteResult[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for progress updates
    const listener = (message: unknown) => {
      const msg = message as ExtensionMessage;
      if (msg.type === "PROGRESS_UPDATE") {
        setResults(msg.results);

        // If all results are in a terminal state (success or error), we are no longer loading
        const isDone = msg.results.every((r) => r.status === "success" || r.status === "error");
        if (isDone) {
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleSendFollowUp() {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    const settings = await getSettings();

    // Use the sites currently displayed in the results, or defaults if none
    const targets = results.length > 0 ? results.map((r) => r.siteId) : settings.defaultTargets;

    // Reset status to pending for the new prompt
    setResults(targets.map((siteId) => ({ siteId, status: "pending" })));

    try {
      await sendToBackground({
        type: "SEND_PROMPT",
        prompt: prompt.trim(),
        targets,
        autoSubmit: settings.autoSubmit,
        isFollowUp: true,
      });
      setPrompt("");
    } catch (e) {
      console.error("Failed to send follow up prompt", e);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-white">
      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-brand-900/40">
          P
        </div>
        <h1 className="text-sm font-semibold text-white tracking-tight">PromptSync</h1>
      </header>

      {/* ── Progress Content ── */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {results.length === 0 ? (
          <div className="text-slate-500 text-sm italic text-center mt-4">
            Awaiting prompt execution...
          </div>
        ) : (
          results.map((r) => (
            <div
              key={r.siteId}
              className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 capitalize font-medium">{r.siteId}</span>
                <StatusBadge status={r.status} />
              </div>
              {r.error && <span className="text-xs text-red-400 mt-1">{r.error}</span>}
            </div>
          ))
        )}
      </main>

      {/* ── Follow-up Input ── */}
      <footer className="p-4 border-t border-slate-800 shrink-0 bg-slate-900/30">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
          Follow Up
        </p>
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSend={() => {
            void handleSendFollowUp();
          }}
          isLoading={isLoading}
        />
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: SiteResult["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span className="flex items-center gap-1.5 text-yellow-400 text-xs px-2 py-0.5 bg-yellow-500/10 rounded-full font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
          </span>
          Working
        </span>
      );
    case "success":
      return (
        <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-medium border border-emerald-500/20">
          ✓ Done
        </span>
      );
    case "error":
      return (
        <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium border border-red-500/20">
          ✕ Failed
        </span>
      );
    default:
      return null;
  }
}
