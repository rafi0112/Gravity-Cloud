import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, Calendar, HardDrive, Database, Server, Activity } from 'lucide-react';
import FileUploadZone from '../components/upload/FileUploadZone';
import { useDocStore } from '../context/docStore';
import { clearDb, getDbStatus, getServicesStatus, getHealth } from '../services/api';
import toast from 'react-hot-toast';

function DocCard({ doc, onRemove }) {
  const date = new Date(doc.uploadedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const sizeMB = (doc.size / 1024 / 1024).toFixed(2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl group"
      style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
        <FileText size={16} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{doc.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <Calendar size={9} />{date}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
            <HardDrive size={9} />{sizeMB} MB
          </span>
        </div>
      </div>
      <button onClick={() => onRemove(doc.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-rose-400">
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
}

export default function DocumentsPage() {
  const { docs, removeDoc, clearDocs } = useDocStore();
  const [clearing, setClearing] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [services, setServices] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getDbStatus().then(r => setDbStatus(r.data)).catch(() => setDbStatus(null));
    getServicesStatus().then(r => setServices(r.data)).catch(() => setServices(null));
    getHealth().then(r => setHealth(r.data)).catch(() => setHealth(null));
  }, []);

  const onlineServices = services ? Object.values(services).filter(s => s.status === 'online').length : 0;
  const totalServices = services ? Object.keys(services).length : 0;

  const handleClearDb = async () => {
    if (!confirm('Clear the entire vector database? This cannot be undone.')) return;
    setClearing(true);
    try {
      await clearDb();
      clearDocs();
      toast.success('Vector database cleared');
    } catch {
      toast.error('Failed to clear database');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Document Library</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Upload PDFs to your private RAG vector database for intelligent Q&A.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
            <Server size={12} /> Gateway
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{health?.status === 'ok' ? (health.display_status ?? 'Online') : 'Offline'}</div>
          <div className="text-xs text-[var(--text-muted)]">API orchestration layer</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
            <Database size={12} /> Vector DB
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{dbStatus ? `${dbStatus.total_chunks} chunks` : 'Unavailable'}</div>
          <div className="text-xs text-[var(--text-muted)]">{dbStatus?.is_empty ? 'Ready for uploads' : 'Knowledge base populated'}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
            <Activity size={12} /> Services
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{services ? `${onlineServices}/${totalServices}` : '...'}</div>
          <div className="text-xs text-[var(--text-muted)]">Online service count</div>
        </div>
      </div>

      {/* Upload zone */}
      <div className="mb-8">
        <FileUploadZone />
      </div>

      {/* Indexed docs */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Indexed Documents
            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">({docs.length})</span>
          </h3>
          {docs.length > 0 && (
            <button
              onClick={handleClearDb}
              disabled={clearing}
              className="flex items-center justify-center gap-1.5 text-xs text-rose-400 hover:text-rose-300
                transition-colors px-3 py-2 rounded-lg hover:bg-rose-400/10 disabled:opacity-50 w-full sm:w-auto"
            >
              <Database size={12} />
              {clearing ? 'Clearing…' : 'Clear Vector DB'}
            </button>
          )}
        </div>

        {docs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 text-[var(--text-muted)] text-sm"
          >
            <FileText size={32} className="mx-auto mb-3 opacity-20" />
            <p>No documents indexed yet.</p>
            <p className="text-xs mt-1">Upload a PDF above to get started.</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {docs.map(doc => (
                <DocCard key={doc.id} doc={doc} onRemove={removeDoc} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
