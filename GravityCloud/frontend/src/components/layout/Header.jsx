import { Menu, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../../context/themeStore';

export default function Header({ onMenuToggle, onSidebarToggle, sidebarCollapsed, title = 'Gravity Cloud' }) {
  const { dark, toggleDark } = useThemeStore();

  return (
    <header className="flex items-center gap-4 px-5 h-[72px] glass border-b border-[var(--border)] shrink-0">
      <button
        onClick={onMenuToggle}
        className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Menu size={20} />
      </button>

      <button
        onClick={onSidebarToggle}
        className="hidden md:inline-flex text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>

      <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Status dot */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>

        {/* Dark / Light toggle */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={toggleDark}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]
            hover:bg-[var(--surface-200)] transition-all"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </motion.button>
      </div>
    </header>
  );
}
