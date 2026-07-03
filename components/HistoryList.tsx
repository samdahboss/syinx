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

  return (
    <ul className="flex flex-col divide-y divide-black/8 dark:divide-white/8">
      {entries.map((entry, i) => (
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
              <span className="text-[10px] font-mono text-black/30 dark:text-white/30">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-black/15 dark:text-white/15">·</span>
              <div className="flex gap-1">
                {entry.targets.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 border border-black/10 dark:border-white/10 px-1.5 py-0.5"
                  >
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
              title="Re-send this prompt"
              className="p-2 border border-black/10 dark:border-white/10 hover:border-black dark:hover:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black text-black/40 dark:text-white/40 transition-all duration-150 rounded-sm"
            >
              <ResendIcon />
            </button>
            <button
              id={`delete-${entry.id}`}
              onClick={() => { onDelete(entry.id); }}
              title="Delete from history"
              className="p-2 border border-black/10 dark:border-white/10 hover:border-black/50 dark:hover:border-white/50 text-black/25 dark:text-white/25 hover:text-black/60 dark:hover:text-white/60 transition-all duration-150 rounded-sm"
            >
              <DeleteIcon />
            </button>
          </div>
        </li>
      ))}
    </ul>
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
