import type { Settings } from "@@/lib/storage";

interface Props {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => void;
}

export function SettingsPanel({ settings, onUpdate }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Settings</h3>

      {/* Auto-submit toggle */}
      <label
        htmlFor="toggle-autosubmit"
        className="flex items-center justify-between cursor-pointer group"
      >
        <div>
          <p className="text-sm text-slate-300 font-medium">Auto-submit</p>
          <p className="text-xs text-slate-500">
            {settings.autoSubmit
              ? "Prompt is sent automatically"
              : "Prompt is pre-filled — you press Enter"}
          </p>
        </div>
        <div className="relative ml-4 shrink-0">
          <input
            type="checkbox"
            id="toggle-autosubmit"
            className="sr-only"
            checked={settings.autoSubmit}
            onChange={(e) => { onUpdate({ autoSubmit: e.target.checked }); }}
          />
          <div
            className={`w-10 h-5 rounded-full transition-colors duration-200 ${
              settings.autoSubmit ? "bg-brand-500" : "bg-slate-700"
            }`}
          />
          <div
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              settings.autoSubmit ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </label>
    </div>
  );
}
