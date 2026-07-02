import type { SiteId } from "@@/lib/messaging";

interface SiteConfig {
  id: SiteId;
  label: string;
  color: string;
  icon: string;
}

const SITES: SiteConfig[] = [
  { id: "chatgpt", label: "ChatGPT", color: "#10a37f", icon: "🤖" },
  { id: "claude",  label: "Claude",  color: "#da7756", icon: "✦"  },
  { id: "gemini",  label: "Gemini",  color: "#4285f4", icon: "✧"  },
];

interface Props {
  selected: SiteId[];
  onChange: (selected: SiteId[]) => void;
  disabled?: boolean;
}

export function SiteToggleList({ selected, onChange, disabled }: Props) {
  function toggle(id: SiteId) {
    if (disabled) return;
    if (selected.includes(id)) {
      // Don't allow deselecting all
      if (selected.length === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="flex gap-2">
      {SITES.map((site) => {
        const active = selected.includes(site.id);
        return (
          <button
            key={site.id}
            id={`toggle-${site.id}`}
            onClick={() => { toggle(site.id); }}
            disabled={disabled}
            title={active ? `Deselect ${site.label}` : `Select ${site.label}`}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium border transition-all duration-150
              ${active
                ? "border-transparent text-white shadow-md"
                : "border-slate-700 text-slate-500 bg-transparent hover:border-slate-600 hover:text-slate-400"
              }
              disabled:opacity-40 disabled:cursor-not-allowed`}
            style={active ? { backgroundColor: `${site.color}22`, borderColor: site.color, color: site.color } : {}}
          >
            <span className="text-base leading-none">{site.icon}</span>
            <span>{site.label}</span>
            {active && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: site.color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
