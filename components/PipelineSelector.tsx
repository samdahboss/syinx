import type { Pipeline } from "@@/lib/storage";

interface Props {
  pipelines: Pipeline[];
  onSelect: (pipeline: Pipeline | null) => void;
  selectedPipelineId?: string;
}

export function PipelineSelector({ pipelines, onSelect, selectedPipelineId }: Props) {
  if (pipelines.length === 0) return null;

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30 mr-2">
        PIPELINES
      </span>
      {pipelines.map((pipeline) => {
        const isSelected = pipeline.id === selectedPipelineId;
        return (
          <button
            key={pipeline.id}
            onClick={() => onSelect(isSelected ? null : pipeline)}
            className={`text-xs font-bold px-3 py-1.5 transition-all duration-150 border rounded-sm flex items-center gap-1.5
              ${
                isSelected
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm shadow-blue-500/20"
                  : "border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10 3a1.5 1.5 0 1 1 3 0v4.062a1.5 1.5 0 0 1-3 0V3Z" />
              <path d="M15.429 8.572a1.5 1.5 0 1 0-2.122-2.122l-2.872 2.872a1.5 1.5 0 0 0 2.122 2.122l2.872-2.872Z" />
              <path d="M8.571 8.572a1.5 1.5 0 1 1 2.122-2.122l2.872 2.872a1.5 1.5 0 0 1-2.122 2.122L8.571 8.572Z" />
              <path d="M3 10a1.5 1.5 0 1 0 0 3h4.062a1.5 1.5 0 0 0 0-3H3Z" />
              <path d="M21 10a1.5 1.5 0 1 0 0 3h-4.062a1.5 1.5 0 0 0 0-3H21Z" />
              <path d="M8.571 15.428a1.5 1.5 0 1 0 2.122 2.122l2.872-2.872a1.5 1.5 0 0 0-2.122-2.122l-2.872 2.872Z" />
              <path d="M15.429 15.428a1.5 1.5 0 1 1-2.122 2.122l-2.872-2.872a1.5 1.5 0 0 1 2.122-2.122l2.872 2.872Z" />
              <path d="M10 21a1.5 1.5 0 1 0 3 0v-4.062a1.5 1.5 0 0 0-3 0V21Z" />
            </svg>
            {pipeline.name}
          </button>
        );
      })}
    </div>
  );
}
