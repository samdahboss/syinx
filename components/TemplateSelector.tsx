import type { PromptTemplate } from "@@/lib/storage";

interface Props {
  templates: PromptTemplate[];
  onSelect: (template: PromptTemplate) => void;
  selectedTemplateId?: string;
}

export function TemplateSelector({ templates, onSelect, selectedTemplateId }: Props) {
  if (templates.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 shrink-0">
        Templates
      </span>
      {templates.map((t) => {
        const isSelected = selectedTemplateId === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`
              shrink-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all
              ${isSelected 
                ? "bg-black dark:bg-white text-white dark:text-black" 
                : "border border-black/20 dark:border-white/20 text-black/70 dark:text-white/70 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white"
              }
            `}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
