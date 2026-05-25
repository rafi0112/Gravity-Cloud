import { motion } from 'framer-motion';
import { Sun, Moon, Palette, Server, Trash2, Cpu, Database, Network, Activity } from 'lucide-react';
import { useThemeStore, ACCENTS } from '../context/themeStore';
import { useChatStore } from '../context/chatStore';
import { useDocStore } from '../context/docStore';
import { getHealth, getDbStatus, getNodes, getServicesStatus } from '../services/api';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const ACCENT_META = {
  blue:    { label: 'Ocean Blue',    hex: '#3b82f6' },
  purple:  { label: 'Violet Surge',  hex: '#a855f7' },
  emerald: { label: 'Emerald Pulse', hex: '#10b981' },
  rose:    { label: 'Rose Bloom',    hex: '#f43f5e' },
  orange:  { label: 'Amber Glow',    hex: '#f97316' },
};

function Section({ title, desc, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">{title}</h2>
      {desc && <p className="text-xs text-[var(--text-muted)] mb-4">{desc}</p>}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { dark, toggleDark, accent, setAccent } = useThemeStore();
  const { sessions } = useChatStore();
  const { docs } = useDocStore();
  const [health, setHealth] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [services, setServices] = useState(null);

  useEffect(() => {
    getHealth().then(r => setHealth(r.data)).catch(() => setHealth(null));
    getDbStatus().then(r => setDbStatus(r.data)).catch(() => setDbStatus(null));
    getNodes().then(r => setNodes(r.data)).catch(() => setNodes(null));
    getServicesStatus().then(r => setServices(r.data)).catch(() => setServices(null));
  }, []);

  const onlineServices = services ? Object.values(services).filter(s => s.status === 'online').length : 0;
  const totalServices = services ? Object.keys(services).length : 0;
  const serviceUrl = (name, fallback) => services?.[name]?.public_url ?? services?.[name]?.url ?? fallback;

  const clearAll = () => {
    if (!confirm('Clear all chat history and documents? This cannot be undone.')) return;
    useChatStore.getState().sessions.forEach(s => useChatStore.getState().deleteSession(s.id));
    useDocStore.getState().clearDocs();
    toast.success('All data cleared');
  };

  return (
    <div className="px-4 py-5 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)]">Customize your Gravity Cloud experience.</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance" desc="Control how Gravity Cloud looks.">
        {/* Dark / Light */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {dark ? <Moon size={16} style={{ color: 'var(--accent)' }} /> : <Sun size={16} style={{ color: 'var(--accent)' }} />}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Theme Mode</p>
              <p className="text-xs text-[var(--text-muted)]">{dark ? 'Dark mode active' : 'Light mode active'}</p>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${dark ? '' : ''}`}
            style={{ background: dark ? 'var(--accent)' : 'var(--surface-200)' }}
          >
            <motion.span
              animate={{ x: dark ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              style={{ left: 0 }}
            />
          </button>
        </div>

        {/* Accent */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={14} style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-medium text-[var(--text-primary)]">Accent Color</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map(a => {
              const meta = ACCENT_META[a];
              const active = accent === a;
              return (
                <motion.button
                  key={a}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setAccent(a)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`w-8 h-8 rounded-full transition-all
                    ${active ? 'ring-2 ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                    style={{
                      background: meta.hex,
                      ringColor: meta.hex,
                      ringOffsetColor: 'var(--surface-100)',
                      boxShadow: active ? `0 0 16px ${meta.hex}70` : 'none',
                    }}
                  />
                  <span className="text-[9px] text-[var(--text-muted)]">{meta.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Backend */}
      <Section title="Backend Configuration" desc="Connection settings for the FastAPI server.">
        <div className="space-y-3">
          {[
            { label: 'Gateway API', val: '/api' },
            { label: 'Ollama Service', val: serviceUrl('ollama-service', 'http://localhost:8001') },
            { label: 'Vector Service', val: serviceUrl('vector-service', 'http://localhost:8002') },
            { label: 'Embedding Service', val: serviceUrl('embedding-service', 'http://localhost:8003') },
            { label: 'Queue Service', val: serviceUrl('queue-service', 'http://localhost:8005') },
          ].map(({ label, val }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{label}</span>
              <code className="text-xs font-mono px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>
                {val}
              </code>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1"><Cpu size={11} /> Gateway</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{health?.status === 'ok' ? (health.display_status ?? 'Online') : 'Offline'}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1"><Database size={11} /> Vector DB</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{dbStatus ? `${dbStatus.total_chunks} chunks` : 'Unavailable'}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1"><Network size={11} /> Services</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{services ? `${onlineServices}/${totalServices}` : '...'}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1"><Activity size={11} /> Node</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{nodes?.node_name ?? 'gravitycloud-local-node'}</div>
          </div>
        </div>
      </Section>

      {/* Data */}
      <Section title="Data Management" desc="Manage your locally stored data.">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--text-primary)]">
              {sessions.length} sessions · {docs.length} documents
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Stored in browser localStorage</p>
          </div>
          <button
            onClick={clearAll}
            className="flex items-center justify-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors
              px-3 py-2 rounded-xl hover:bg-rose-400/10 w-full sm:w-auto"
          >
            <Trash2 size={12} /> Clear All Data
          </button>
        </div>
      </Section>

      {/* About */}
      <div className="text-center text-xs text-[var(--text-muted)] pb-4">
        <p>Gravity Cloud v1.0.0 · Private Distributed AI Cloud</p>
        <p className="mt-0.5">React · FastAPI · Ollama · ChromaDB · RAG</p>
      </div>
    </div>
  );
}
