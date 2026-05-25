import { motion } from 'framer-motion';
import { Cpu, Zap, FileText, Search } from 'lucide-react';

const STARTERS = [
  { icon: FileText, text: 'Summarize my uploaded documents' },
  { icon: Search, text: 'Find key insights from my PDFs' },
  { icon: Zap, text: 'What are the main topics covered?' },
  { icon: Cpu, text: 'Explain the technical concepts found' },
];

export default function ChatWelcome({ onPrompt }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full px-4 sm:px-6 py-10 sm:py-12"
    >
      {/* Logo glyph */}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'var(--accent)', boxShadow: '0 0 40px rgba(var(--accent-rgb),0.4)' }}>
        <Cpu size={28} className="text-white" />
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2 text-center">
        How can I help you?
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-8 sm:mb-10 text-center max-w-sm">
        Ask questions, explore your documents, or start a conversation. Powered by your private AI cloud.
      </p>

      {/* Starter prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {STARTERS.map(({ icon: Icon, text }, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPrompt(text)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm
              text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.15)' }}>
              <Icon size={14} style={{ color: 'var(--accent)' }} />
            </div>
            {text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
