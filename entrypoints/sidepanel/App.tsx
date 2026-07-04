import { useState, useEffect, useRef } from "react";
import type { SiteId, SiteResult, ExtensionMessage } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import { getSettings } from "@@/lib/storage";
import { generateId } from "@@/lib/history";
import { renderMarkdown } from "@@/lib/markdown";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Theme = "dark" | "light";

interface Session {
  id: string;
  prompt: string;
  results: (SiteResult & { response?: string })[];
  startedAt: Date;
}

// ─────────────────────────────────────────────
// Site metadata
// ─────────────────────────────────────────────

const SITE_META: Record<SiteId, { label: string; color: string; initial: string }> = {
  chatgpt: { label: "ChatGPT",  color: "#10a37f", initial: "G" },
  claude:  { label: "Claude",   color: "#d97706", initial: "C" },
  gemini:  { label: "Gemini",   color: "#4285f4", initial: "G" },
};

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

// ─────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: SiteResult["status"] }) {
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-yellow-500 dark:text-yellow-400 text-[10px] px-2 py-0.5 bg-yellow-500/10 rounded-full font-semibold uppercase tracking-wider">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
        </span>
        Working
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20">
        ✓ Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-red-600 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-red-500/10 border border-red-500/20">
        ✕ Failed
      </span>
    );
  }
  return null;
}

// ─────────────────────────────────────────────
// Response View (Expand-in-place)
// ─────────────────────────────────────────────

function ResponseView({ response, siteId }: { response: string; siteId: SiteId }) {
  const [expanded, setExpanded] = useState(false);
  const { color } = SITE_META[siteId];

  if (!response) return null;

  return (
    <div className="mt-2 text-[11px] bg-white dark:bg-[#0f1117] border border-black/10 dark:border-white/10 rounded-sm overflow-hidden relative">
      <div
        className={`prose p-2.5 transition-all duration-300 ${
          !expanded ? "max-h-32 overflow-hidden" : ""
        }`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }}
      />
      {!expanded && (
        <div className="absolute bottom-6 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#0f1117] to-transparent pointer-events-none" />
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center py-1.5 text-[9px] font-bold uppercase tracking-wider bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5 border-t border-black/5 dark:border-white/5 transition-colors"
        style={{ color }}
      >
        {expanded ? "Collapse" : "Read Full Response"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Site Toggle
// ─────────────────────────────────────────────

function SiteToggle({
  siteId,
  selected,
  onToggle,
}: {
  siteId: SiteId;
  selected: boolean;
  onToggle: () => void;
}) {
  const { label, color, initial } = SITE_META[siteId];
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border transition-all duration-150 ${
        selected
          ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-black dark:text-white"
          : "border-black/10 dark:border-white/10 text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"
      }`}
    >
      <span
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
        style={{ backgroundColor: selected ? color : "transparent", border: selected ? "none" : `1.5px solid currentColor` }}
      >
        {selected ? initial : ""}
      </span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [followUpTargets, setFollowUpTargets] = useState<SiteId[]>(["chatgpt", "claude", "gemini"]);
  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Auto-collapse older sessions when a new one is added ────────────────
  useEffect(() => {
    if (sessions.length > 1) {
      const newCollapsed = new Set<string>();
      for (let i = 0; i < sessions.length - 1; i++) {
        newCollapsed.add(sessions[i].id);
      }
      setCollapsedSessions(newCollapsed);
    }
  }, [sessions.length]);

  // ── Load theme ──────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("syinx-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("syinx-theme", theme);
  }, [theme]);

  // ── Listen for progress updates from background ─────────────────────────
  useEffect(() => {
    const listener = (message: unknown) => {
      const msg = message as ExtensionMessage;
      
      if (msg.type === "PROGRESS_UPDATE") {
        setSessions((prev) => {
          const existingIdx = prev.findIndex((s) => s.id === msg.sessionId);
          if (existingIdx === -1) {
            return [...prev, { id: msg.sessionId, prompt: "", results: msg.results, startedAt: new Date() }];
          }
          const updated = [...prev];
          // Preserve existing responses when updating results
          const existingResults = updated[existingIdx].results;
          const newResults = msg.results.map((r) => {
            const existing = existingResults.find((er) => er.siteId === r.siteId);
            return { ...r, response: existing?.response };
          });
          updated[existingIdx] = { ...updated[existingIdx], results: newResults };
          return updated;
        });
        setIsSending(!msg.results.every((r) => r.status === "success" || r.status === "error"));
      }

      if (msg.type === "RESPONSE_UPDATE") {
        setSessions((prev) => {
          const existingIdx = prev.findIndex((s) => s.id === msg.sessionId);
          if (existingIdx === -1) return prev;
          
          const updated = [...prev];
          const session = updated[existingIdx];
          const rIdx = session.results.findIndex((r) => r.siteId === msg.siteId);
          if (rIdx === -1) return prev;

          const results = [...session.results];
          results[rIdx] = { ...results[rIdx], response: msg.response };
          updated[existingIdx] = { ...session, results };
          return updated;
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // ── Scroll to bottom when sessions update ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  // ── Retry a single failed site ───────────────────────────────────────────
  async function handleRetry(siteId: SiteId) {
    const lastSession = sessions[sessions.length - 1];
    if (!lastSession) return;

    const settings = await getSettings();
    const prompt = lastSession.prompt || "";

    // Optimistically mark as pending
    setSessions((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.results = last.results.map((r) =>
        r.siteId === siteId ? { ...r, status: "pending", error: undefined } : r
      );
      updated[updated.length - 1] = last;
      return updated;
    });

    chrome.runtime.sendMessage({
      type: "RETRY_PROMPT",
      siteId,
      prompt,
      autoSubmit: settings.autoSubmit,
      sessionId: lastSession.id,
    } as ExtensionMessage);
  }

  // ── Send follow-up ────────────────────────────────────────────────────────
  async function handleFollowUp() {
    if (!followUp.trim() || isSending || followUpTargets.length === 0) return;
    setIsSending(true);

    const settings = await getSettings();
    const targets = followUpTargets;
    const sessionId = generateId();

    setSessions((prev) => [
      ...prev,
      { id: sessionId, prompt: followUp.trim(), results: targets.map((id) => ({ siteId: id, status: "pending" })), startedAt: new Date() },
    ]);

    try {
      await sendToBackground({
        type: "SEND_PROMPT",
        prompt: followUp.trim(),
        targets,
        autoSubmit: settings.autoSubmit,
        isFollowUp: true,
        sessionId,
      });
      setFollowUp("");
    } catch (e) {
      console.error("[Syinx] Follow-up failed:", e);
      setIsSending(false);
    }
  }

  const toggleFollowUpTarget = (id: SiteId) => {
    setFollowUpTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const lastSession = sessions[sessions.length - 1];
  const hasResults = sessions.length > 0;
  const allDone = lastSession?.results.every((r) => r.status === "success" || r.status === "error");

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-black dark:text-white font-sans transition-colors duration-200">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/icon-128.png" alt="Syinx" className="w-6 h-6 rounded-sm" />
          <span className="text-xs font-bold uppercase tracking-widest">Syinx</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Open Options */}
          <button
            id="open-options-btn"
            onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })}
            title="Open settings"
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-black/15 dark:border-white/15 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150"
          >
            <ExternalLinkIcon />
          </button>
          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle theme"
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-black/15 dark:border-white/15 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      {/* ── Sessions Feed ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {!hasResults ? (
          /* ── Idle State ── */
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
            <img src="/icon-128.png" alt="Syinx" className="w-12 h-12 rounded-xl opacity-40" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-1">
                No active session
              </p>
              <p className="text-xs text-black/40 dark:text-white/40 max-w-[180px] leading-relaxed">
                Send a prompt from the options page and your live progress will appear here.
              </p>
            </div>
            <button
              id="open-options-idle-btn"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })}
              className="mt-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-black/20 dark:border-white/20 rounded-sm hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-150"
            >
              Open Syinx
            </button>
          </div>
        ) : (
          sessions.map((session, si) => {
            const isCollapsed = collapsedSessions.has(session.id);
            return (
              <div key={si} className="flex flex-col gap-2">
                {/* Session header */}
                <div 
                  className="flex items-center justify-between cursor-pointer group py-1"
                  onClick={() => {
                    setCollapsedSessions((prev) => {
                      const next = new Set(prev);
                      if (next.has(session.id)) next.delete(session.id);
                      else next.add(session.id);
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronIcon expanded={!isCollapsed} />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white transition-colors">
                      {si === 0 ? "Session" : `Follow-up ${si}`}
                    </p>
                  </div>
                  <p className="text-[9px] text-black/20 dark:text-white/20 group-hover:text-black/40 dark:group-hover:text-white/40 transition-colors">
                    {session.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Prompt preview */}
                    {session.prompt && (
                      <p className="text-[11px] text-black/50 dark:text-white/40 italic truncate px-2.5 py-1.5 bg-black/3 dark:bg-white/3 rounded-sm border border-black/5 dark:border-white/5">
                        "{session.prompt}"
                      </p>
                    )}

                    {/* Per-site result cards */}
                    <div className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-2 -mx-4 px-4">
                      {session.results.map((r) => {
                        const meta = SITE_META[r.siteId];
                        const isLast = si === sessions.length - 1;
                        return (
                          <div
                            key={r.siteId}
                            className={`w-[85%] shrink-0 snap-center flex flex-col gap-1.5 px-3 py-2.5 rounded-md border transition-all duration-200 ${
                              r.status === "error"
                                ? "bg-red-500/3 dark:bg-red-500/5 border-red-500/15 dark:border-red-500/20"
                                : r.status === "success"
                                ? "bg-emerald-500/3 dark:bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/15"
                                : "bg-black/2 dark:bg-white/2 border-black/8 dark:border-white/8"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                  style={{ backgroundColor: meta.color }}
                                >
                                  {meta.initial}
                                </span>
                                <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
                              </div>
                              <StatusBadge status={r.status} />
                            </div>

                            {/* Error + Retry */}
                            {r.status === "error" && (
                              <div className="flex items-start justify-between gap-2 pl-7">
                                <p className="text-[10px] text-red-500 dark:text-red-400 leading-relaxed flex-1">
                                  {r.error ?? "Unknown error"}
                                </p>
                                {isLast && (
                                  <button
                                    id={`retry-${r.siteId}-btn`}
                                    onClick={() => void handleRetry(r.siteId)}
                                    className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-black/15 dark:border-white/15 rounded-full text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150 shrink-0"
                                  >
                                    <RetryIcon />
                                    Retry
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Response view */}
                            {r.response && <ResponseView response={r.response} siteId={r.siteId} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary line */}
                    {session.results.every((r) => r.status === "success" || r.status === "error") && (
                      <p className="text-[9px] text-black/25 dark:text-white/25 uppercase tracking-widest text-right mt-1">
                        {session.results.filter((r) => r.status === "success").length}/{session.results.length} succeeded
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </main>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="h-px bg-black/8 dark:bg-white/8 shrink-0" />

      {/* ── Follow-Up Input ───────────────────────────────────────────────── */}
      <footer className="shrink-0 px-4 pt-3 pb-4 flex flex-col gap-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30">
          {allDone || !hasResults ? "Send prompt" : "Follow up"}
        </p>

        {/* Site selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["chatgpt", "claude", "gemini"] as SiteId[]).map((id) => (
            <SiteToggle
              key={id}
              siteId={id}
              selected={followUpTargets.includes(id)}
              onToggle={() => toggleFollowUpTarget(id)}
            />
          ))}
        </div>

        {/* Textarea + Send */}
        <div className="flex gap-2 items-end">
          <textarea
            id="follow-up-input"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleFollowUp();
              }
            }}
            placeholder="Type a follow-up or new prompt…"
            rows={2}
            disabled={isSending}
            className="flex-1 resize-none rounded-sm px-2.5 py-2 text-xs focus:outline-none transition-colors duration-150 disabled:opacity-40"
            style={{
              background: theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
              border: theme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
              color: theme === "dark" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
              colorScheme: theme,
            }}
          />
          <button
            id="follow-up-send-btn"
            onClick={() => void handleFollowUp()}
            disabled={isSending || !followUp.trim() || followUpTargets.length === 0}
            className="shrink-0 w-9 self-stretch flex items-center justify-center rounded-sm transition-all duration-150 disabled:opacity-25 hover:opacity-80"
            style={{
              background: theme === "dark" ? "#ffffff" : "#000000",
              color: theme === "dark" ? "#000000" : "#ffffff",
            }}
          >
            {isSending ? (
              <span className="w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>

        <p className="text-[9px] text-black/20 dark:text-white/20">
          Enter to send · Shift+Enter for new line
        </p>
      </footer>
    </div>
  );
}
