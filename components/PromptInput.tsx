import React, { useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  theme?: "dark" | "light";
}

export function PromptInput({ value, onChange, onSend, isLoading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && value.trim()) onSend();
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="prompt-input"
          className="
            bg-transparent border border-black/15 dark:border-white/15 rounded-none py-4 px-5
            text-sm leading-relaxed min-h-[140px] w-full resize-none
            text-black dark:text-white
            placeholder-black/30 dark:placeholder-white/30
            focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20
            transition-colors duration-150
          "
          placeholder="Type your prompt… (Ctrl+Enter to send)"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={5}
        />
        {value.length > 0 && (
          <span
            style={{
              position: "absolute",
              bottom: "10px",
              right: "12px",
              fontSize: "10px",
              fontFamily: "monospace",
              opacity: 0.2,
            }}
            className="text-black dark:text-white"
          >
            {value.length}
          </span>
        )}
      </div>

      {/* Send button */}
      <button
        id="send-btn"
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        className="
          inline-flex items-center gap-2 self-start py-2.5 px-6
          text-xs font-bold tracking-widest uppercase rounded-none cursor-pointer
          bg-black dark:bg-white text-white dark:text-black
          disabled:opacity-30 disabled:cursor-not-allowed
          hover:opacity-75 active:scale-[0.98]
          transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black dark:focus-visible:ring-white dark:focus-visible:ring-offset-black
        "
      >
        {isLoading ? (
          <>
            <span
              style={{
                width: "12px",
                height: "12px",
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.6s linear infinite",
              }}
            />
            Sending…
          </>
        ) : (
          <>
            {/* Send arrow icon — inline size to avoid Tailwind purge issue */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="14"
              height="14"
              style={{ flexShrink: 0 }}
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
            Send to AI
          </>
        )}
      </button>
    </div>
  );
}
