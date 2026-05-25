import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Square } from 'lucide-react';

export default function ChatInput({ onSend, loading, disabled }) {
  const [value, setValue] = useState('');
  const textRef = useRef(null);

  const submit = () => {
    const text = value.trim();
    if (!text || loading) return;
    onSend(text);
    setValue('');
    if (textRef.current) {
      textRef.current.style.height = 'auto';
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = (e) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-[var(--border)] glass shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 sm:gap-3 rounded-2xl px-3 sm:px-4 py-3"
          style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
          <textarea
            ref={textRef}
            value={value}
            onChange={autoResize}
            onKeyDown={onKey}
            disabled={disabled || loading}
            placeholder="Ask anything about your documents…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)] outline-none leading-relaxed"
            style={{ maxHeight: 200 }}
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={submit}
            disabled={!value.trim() || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all
              disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: value.trim() && !loading ? 'var(--accent)' : 'var(--surface-200)',
              boxShadow: value.trim() && !loading ? '0 0 16px rgba(var(--accent-rgb),0.4)' : 'none',
            }}
          >
            {loading
              ? <Square size={13} className="text-[var(--text-secondary)]" />
              : <Send size={13} className="text-white" style={!value.trim() ? { color: 'var(--text-muted)' } : {}} />
            }
          </motion.button>
        </div>
        <p className="text-center text-[10px] text-[var(--text-muted)] mt-2 px-2 sm:px-0">
          Shift+Enter for new line · Powered by Ollama + RAG
        </p>
      </div>
    </div>
  );
}
