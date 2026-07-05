import { useState, useEffect } from "react";
import type { Pipeline, PipelineStep } from "@@/lib/storage";
import { getPipelines, addPipeline, deletePipeline, updatePipeline } from "@@/lib/storage";
import type { SiteId } from "@@/lib/messaging";
import { generateId } from "@@/lib/history";

const SITE_LABELS: Record<SiteId, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

export function PipelinesList({ theme }: { theme?: "dark" | "light" }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);

  useEffect(() => {
    void refreshPipelines();
  }, []);

  async function refreshPipelines() {
    setPipelines(await getPipelines());
  }

  function handleCreateNew() {
    setEditingPipeline({
      id: generateId(),
      name: "New Pipeline",
      steps: [
        { id: generateId(), target: "chatgpt", promptTemplate: "Summarize: {{input}}" },
        { id: generateId(), target: "claude", promptTemplate: "Translate to French: {{input}}" }
      ],
      createdAt: Date.now(),
    });
    setIsEditing(true);
  }

  async function handleSave() {
    if (!editingPipeline) return;
    
    // Check if it already exists
    const exists = pipelines.find(p => p.id === editingPipeline.id);
    if (exists) {
      await updatePipeline(editingPipeline);
    } else {
      await addPipeline(editingPipeline);
    }
    
    setIsEditing(false);
    setEditingPipeline(null);
    await refreshPipelines();
  }

  async function handleDelete(id: string) {
    await deletePipeline(id);
    await refreshPipelines();
  }

  function updateStep(stepId: string, updates: Partial<PipelineStep>) {
    if (!editingPipeline) return;
    setEditingPipeline({
      ...editingPipeline,
      steps: editingPipeline.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    });
  }

  function addStep() {
    if (!editingPipeline) return;
    setEditingPipeline({
      ...editingPipeline,
      steps: [
        ...editingPipeline.steps,
        { id: generateId(), target: "chatgpt", promptTemplate: "{{input}}" }
      ]
    });
  }

  function removeStep(stepId: string) {
    if (!editingPipeline) return;
    setEditingPipeline({
      ...editingPipeline,
      steps: editingPipeline.steps.filter(s => s.id !== stepId)
    });
  }

  if (isEditing && editingPipeline) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center mb-2">
          <input 
            type="text" 
            value={editingPipeline.name}
            onChange={(e) => setEditingPipeline({...editingPipeline, name: e.target.value})}
            className="text-2xl font-bold bg-transparent border-b border-black/20 dark:border-white/20 focus:outline-none focus:border-black dark:focus:border-white w-full max-w-sm px-1 py-1"
          />
        </div>

        <div className="flex flex-col gap-4 relative pl-4 border-l-2 border-black/10 dark:border-white/10 ml-2">
          {editingPipeline.steps.map((step, index) => (
            <div key={step.id} className="relative bg-black/5 dark:bg-white/5 p-4 rounded-md border border-black/10 dark:border-white/10 group">
              <div className="absolute -left-[23px] top-4 w-6 h-6 rounded-full bg-white dark:bg-black border-2 border-black/20 dark:border-white/20 flex items-center justify-center text-[10px] font-bold">
                {index + 1}
              </div>
              <div className="flex justify-between items-center mb-3">
                <select
                  value={step.target}
                  onChange={(e) => updateStep(step.id, { target: e.target.value as SiteId })}
                  className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="chatgpt" className="text-black">ChatGPT</option>
                  <option value="claude" className="text-black">Claude</option>
                  <option value="gemini" className="text-black">Gemini</option>
                </select>
                <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                </button>
              </div>
              <textarea
                value={step.promptTemplate}
                onChange={(e) => updateStep(step.id, { promptTemplate: e.target.value })}
                className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-sm p-3 text-sm resize-y min-h-[80px] focus:outline-none focus:border-black/30 dark:focus:border-white/30"
                placeholder="Enter prompt template. Use {{input}} to inject previous output."
              />
            </div>
          ))}
        </div>

        <button 
          onClick={addStep}
          className="text-xs font-bold uppercase tracking-wider py-2 px-4 border border-dashed border-black/30 dark:border-white/30 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white transition-colors self-start ml-6 rounded-sm"
        >
          + Add Step
        </button>

        <div className="flex gap-3 mt-4">
          <button 
            onClick={() => void handleSave()}
            className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-sm hover:opacity-80 transition-opacity"
          >
            Save Pipeline
          </button>
          <button 
            onClick={() => { setIsEditing(false); setEditingPipeline(null); }}
            className="border border-black/20 dark:border-white/20 px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-black/30 dark:text-white/30">
          Saved Pipelines
        </p>
        <button
          onClick={handleCreateNew}
          className="text-xs font-bold uppercase tracking-wider border border-black/20 dark:border-white/20 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-sm"
        >
          + New Pipeline
        </button>
      </div>

      {pipelines.length === 0 ? (
        <div className="py-12 border border-dashed border-black/20 dark:border-white/20 rounded-md flex flex-col items-center justify-center gap-3 opacity-50">
          <p className="text-sm font-medium">No pipelines yet</p>
          <p className="text-xs">Create a pipeline to chain multiple prompts together.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pipelines.map((p) => (
            <div key={p.id} className="border border-black/10 dark:border-white/10 p-5 rounded-md hover:border-black/30 dark:hover:border-white/30 transition-colors group flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-3">{p.name}</h3>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {p.steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest border border-black/10 dark:border-white/10 px-1.5 py-0.5 rounded-sm bg-black/5 dark:bg-white/5">
                        {SITE_LABELS[s.target]}
                      </span>
                      {i < p.steps.length - 1 && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 opacity-40"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingPipeline(p); setIsEditing(true); }}
                  className="text-xs font-bold uppercase tracking-wider hover:text-blue-500"
                >
                  Edit
                </button>
                <button 
                  onClick={() => void handleDelete(p.id)}
                  className="text-xs font-bold uppercase tracking-wider text-red-500/70 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
