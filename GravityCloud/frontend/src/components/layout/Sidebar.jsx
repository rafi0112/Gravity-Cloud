import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, FileText, Settings, Plus, Trash2,
  ChevronRight, Cpu, LayoutDashboard, X, Edit3, PanelLeftClose, PanelLeftOpen, Server
} from 'lucide-react';
import { useChatStore } from '../../context/chatStore';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/nodes', icon: Server, label: 'Nodes' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse }) {
  const navigate = useNavigate();
  const { sessions, activeId, createSession, deleteSession, setActive, renameSession } = useChatStore();
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const closeMobileDrawer = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      onClose?.();
    }
  };

  const handleNew = () => {
    const id = createSession();
    navigate('/chat');
    closeMobileDrawer();
  };

  const startEdit = (e, s) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditVal(s.title);
  };

  const saveEdit = () => {
    if (editVal.trim()) renameSession(editingId, editVal.trim());
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={`
          fixed top-0 left-0 h-screen z-40
          flex flex-col glass border-r border-[var(--border)] transition-transform md:transition-[width] duration-200
          w-[85vw] max-w-[320px] md:w-[260px] md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'md:w-[88px]' : 'md:w-[260px]'}
        `}
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className={`flex items-center h-[72px] border-b border-[var(--border)] ${collapsed ? 'gap-0 px-4 justify-center' : 'gap-3 px-5'}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)', boxShadow: '0 0 20px rgba(var(--accent-rgb),0.4)' }}>
            <Cpu size={16} className="text-white" />
          </div>
          {!collapsed && <span className="font-semibold text-[var(--text-primary)] tracking-tight">Gravity Cloud</span>}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="hidden md:inline-flex text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button onClick={onClose} className="md:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button onClick={handleNew}
            className={`w-full flex items-center ${collapsed ? 'justify-center gap-0 px-2.5' : 'gap-2.5 px-3'} py-2.5 rounded-xl text-sm font-medium text-[var(--text-primary)]
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
            style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
            <Plus size={15} style={{ color: 'var(--accent)' }} />
            {!collapsed && 'New Chat'}
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              onClick={closeMobileDrawer}
              className={({ isActive }) => `
                flex items-center ${collapsed ? 'justify-center gap-0 px-2.5' : 'gap-3 px-3'} py-2.5 rounded-xl text-sm transition-all duration-150
                ${isActive
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-200)]'}
              `}>
              {({ isActive }) => (
                <>
                  <Icon size={15} style={isActive ? { color: 'var(--accent)' } : {}} />
                  {!collapsed && label}
                  {!collapsed && isActive && <ChevronRight size={12} className="ml-auto" style={{ color: 'var(--accent)' }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Chat history */}
        {!collapsed && sessions.length > 0 && (
          <div className="mt-4 px-3 flex-1 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] px-2 mb-2">Recent Chats</p>
            <div className="space-y-0.5">
              {sessions.slice(0, 20).map(s => (
                <motion.div key={s.id} layout
                  onClick={() => { setActive(s.id); navigate('/chat'); closeMobileDrawer(); }}
                  className={`
                    group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm transition-all
                    ${activeId === s.id
                      ? 'bg-[var(--surface-200)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-100)] hover:text-[var(--text-primary)]'}
                  `}>
                  <MessageSquare size={12} className="shrink-0 opacity-50" />
                  {editingId === s.id ? (
                    <input
                      autoFocus value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-transparent text-xs outline-none"
                    />
                  ) : (
                    <span className="flex-1 truncate text-xs">{s.title}</span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => startEdit(e, s)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                      className="text-[var(--text-muted)] hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`p-4 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] ${collapsed ? 'text-center' : ''}`}>
          <p>{collapsed ? 'O·C·R' : 'Ollama · ChromaDB · RAG'}</p>
          {!collapsed && <p className="mt-0.5">Private · Local · Secure</p>}
        </div>
      </motion.aside>
    </>
  );
}
