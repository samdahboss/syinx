import { useState, useEffect, useRef } from "react";
import type { SiteId, SiteResult, ExtensionMessage } from "@@/lib/messaging";
import { sendToBackground } from "@@/lib/messaging";
import { getSettings, setWinnerForEntry } from "@@/lib/storage";
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
  winner?: SiteId;
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
      <span className="flex items-center gap-1.5 text-yellow-500 dark:text-yellow-400 text-xs px-2 py-0.5 bg-yellow-500/10 rounded-full font-semibold uppercase tracking-wider">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
        </span>
        Working
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs px-2 py-0.5 bg-purple-500/10 rounded-full font-semibold uppercase tracking-wider border border-purple-500/20">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
        </span>
        Generating
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20">
        ✓ Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-red-500/10 border border-red-500/20">
        ✕ Failed
      </span>
    );
  }
  return null;
}

function FocusModal({ 
  response, 
  siteId, 
  onClose,
  onSendPrompt,
  isSending 
}: { 
  response: string; 
  siteId: SiteId; 
  onClose: () => void;
  onSendPrompt: (prompt: string, targets: SiteId[]) => Promise<void>;
  isSending: boolean;
}) {
  const { label, color } = SITE_META[siteId];
  const [prompt, setPrompt] = useState("");
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  async function handleSend() {
    if (!prompt.trim() || isSending) return;
    await onSendPrompt(prompt, [siteId]);
    setPrompt("");
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white/80 dark:bg-[#0b0c10]/80 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-black/10 dark:border-white/10 shrink-0 bg-transparent">
        <div className="flex items-center gap-2 font-bold text-sm" style={{ color }}>
          {label} Response
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black/50 dark:text-white/50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent">
        <div
          className="prose prose-invert prose-sm max-w-none prose-p:my-3 prose-pre:my-4 prose-pre:bg-black/5 dark:prose-pre:bg-white/5 prose-pre:text-black dark:prose-pre:text-white prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-black/5 dark:prose-code:bg-white/5 prose-code:rounded prose-img:rounded-md prose-img:shadow-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }}
        />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-black/10 dark:border-white/10 bg-transparent">
        <div className="flex gap-2 items-end">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={`Follow up with ${label}…`}
            rows={1}
            disabled={isSending}
            className="flex-1 resize-none rounded-sm px-2.5 py-2 text-xs focus:outline-none transition-colors duration-150 disabled:opacity-40 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black dark:text-white placeholder-black/40 dark:placeholder-white/40"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isSending || !prompt.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-sm transition-all duration-150 disabled:opacity-25 hover:opacity-80 bg-black dark:bg-white text-white dark:text-black"
          >
            {isSending ? (
              <span className="w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Response View (Expand-in-place)
// ─────────────────────────────────────────────

function ResponseView({ 
  response, 
  siteId, 
  onSendPrompt,
  isSending
}: { 
  response: string; 
  siteId: SiteId;
  onSendPrompt: (prompt: string, targets: SiteId[]) => Promise<void>;
  isSending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const { color } = SITE_META[siteId];

  if (!response) return null;

  return (
    <div className="mt-2 text-sm bg-white dark:bg-[#0f1117] border border-black/10 dark:border-white/10 rounded-sm overflow-hidden relative">
      <div
        className={`prose prose-invert prose-sm max-w-none text-xs sm:text-sm leading-relaxed opacity-90 prose-p:my-1.5 prose-pre:my-2 prose-pre:bg-black/10 dark:prose-pre:bg-white/10 prose-pre:text-black dark:prose-pre:text-white prose-code:text-xs prose-code:px-1 prose-code:py-0.5 prose-code:bg-black/5 dark:prose-code:bg-white/5 prose-code:rounded whitespace-pre-wrap font-mono transition-all duration-300 p-2.5 ${
          !expanded ? "max-h-32 overflow-hidden" : ""
        }`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }}
      />
      {!expanded && (
        <div className="absolute bottom-7 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#0f1117] to-transparent pointer-events-none" />
      )}
      <div className="flex bg-black/3 dark:bg-white/3 border-t border-black/5 dark:border-white/5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-center py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color }}
        >
          {expanded ? "Collapse" : "Read Full Response"}
        </button>
        <div className="w-[1px] bg-black/5 dark:bg-white/5" />
        <button
          onClick={() => setFocusMode(true)}
          className="px-3 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
          title="Focus View"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
        </button>
      </div>

      {focusMode && (
        <FocusModal 
          response={response} 
          siteId={siteId} 
          onClose={() => setFocusMode(false)}
          onSendPrompt={onSendPrompt}
          isSending={isSending}
        />
      )}
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
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all duration-150 ${
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
      
      if (msg.type === "GENERATION_STARTED") {
        setSessions((prev) => {
          const existingIdx = prev.findIndex((s) => s.id === msg.sessionId);
          if (existingIdx === -1) return prev;
          
          const updated = [...prev];
          const session = updated[existingIdx];
          const rIdx = session.results.findIndex((r) => r.siteId === msg.siteId);
          if (rIdx === -1) return prev;

          const results = [...session.results];
          results[rIdx] = { ...results[rIdx], status: "generating" };
          updated[existingIdx] = { ...session, results };
          return updated;
        });
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
          results[rIdx] = { 
            ...results[rIdx], 
            response: msg.response,
            status: msg.error ? "error" : "success",
            error: msg.error
          };
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

  // ── Auto-clear sending state when the last session finishes ─────────────
  useEffect(() => {
    if (sessions.length === 0 || !isSending) return;
    const lastSession = sessions[sessions.length - 1];
    if (lastSession) {
      const allDone = lastSession.results.every((r) => r.status === "success" || r.status === "error");
      if (allDone) {
        setIsSending(false);
      }
    }
  }, [sessions, isSending]);

  // ── Mark a response as best ──────────────────────────────────────────────
  async function handleMarkBest(sessionId: string, siteId: SiteId) {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, winner: siteId } : s))
    );
    await setWinnerForEntry(sessionId, siteId);
  }

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

  // ── Send Prompt (Generic) ────────────────────────────────────────────────
  async function sendPrompt(promptText: string, targets: SiteId[]) {
    if (!promptText.trim() || isSending || targets.length === 0) return;
    setIsSending(true);

    const settings = await getSettings();
    const sessionId = generateId();

    setSessions((prev) => [
      ...prev,
      { id: sessionId, prompt: promptText.trim(), results: targets.map((id) => ({ siteId: id, status: "pending" })), startedAt: new Date() },
    ]);

    try {
      await sendToBackground({
        type: "SEND_PROMPT",
        prompt: promptText.trim(),
        targets,
        autoSubmit: settings.autoSubmit,
        isFollowUp: true,
        sessionId,
      });
    } catch (e) {
      console.error("[Syinx] Follow-up failed:", e);
      setIsSending(false);
    }
  }

  // ── Send follow-up from bottom bar ────────────────────────────────────────
  async function handleFollowUp() {
    await sendPrompt(followUp, followUpTargets);
    setFollowUp("");
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
            aria-label="Open settings"
            onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })}
            title="Open settings"
            className="w-8 h-8 flex items-center justify-center rounded-sm border border-black/15 dark:border-white/15 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
          >
            <ExternalLinkIcon />
          </button>
          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-sm border border-black/15 dark:border-white/15 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
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
              <p className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-1">
                No active session
              </p>
              <p className="text-xs text-black/40 dark:text-white/40 max-w-[180px] leading-relaxed">
                Send a prompt from the options page and your live progress will appear here.
              </p>
            </div>
            <button
              id="open-options-idle-btn"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })}
              className="mt-2 px-4 py-2 text-xs font-bold uppercase tracking-widest border border-black/20 dark:border-white/20 rounded-sm hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all duration-150"
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
                  className="flex items-center justify-between cursor-pointer group py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 rounded-sm"
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCollapsedSessions((prev) => {
                        const next = new Set(prev);
                        if (next.has(session.id)) next.delete(session.id);
                        else next.add(session.id);
                        return next;
                      });
                    }
                  }}
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
                    <p className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 group-hover:text-black dark:group-hover:text-white transition-colors">
                      {si === 0 ? "Session" : `Follow-up ${si}`}
                    </p>
                  </div>
                  <p className="text-xs text-black/20 dark:text-white/20 group-hover:text-black/40 dark:group-hover:text-white/40 transition-colors">
                    {session.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Prompt preview */}
                    {session.prompt && (
                      <p className="text-sm text-black/50 dark:text-white/40 italic truncate px-2.5 py-1.5 bg-black/3 dark:bg-white/3 rounded-sm border border-black/5 dark:border-white/5">
                        "{session.prompt}"
                      </p>
                    )}

                    {/* Per-site result cards */}
                    <div className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-2 -mx-4 px-4">
                      {session.results.map((r) => {
                        const meta = SITE_META[r.siteId];
                        const isLast = si === sessions.length - 1;
                        const isWinner = session.winner === r.siteId;
                        return (
                          <div
                            key={r.siteId}
                            className={`w-[85%] shrink-0 snap-center flex flex-col gap-1.5 px-3 py-2.5 rounded-md border transition-all duration-200 ${
                              isWinner
                                ? "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                                : r.status === "error"
                                ? "bg-red-500/3 dark:bg-red-500/5 border-red-500/15 dark:border-red-500/20"
                                : r.status === "success"
                                ? "bg-emerald-500/3 dark:bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/15"
                                : r.status === "generating"
                                ? "bg-purple-500/3 dark:bg-purple-500/5 border-purple-500/15 dark:border-purple-500/20"
                                : "bg-black/2 dark:bg-white/2 border-black/8 dark:border-white/8"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                  style={{ backgroundColor: meta.color }}
                                >
                                  {r.siteId === "chatgpt" && (
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.596 8.3829v-2.3324a.0757.0757 0 0 1 .0332-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66l-.1467-.0852-4.7783-2.7582a.7853.7853 0 0 0-.7806 0zM8.4069 4.1485a4.4992 4.4992 0 0 1 7.3715-2.453l-.142.0805-4.7829 2.7582a.7948.7948 0 0 0-.3928.6813v6.7369l-2.02-1.1686a.071.071 0 0 1-.038-.052V5.1499a4.504 4.504 0 0 1-.0042-.9924zM15.006 10.74L12.001 9.006l-3.0049 1.734v3.468l3.0049 1.734 3.0049-1.734z" />
                                    </svg>
                                  )}
                                  {r.siteId === "claude" && (
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
                                    </svg>
                                  )}
                                  {r.siteId === "gemini" && (
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                      <path d="M12 0c0 6.627-5.373 12-12 12 6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z" />
                                    </svg>
                                  )}
                                </span>
                                <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {r.status === "success" && (
                                  <button
                                    onClick={() => void handleMarkBest(session.id, r.siteId)}
                                    title={isWinner ? "Best answer" : "Mark as best answer"}
                                    className={`w-6 h-6 flex items-center justify-center rounded-full transition-all duration-200 ${
                                      isWinner
                                        ? "text-amber-500 bg-amber-500/10"
                                        : "text-black/20 dark:text-white/20 hover:text-amber-500 hover:bg-amber-500/10"
                                    }`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isWinner ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                  </button>
                                )}
                                <StatusBadge status={r.status} />
                              </div>
                            </div>

                            {/* Error + Retry */}
                            {r.status === "error" && (
                              <div className="flex items-start justify-between gap-2 pl-7">
                                <p className="text-xs text-red-500 dark:text-red-400 leading-relaxed flex-1">
                                  {r.error ?? "Unknown error"}
                                </p>
                                {isLast && (
                                  <button
                                    id={`retry-${r.siteId}-btn`}
                                    onClick={() => void handleRetry(r.siteId)}
                                    className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wider border border-black/15 dark:border-white/15 rounded-full text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/40 dark:hover:border-white/40 transition-all duration-150 shrink-0"
                                  >
                                    <RetryIcon />
                                    Retry
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Response view */}
                            {r.response && (
                              <ResponseView 
                                response={r.response} 
                                siteId={r.siteId} 
                                onSendPrompt={sendPrompt}
                                isSending={isSending}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary line */}
                    {session.results.every((r) => r.status === "success" || r.status === "error") && (
                      <p className="text-xs text-black/25 dark:text-white/25 uppercase tracking-widest text-right mt-1">
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
      <footer className="shrink-0 px-4 pt-3 pb-4 flex flex-col gap-2.5 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <p className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30">
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
            className="flex-1 resize-none rounded-sm px-2.5 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 transition-colors duration-150 disabled:opacity-40"
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
            className="shrink-0 w-9 self-stretch flex items-center justify-center rounded-sm transition-all duration-150 disabled:opacity-25 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
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

        <p className="text-xs text-black/20 dark:text-white/20">
          Enter to send · Shift+Enter for new line
        </p>
      </footer>
    </div>
  );
}
