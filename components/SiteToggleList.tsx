import type { SiteId } from "@@/lib/messaging";

interface SiteConfig {
  id: SiteId;
  label: string;
  initial: string;
}

const SITES: SiteConfig[] = [
  { id: "chatgpt", label: "ChatGPT",  initial: "G" },
  { id: "claude",  label: "Claude",   initial: "C" },
  { id: "gemini",  label: "Gemini",   initial: "G" },
];

interface Props {
  selected: SiteId[];
  onChange: (selected: SiteId[]) => void;
  disabled?: boolean;
  theme?: "dark" | "light";
}

export function SiteToggleList({ selected, onChange, disabled }: Props) {
  function toggle(id: SiteId) {
    if (disabled) return;
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="flex gap-3">
      {SITES.map((site) => {
        const active = selected.includes(site.id);
        return (
          <button
            key={site.id}
            id={`toggle-${site.id}`}
            onClick={() => { toggle(site.id); }}
            disabled={disabled}
            title={active ? `Deselect ${site.label}` : `Select ${site.label}`}
            className={`
              flex-1 flex flex-col items-center gap-2 py-5
              border transition-all duration-150 rounded-sm
              text-xs font-bold uppercase tracking-widest
              disabled:opacity-30 disabled:cursor-not-allowed
              ${active
                ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black"
                : "bg-transparent border-black/15 dark:border-white/15 text-black/40 dark:text-white/40 hover:border-black/50 dark:hover:border-white/50 hover:text-black dark:hover:text-white"
              }
            `}
          >
            {/* Monogram badge */}
            <span className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-black
              ${active
                ? "bg-white/20 dark:bg-black/20"
                : "bg-black/5 dark:bg-white/5"
              }
            `}>
              {site.initial}
            </span>
            <span>{site.label}</span>
            {active && (
              <span className="w-1 h-1 rounded-full bg-current opacity-60" />
            )}
          </button>
        );
      })}
    </div>
  );
}
