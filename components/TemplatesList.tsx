import { useState, useEffect } from "react";
import type { PromptTemplate } from "@@/lib/storage";
import { getTemplates, addTemplate, updateTemplate, deleteTemplate, TEMPLATES_CAP } from "@@/lib/storage";
import { generateId } from "@@/lib/history";

interface Props {
  theme?: "dark" | "light";
}

export function TemplatesList({ theme }: Props) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  async function load() {
    setTemplates(await getTemplates());
  }

  useEffect(() => {
    void load();
  }, []);

  function handleEdit(t: PromptTemplate) {
    setEditingTemplate(t);
    setName(t.name);
    setContent(t.content);
    setIsCreating(false);
  }

  function handleCreateNew() {
    if (templates.length >= TEMPLATES_CAP) return;
    setEditingTemplate(null);
    setName("");
    setContent("");
    setIsCreating(true);
  }

  function handleCancel() {
    setEditingTemplate(null);
    setIsCreating(false);
    setName("");
    setContent("");
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) return;
    
    if (isCreating) {
      await addTemplate({
        id: generateId(),
        name: name.trim(),
        content: content.trim(),
        createdAt: Date.now()
      });
    } else if (editingTemplate) {
      await updateTemplate({
        ...editingTemplate,
        name: name.trim(),
        content: content.trim(),
      });
    }
    
    handleCancel();
    await load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this template?")) return;
    await deleteTemplate(id);
    await load();
  }

  const isFormActive = isCreating || editingTemplate !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
          Saved Templates
        </h2>
        {!isFormActive && (
          <button
            onClick={handleCreateNew}
            disabled={templates.length >= TEMPLATES_CAP}
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            + New ({templates.length}/{TEMPLATES_CAP})
          </button>
        )}
      </div>

      {isFormActive ? (
        <div className="p-4 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-50">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summarize, Rewrite..."
              className="w-full bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm focus:border-black dark:focus:border-white outline-none transition-colors text-black dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-50 flex items-center justify-between">
              <span>Content</span>
              <span className="normal-case tracking-normal font-normal opacity-70">Use <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[10px]">{`{{variable}}`}</code> for fill-in fields</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Rewrite this to be more professional: {{text}}"
              rows={4}
              className="w-full bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm focus:border-black dark:focus:border-white outline-none resize-none transition-colors text-black dark:text-white"
            />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={handleCancel} className="text-xs font-bold uppercase tracking-wider px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-black/60 dark:text-white/60">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={!name.trim() || !content.trim()} className="text-xs font-bold uppercase tracking-wider px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-30 transition-all">
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.length === 0 ? (
            <div className="text-sm opacity-50 italic px-2 py-4 text-center">No templates found.</div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="group relative flex flex-col p-4 border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition-colors bg-transparent">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{t.name}</h3>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(t)} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10">Edit</button>
                    <button onClick={() => void handleDelete(t.id)} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20">Delete</button>
                  </div>
                </div>
                <p className="text-xs opacity-70 whitespace-pre-wrap font-mono truncate">{t.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
