import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Cpu, User } from 'lucide-react';
import TypingDots from '../ui/TypingDots';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)]
        hover:text-[var(--text-primary)] hover:bg-[var(--surface-200)] transition-all">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start mb-5`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? 'bg-[var(--surface-200)]' : ''}`}
        style={!isUser ? { background: 'var(--accent)', boxShadow: '0 0 16px rgba(var(--accent-rgb),0.35)' } : {}}>
        {isUser ? <User size={13} className="text-[var(--text-secondary)]" /> : <Cpu size={13} className="text-white" />}
      </div>

      {/* Bubble */}
      <div className={`group max-w-[88%] sm:max-w-[80%] min-w-[40px] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'rounded-tr-sm text-[var(--text-primary)]'
            : 'rounded-tl-sm text-[var(--text-primary)]'}`}
          style={isUser
            ? { background: 'rgba(var(--accent-rgb),0.18)', border: '1px solid rgba(var(--accent-rgb),0.25)' }
            : { background: 'var(--surface-100)', border: '1px solid var(--border)' }
          }>
          {isEmpty ? (
            <TypingDots />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Actions row */}
        {!isUser && message.content && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
