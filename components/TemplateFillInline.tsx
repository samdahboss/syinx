import { useState, useEffect } from "react";
import type { PromptTemplate } from "@@/lib/storage";

interface Props {
  template: PromptTemplate;
  onApply: (compiledPrompt: string) => void;
  onCancel: () => void;
}

export function TemplateFillInline({ template, onApply, onCancel }: Props) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Extract unique variables
  const matches = Array.from(template.content.matchAll(/\{\{([^}]+)\}\}/g));
  const varNames = Array.from(new Set(matches.map((m) => m[1].trim())));

  useEffect(() => {
    // Reset variables when template changes
    setVariables({});
  }, [template.id]);

  function compileTemplate(): string {
    return template.content.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
      const name = p1.trim();
      return variables[name] || match; // fallback to {{name}} if empty
    });
  }

  function handleApply() {
    onApply(compileTemplate());
  }

  return (
    <div className="p-4 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-70">
          Fill Template: {template.name}
        </h3>
        <button onClick={onCancel} className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {varNames.map((name) => (
          <div key={name}>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-50">
              {name}
            </label>
            <input
              type="text"
              value={variables[name] || ""}
              onChange={(e) => setVariables({ ...variables, [name]: e.target.value })}
              placeholder={`Enter value for ${name}`}
              className="w-full bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm focus:border-black dark:focus:border-white outline-none transition-colors text-black dark:text-white"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Preview</label>
        <div className="p-3 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs font-mono whitespace-pre-wrap opacity-80 min-h-[60px]">
          {compileTemplate()}
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <button
          onClick={handleApply}
          className="text-xs font-bold uppercase tracking-wider px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-all"
        >
          Apply to Prompt
        </button>
      </div>
    </div>
  );
}
