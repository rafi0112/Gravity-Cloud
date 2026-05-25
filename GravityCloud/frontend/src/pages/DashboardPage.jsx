import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cpu, MessageSquare, FileText, Database, Server,
  Zap, Shield, Globe, ArrowRight, Activity
} from 'lucide-react';
import { getHealth, getDbStatus, getNodes, getServicesStatus, getAutoscalingStatus } from '../services/api';
import { useChatStore } from '../context/chatStore';

const FEATURES = [
  { icon: MessageSquare, title: 'RAG-Powered Chat', desc: 'Ask questions over your documents with context-aware AI responses.' },
  { icon: FileText, title: 'PDF Intelligence', desc: 'Upload and index PDFs into your private vector database instantly.' },
  { icon: Database, title: 'ChromaDB Storage', desc: 'Local semantic vector store. Your data never leaves your infrastructure.' },
  { icon: Shield, title: 'Fully Private', desc: 'Runs entirely on-premise. No cloud APIs, no data leakage.' },
  { icon: Zap, title: 'Ollama LLM', desc: 'Local large language models with near-zero latency.' },
  { icon: Globe, title: 'Multi-Node Gateway', desc: 'Edge-capable architecture designed for distributed deployments.' },
];

function StatCard({ label, value, sub, color, className = '' }) {
  return (
    <div className={`rounded-2xl p-5 min-w-0 ${className}`} style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">{label}</p>
      <p className="text-2xl font-bold break-words leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

function formatPercent(value) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(3)}%` : '0.000%';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { sessions, createSession } = useChatStore();
  const [health, setHealth] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [services, setServices] = useState(null);
  const [autoscaling, setAutoscaling] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      getHealth().then(r => !cancelled && setHealth(r.data)).catch(() => !cancelled && setHealth({ status: 'offline' }));
      getDbStatus().then(r => !cancelled && setDbStatus(r.data)).catch(() => !cancelled && setDbStatus(null));
      getNodes().then(r => !cancelled && setNodes(r.data)).catch(() => !cancelled && setNodes(null));
      getServicesStatus().then(r => !cancelled && setServices(r.data)).catch(() => !cancelled && setServices(null));
      getAutoscalingStatus().then(r => !cancelled && setAutoscaling(r.data)).catch(() => !cancelled && setAutoscaling(null));
    };

    refresh();
    const intervalId = setInterval(refresh, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const startChat = () => {
    const id = createSession();
    navigate('/chat');
  };

  const totalMsgs = sessions.reduce((a, s) => a + s.messages.length, 0);
  const onlineServices = services ? Object.values(services).filter(s => s.status === 'online').length : 0;
  const totalServices = services ? Object.keys(services).length : 0;
  const metrics = nodes?.metrics ?? {};
  const activeModel = health?.chat_model ?? health?.active_model ?? 'live model unavailable';
  const queuePending = health?.queue_pending ?? 0;
  const activeRequests = health?.active_requests ?? 0;
  const connectedDevices = health?.connected_devices ?? 0;
  const currentReplicas = health?.autoscaling?.current_replicas ?? autoscaling?.current_replicas ?? 1;
  const desiredReplicas = health?.autoscaling?.desired_replicas ?? autoscaling?.desired_replicas ?? currentReplicas;
  const autoscalingEvents = health?.autoscaling?.events ?? autoscaling?.events ?? [];
  const queueService = services?.['queue-service']?.detail ?? null;
  const provenance = health?.provenance ?? nodes?.provenance ?? {};
  const connectedClients = queueService?.connected_clients ?? [];

  return (
    <div className="min-h-full px-4 py-5 sm:p-6 mesh-bg">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
            <Activity size={11} />
            Private AI Cloud · Local Deployment
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4 leading-tight">
            Your{' '}
            <span className="gradient-text">Intelligence</span>
            <br />Infrastructure
          </h1>
          <p className="text-base text-[var(--text-secondary)] max-w-xl mb-7 leading-relaxed">
            A self-hosted AI cloud platform with RAG, semantic search, and document intelligence.
            Everything runs locally — complete privacy guaranteed.
          </p>
          <div className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={startChat}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'var(--accent)', boxShadow: '0 0 24px rgba(var(--accent-rgb),0.4)' }}
            >
              Start Chatting <ArrowRight size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--text-primary)] transition-all"
              style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
            >
              Upload Documents
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 mb-10"
        >
          <StatCard label="Gateway" value={health?.status === 'ok' ? (health.display_status ?? 'Online') : health ? 'Offline' : '...'} sub="API Orchestrator" color={health?.status === 'ok' ? '#10b981' : '#f43f5e'} />
          <StatCard label="Services" value={services ? `${onlineServices}/${totalServices}` : '...'} sub="Online services" color="var(--accent)" />
          <StatCard label="Chat model" value={activeModel} sub="Used for prompts and answers" color="var(--accent)" className="xl:col-span-2" />
          <StatCard label="Queue" value={queuePending} sub="Pending requests" color="var(--accent)" />
          <StatCard label="Vector DB" value={dbStatus ? (dbStatus.is_empty ? 'Ready' : 'Active') : '–'} sub={`${dbStatus?.total_chunks ?? 0} chunks`} color="var(--accent)" />
          <StatCard label="Chat Sessions" value={sessions.length} sub="Stored locally" color="var(--accent)" />
          <StatCard label="Messages" value={totalMsgs} sub="Total exchanged" color="var(--accent)" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-10"
        >
          <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Infrastructure Snapshot</h2>
                <p className="text-sm text-[var(--text-muted)]">Live host metrics from the gateway node</p>
              </div>
              <Activity size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">CPU</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{formatPercent(metrics.cpu_percent)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Memory</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{formatPercent(metrics.memory_percent)}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Requests</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{metrics.requests_served ?? 0}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">GPU</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{metrics.gpu ?? 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Queue Monitor</h2>
            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Queue Pending</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{queuePending}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Active Requests</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{activeRequests}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Connected Devices</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{connectedDevices}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Gateway Replicas</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{currentReplicas}</div>
              </div>
            </div>
            <div className="text-sm text-[var(--text-secondary)] space-y-2">
              <p>Pending means queued or currently in flight, not total connected devices.</p>
              <p>Services are container-isolated and communicate through Docker DNS.</p>
              <p>Use the Nodes page for service health and host metrics.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="mb-10"
        >
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Live Queue Service</h2>
                <p className="text-sm text-[var(--text-muted)]">Real-time job depth from the SQLite-backed queue service</p>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${queueService ? 'text-emerald-400' : 'text-rose-400'}`} style={{ background: 'var(--surface-200)' }}>
                {queueService ? queueService.status : 'offline'}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              {[
                ['Pending', queueService?.queue_pending ?? queuePending],
                ['Queued', queueService?.queued ?? 0],
                ['Processing', queueService?.processing ?? 0],
                ['Completed', queueService?.completed ?? 0],
                ['Failed', queueService?.failed ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-[var(--text-muted)]">
              {queueService?.pending_jobs?.length
                ? `${queueService.pending_jobs.length} active job${queueService.pending_jobs.length === 1 ? '' : 's'} waiting or processing`
                : 'No jobs are waiting right now.'}
            </div>

            <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">Connected Devices</div>
              {connectedClients.length ? (
                <div className="flex flex-wrap gap-2">
                  {connectedClients.map((clientId) => (
                    <span
                      key={clientId}
                      className="text-[11px] px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--text-primary)' }}
                      title={clientId}
                    >
                      {clientId.slice(0, 8)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--text-muted)]">No active devices in the current window.</div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }}
          className="mb-8"
        >
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Autoscaling Events</h2>
                <p className="text-sm text-[var(--text-muted)]">Scheduler monitors load and scales gateway replicas with cooldown protection</p>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${autoscaling?.status === 'scaled' ? 'text-emerald-400' : autoscaling?.status === 'error' ? 'text-rose-400' : 'text-sky-400'}`} style={{ background: 'var(--surface-200)' }}>
                {autoscaling?.status ?? 'watching'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm mb-4">
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Desired Replicas</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{desiredReplicas}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Current Replicas</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{currentReplicas}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Last Action</div>
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{autoscaling?.last_scale_action ?? 'none yet'}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Cooldown</div>
                <div className="text-2xl font-semibold text-[var(--text-primary)]">{autoscaling?.cooldown_seconds ?? 30}s</div>
              </div>
            </div>

            <div className="text-sm text-[var(--text-secondary)] mb-4">
              {autoscaling?.last_reason ?? 'The scheduler is waiting for queue pressure or connected devices to cross a threshold.'}
            </div>

            <div className="space-y-2">
              {(autoscalingEvents.length > 0 ? autoscalingEvents : []).slice(0, 3).map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className="rounded-xl px-4 py-3 flex items-start justify-between gap-4" style={{ background: 'var(--surface-200)' }}>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{event.action}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{event.message}</div>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{event.timestamp}</div>
                </div>
              ))}
              {autoscalingEvents.length === 0 && (
                <div className="rounded-xl px-4 py-3 text-sm text-[var(--text-muted)]" style={{ background: 'var(--surface-200)' }}>
                  No scaling events yet. The scheduler will emit them when queue pressure rises.
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Live Metrics Dashboards</h2>
                <p className="text-sm text-[var(--text-muted)]">Real-time Grafana dashboards embedded — queue, autoscaling, and gateway performance</p>
              </div>
              <Database size={18} style={{ color: 'var(--accent)' }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{ background: 'var(--surface-200)' }}
              >
                <div className="text-[10px] uppercase tracking-widest text-[var(--accent)] mb-1 font-semibold">Full Grafana</div>
                <div className="text-base font-medium text-[var(--text-primary)]">Open Grafana (localhost:3001)</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Full dashboard editor and all visualizations</div>
              </a>
              <a
                href="http://localhost:9090"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{ background: 'var(--surface-200)' }}
              >
                <div className="text-[10px] uppercase tracking-widest text-[var(--accent)] mb-1 font-semibold">Prometheus</div>
                <div className="text-base font-medium text-[var(--text-primary)]">Open Prometheus (localhost:9090)</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Raw metrics and PromQL queries</div>
              </a>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <iframe
                  src="http://localhost:3001/d/636505d4-d8cf-408c-bbe4-6bfa17ac3c8f/queue-and-load-metrics?orgId=1&kiosk=tv&refresh=5s"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  style={{ display: 'block' }}
                  title="Queue and Load Metrics Dashboard"
                  allowFullScreen
                />
              </div>

              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <iframe
                  src="http://localhost:3001/d/2b9f4923-b9a7-4968-a9a0-9217c1a6677d/autoscaling-and-gateway-metrics?orgId=1&kiosk=tv&refresh=5s"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  style={{ display: 'block' }}
                  title="Autoscaling and Gateway Metrics Dashboard"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2 p-3 rounded-xl mt-4" style={{ background: 'var(--surface-200)' }}>
              <p><strong>Queue & Load Metrics:</strong> Shows queue pending, active requests, connected devices, and queue trends over time.</p>
              <p><strong>Autoscaling & Gateway Metrics:</strong> Displays current/desired gateway replicas, scheduler state, and replica count trends.</p>
              <p><strong>Data Source:</strong> Prometheus scrapes /metrics endpoints from gateway, queue, scheduler, and ollama services every 5 seconds.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">Service Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {services ? Object.entries(services).map(([name, service]) => (
              <div key={name} className="rounded-2xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
                  <span className={`text-xs font-semibold ${service.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {service.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">{service.url}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 truncate">{typeof service.detail === 'object' ? 'Healthy response received' : service.detail}</p>
              </div>
            )) : (
              <div className="text-sm text-[var(--text-muted)]">Service health unavailable.</div>
            )}
          </div>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">Platform Capabilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="p-5 rounded-2xl group hover:scale-[1.02] transition-transform cursor-default"
                style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-all
                  group-hover:scale-110"
                  style={{ background: 'rgba(var(--accent-rgb),0.15)' }}>
                  <Icon size={17} style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">{title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stack info */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          className="rounded-2xl p-5 flex flex-wrap gap-3"
          style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
        >
          {['React', 'FastAPI Gateway', 'Ollama Service', 'Vector Service', 'Embedding Service', 'Docker', 'Docker DNS'].map(t => (
            <span key={t} className="text-xs px-3 py-1 rounded-full font-medium"
              style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>
              {t}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-4 rounded-2xl p-5"
          style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Data origin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              ['Gateway status', provenance.status ?? 'live'],
              ['Chat model', provenance.active_model ?? 'live Ollama chat model selection'],
              ['Embedding model', provenance.embedding_model ?? 'live Ollama embedding model selection'],
              ['Queue count', provenance.queue_pending ?? 'live queue service depth'],
              ['Service health', provenance.services ?? 'live HTTP health checks'],
              ['Host metrics', provenance.metrics ?? 'live host metrics from psutil'],
              ['Chat sessions', 'browser localStorage'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 rounded-xl px-3 py-2" style={{ background: 'var(--surface-200)' }}>
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="text-[var(--text-primary)] text-right">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate('/nodes')}
            className="text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-100)', color: 'var(--text-primary)' }}
          >
            View Nodes
          </button>
        </div>

      </div>
    </div>
  );
}
