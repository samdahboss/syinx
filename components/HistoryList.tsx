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
}

export function HistoryList({ entries, onResend, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-slate-600 text-xs">
        No history yet — send your first prompt!
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px] pr-0.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="group flex items-start gap-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg px-3 py-2.5 transition-colors duration-100"
        >
          {/* Prompt text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 truncate leading-snug">
              {entry.prompt}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-slate-600">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-slate-700">·</span>
              <div className="flex gap-1">
                {entry.targets.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded"
                  >
                    {SITE_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100 shrink-0">
            <button
              id={`resend-${entry.id}`}
              onClick={() => { onResend(entry); }}
              title="Re-send this prompt"
              className="p-1 rounded hover:bg-brand-500/20 text-slate-500 hover:text-brand-500 transition-colors"
            >
              <ResendIcon />
            </button>
            <button
              id={`delete-${entry.id}`}
              onClick={() => { onDelete(entry.id); }}
              title="Delete from history"
              className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
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
