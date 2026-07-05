import type { Settings } from "@@/lib/storage";

interface Props {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
  theme?: "dark" | "light";
}

interface SettingRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingRow({ id, label, description, checked, onChange }: SettingRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-6 py-6 border-b border-black/8 dark:border-white/8 cursor-pointer group"
    >
      <div className="flex-1">
        <p className="text-sm font-bold text-black dark:text-white mb-1">{label}</p>
        <p className="text-xs text-black/40 dark:text-white/40 leading-relaxed">{description}</p>
      </div>

      {/* Toggle switch */}
      <div className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          className="sr-only"
          checked={checked}
          onChange={(e) => { onChange(e.target.checked); }}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ${
            checked ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/10"
          }`}
        />
        <div
          className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow transition-all duration-200 ${
            checked
              ? "translate-x-5 bg-white dark:bg-black"
              : "translate-x-0 bg-white dark:bg-white/60"
          }`}
        />
      </div>
    </label>
  );
}

export function SettingsPanel({ settings, onUpdate }: Props) {
  return (
    <div className="flex flex-col">
      <SettingRow
        id="toggle-autosubmit"
        label="Auto-submit"
        description={
          settings.autoSubmit
            ? "Prompt is sent automatically when injected."
            : "Prompt is pre-filled — you press Enter to confirm."
        }
        checked={settings.autoSubmit}
        onChange={(checked) => { onUpdate({ autoSubmit: checked }); }}
      />

      <SettingRow
        id="toggle-usenewtabs"
        label="Always open new tabs"
        description={
          settings.useNewTabs
            ? "A fresh tab will be opened for every AI session."
            : "Existing tabs for each AI will be reused when available."
        }
        checked={settings.useNewTabs}
        onChange={(checked) => { onUpdate({ useNewTabs: checked }); }}
      />

      <SettingRow
        id="toggle-smartselect"
        label="Smart Default Targets"
        description="Automatically select the best AIs based on your prompt (e.g. Coding uses ChatGPT+Claude, Writing uses Claude+Gemini)."
        checked={settings.smartSelect}
        onChange={(checked) => { onUpdate({ smartSelect: checked }); }}
      />

      {/* Keyboard shortcuts info block */}
      <div className="pt-8">
        <p className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mb-4">
          Keyboard shortcuts
        </p>
        <div className="flex flex-col gap-2">
          {[
            { key: "Alt+Shift+C", label: "Send to ChatGPT" },
            { key: "Alt+Shift+L", label: "Send to Claude" },
            { key: "Alt+Shift+G", label: "Send to Gemini" },
            { key: "Alt+Shift+S", label: "Sync to all AIs" },
            { key: "Ctrl+Enter",  label: "Send from prompt box" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
              <span className="text-xs text-black/50 dark:text-white/50">{label}</span>
              <kbd className="text-[10px] font-mono font-bold bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 px-2 py-0.5 rounded-sm tracking-wide">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
