import { useState } from "react";
import type { PromptHistoryEntry } from "@@/lib/history";
import type { SiteId } from "@@/lib/messaging";

const SITE_LABELS: Record<SiteId, string> = {
  chatgpt: "GPT",
  claude:  "Claude",
  gemini:  "Gemini",
};

interface Props {
  entries: PromptHistoryEntry[];
  onResend: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
  theme?: "dark" | "light";
}

export function HistoryList({ entries, onResend, onDelete }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  if (entries.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border border-black/10 dark:border-white/10 rounded-sm flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-black/25 dark:text-white/25">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-black/25 dark:text-white/25">
          No history yet
        </p>
        <p className="text-xs text-black/20 dark:text-white/20">Send your first prompt to get started</p>
      </div>
    );
  }

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const content = entry.prompt.toLowerCase();
    return terms.every((term) => content.includes(term));
  });

  const ratedEntries = entries.filter((e) => e.winner);
  const totalRated = ratedEntries.length;
  
  let leaderboardHeader = null;
  if (totalRated > 0) {
    const wins: Record<SiteId, number> = { chatgpt: 0, claude: 0, gemini: 0 };
    ratedEntries.forEach(e => { if (e.winner) wins[e.winner]++; });
    
    let topAI: SiteId = "chatgpt";
    let maxWins = -1;
    (Object.keys(wins) as SiteId[]).forEach((site) => {
      if (wins[site] > maxWins) {
        maxWins = wins[site];
        topAI = site;
      }
    });

    const winRate = Math.round((maxWins / totalRated) * 100);

    leaderboardHeader = (
      <div className="mb-2 p-4 rounded-md border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10">
        <h3 className="text-sm font-bold text-black dark:text-white mb-3">
          🏆 {SITE_LABELS[topAI]} is your top AI, winning {winRate}% of the time
        </h3>
        <div className="flex gap-6">
          {(Object.keys(wins) as SiteId[]).map((site) => {
            const pct = Math.round((wins[site] / totalRated) * 100) || 0;
            return (
              <div key={site} className="flex flex-col gap-1.5 w-24">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60">
                  <span>{SITE_LABELS[site]}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {leaderboardHeader}
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompt history..."
          className="w-full bg-transparent border border-black/15 dark:border-white/15 pl-10 pr-4 py-2.5 text-sm focus:border-black dark:focus:border-white outline-none transition-colors text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
        />
      </div>

      {filteredEntries.length === 0 ? (
        <div className="py-10 text-center text-sm opacity-50 italic">
          No results found for "{searchQuery}"
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-black/8 dark:divide-white/8">
          {filteredEntries.map((entry, i) => (
            <li
          key={entry.id}
          className="group flex items-start gap-4 py-5 hover:bg-black/2 dark:hover:bg-white/2 transition-colors duration-100 -mx-2 px-2"
        >
          {/* Index number */}
          <span className="text-xs font-mono text-black/20 dark:text-white/20 w-5 shrink-0 pt-0.5 text-right">
            {String(i + 1).padStart(2, "0")}
          </span>

          {/* Prompt text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-black dark:text-white leading-snug line-clamp-2">
              {entry.prompt}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono text-black/30 dark:text-white/30">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-black/15 dark:text-white/15">·</span>
              <div className="flex gap-1">
                {entry.targets.map((t) => (
                  <span
                    key={t}
                    className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider border px-1.5 py-0.5 ${
                      entry.winner === t 
                        ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10" 
                        : "text-black/40 dark:text-white/40 border-black/10 dark:border-white/10"
                    }`}
                  >
                    {entry.winner === t && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                    {SITE_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            <button
              id={`resend-${entry.id}`}
              onClick={() => { onResend(entry); }}
              aria-label="Resend prompt"
              title="Re-send this prompt"
              className="p-2 border border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black text-black/40 dark:text-white/40 transition-all duration-150 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
            >
              <ResendIcon />
            </button>
            <button
              id={`delete-${entry.id}`}
              onClick={() => { onDelete(entry.id); }}
              aria-label="Delete from history"
              title="Delete from history"
              className="p-2 border border-black/10 dark:border-white/10 hover:border-black/50 dark:hover:border-white/50 text-black/25 dark:text-white/25 hover:text-black/60 dark:hover:text-white/60 transition-all duration-150 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20"
            >
              <DeleteIcon />
            </button>
          </div>
        </li>
      ))}
        </ul>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffHours = (now.getTime() - ms) / 3600_000;
  if (diffHours < 24) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ResendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M8 3.5a4.5 4.5 0 1 0 4.262 5.965.75.75 0 0 1 1.416.492A6 6 0 1 1 13.25 3.8V2.75a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1 0-1.5h1.055A4.486 4.486 0 0 0 8 3.5Z" clipRule="evenodd" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v.185a.75.75 0 0 1-.75.75H2.75a.75.75 0 0 1-.75-.75V3.75ZM3.5 6.5A.5.5 0 0 1 4 6h8a.5.5 0 0 1 .5.5v6A1.5 1.5 0 0 1 11 14H5a1.5 1.5 0 0 1-1.5-1.5v-6Z" />
    </svg>
  );
}
