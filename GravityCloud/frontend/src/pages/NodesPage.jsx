import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, MemoryStick, Network, Waves, Server, Radio, Wifi, WifiOff, GitBranch } from 'lucide-react';
import { getNodes, getAutoscalingStatus, getEdgeNodes } from '../services/api';

// ─── Shared helpers ────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs uppercase tracking-[0.18em] mb-3">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold text-[var(--text-primary)] break-words leading-tight">{value}</div>
      {sub && <div className="text-xs text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

function formatPercent(value) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(3)}%` : '0.000%';
}

function ServiceRow({ service }) {
  const online = service.status === 'online';

  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--surface-200)' }}>
      <div>
        <div className="font-medium text-[var(--text-primary)]">{service.name}</div>
        <div className="text-xs text-[var(--text-muted)] truncate max-w-[240px]">{service.url}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${online ? 'text-emerald-400' : 'text-rose-400'}`}>
          {online ? 'Online' : 'Offline'}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{online ? 'Healthy' : 'Needs attention'}</div>
      </div>
    </div>
  );
}

// ─── Edge Node Card ────────────────────────────────────────────────────────

function EdgeNodeCard({ node, isLastSelected }) {
  const isLocal = node.type === 'local';
  const healthy = node.healthy;
  const isActive = node.active_requests > 0;

  // Border colour: selected = accent, healthy = green, offline = red
  const borderColor = isLastSelected
    ? 'rgba(var(--accent-rgb),0.6)'
    : healthy
    ? 'rgba(52,211,153,0.35)'
    : 'rgba(248,113,113,0.4)';

  const badgeBg = isLastSelected
    ? 'rgba(var(--accent-rgb),0.15)'
    : healthy
    ? 'rgba(52,211,153,0.12)'
    : 'rgba(248,113,113,0.12)';

  const badgeColor = isLastSelected
    ? 'var(--accent)'
    : healthy
    ? '#34d399'
    : '#f87171';

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300"
      style={{
        background: 'var(--surface-200)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: isLastSelected ? `0 0 18px rgba(var(--accent-rgb),0.12)` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLocal
            ? <Server size={15} style={{ color: 'var(--accent)' }} />
            : <Radio size={15} style={{ color: healthy ? '#34d399' : '#f87171' }} />}
          <span className="font-semibold text-sm text-[var(--text-primary)] uppercase tracking-wide">
            {isLocal ? 'Local Node' : 'Remote Node'}
          </span>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {healthy ? (isActive ? 'Active' : 'Healthy') : 'Offline'}
        </span>
      </div>

      {/* Node ID & URL */}
      <div>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-[0.16em] mb-0.5">Node ID</div>
        <div className="text-sm font-mono text-[var(--text-primary)]">{node.id}</div>
      </div>
      <div>
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-[0.16em] mb-0.5">Endpoint</div>
        <div className="text-xs font-mono text-[var(--text-secondary)] break-all">{node.url}</div>
      </div>

      {/* Metrics row */}
      <div className="flex gap-3 mt-1">
        <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'var(--surface-100)' }}>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Active Req</div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">{node.active_requests}</div>
        </div>
        <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'var(--surface-100)' }}>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Status</div>
          <div className={`text-sm font-semibold ${healthy ? 'text-emerald-400' : 'text-rose-400'}`}>
            {healthy ? <Wifi size={16} className="inline" /> : <WifiOff size={16} className="inline" />}
          </div>
        </div>
      </div>

      {/* Selected badge */}
      {isLastSelected && (
        <div
          className="text-center text-xs font-semibold py-1.5 rounded-xl tracking-wider"
          style={{ background: 'rgba(var(--accent-rgb),0.18)', color: 'var(--accent)' }}
        >
          ✦ LAST REQUEST ROUTED HERE
        </div>
      )}
    </div>
  );
}

// ─── Edge Nodes Panel ──────────────────────────────────────────────────────

function EdgeNodesPanel() {
  const [edgeData, setEdgeData] = useState(null);

  const refresh = useCallback(() => {
    getEdgeNodes()
      .then((r) => setEdgeData(r.data))
      .catch(() => setEdgeData(null));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000); // poll every 5 s
    return () => clearInterval(timer);
  }, [refresh]);

  const nodes = edgeData?.nodes ?? [];
  const selectedId = edgeData?.selected_node;
  const reason = edgeData?.last_reason;
  const mode = edgeData?.mode ?? 'single-node';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.0 }}
      className="rounded-3xl p-5 mb-6"
      style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Edge Inference Nodes</h2>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: mode === 'multi-node' ? 'rgba(var(--accent-rgb),0.14)' : 'rgba(156,163,175,0.14)',
                color: mode === 'multi-node' ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {mode}
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Automatic routing — node selection is invisible to the user. This panel shows live state.
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: 'var(--surface-200)' }}
        >
          Refresh
        </button>
      </div>

      {/* Node cards */}
      {nodes.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)] px-4 py-3 rounded-xl" style={{ background: 'var(--surface-200)' }}>
          No edge-node data available yet. Send a chat request to initialize.
        </div>
      ) : (
        <div className={`grid gap-4 ${nodes.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
          {nodes.map((node) => (
            <EdgeNodeCard key={node.id} node={node} isLastSelected={node.id === selectedId} />
          ))}
        </div>
      )}

      {/* Last routing decision */}
      {selectedId && (
        <div
          className="mt-4 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{ background: 'var(--surface-200)', border: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Last Request Routed To</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] font-mono">{selectedId}</div>
          </div>
          {reason && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Reason</div>
              <div className="text-xs text-[var(--text-secondary)]">{reason}</div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function NodesPage() {
  const [nodes, setNodes] = useState(null);
  const [autoscaling, setAutoscaling] = useState(null);

  useEffect(() => {
    getNodes()
      .then((response) => setNodes(response.data))
      .catch(() => setNodes(null));
    getAutoscalingStatus()
      .then((response) => setAutoscaling(response.data))
      .catch(() => setAutoscaling(null));
  }, []);

  const metrics = nodes?.metrics ?? {};
  const services = nodes?.services ?? [];
  const provenance = nodes?.provenance ?? {};

  return (
    <div className="min-h-full px-4 py-5 sm:p-6 mesh-bg">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5" style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
            <Network size={11} />
            Infrastructure Nodes
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-3">Service Health Overview</h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">Live gateway metrics, service reachability, and node-level runtime health for the current microservice stack.</p>
        </motion.div>

        {/* ── Edge Nodes Visualization (NEW) ── */}
        <EdgeNodesPanel />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <MetricCard icon={Cpu} label="CPU" value={formatPercent(metrics.cpu_percent)} sub="Gateway host utilization" />
          <MetricCard icon={MemoryStick} label="Memory" value={formatPercent(metrics.memory_percent)} sub={`${metrics.memory_used_mb ?? 0} MB used of ${metrics.memory_total_mb ?? 0} MB`} />
          <MetricCard icon={Activity} label="Requests" value={metrics.requests_served ?? 0} sub="Gateway requests handled" />
          <MetricCard icon={Waves} label="GPU" value={metrics.gpu ?? 'Unavailable'} sub="Reported by gateway node" />
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-3xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Container Status</h2>
                <p className="text-sm text-[var(--text-muted)]">Gateway and backend service reachability</p>
              </div>
              <Server size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="space-y-3">
              {services.length > 0 ? services.map((service) => (
                <ServiceRow key={service.name} service={service} />
              )) : (
                <div className="rounded-xl px-4 py-3 text-sm text-[var(--text-muted)]" style={{ background: 'var(--surface-200)' }}>
                  No service data available.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-3xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Queue Monitor</h2>
            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Pending AI Requests</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{autoscaling?.queue_pending ?? 0}</div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: 'var(--surface-200)' }}>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Connected Devices</div>
                <div className="text-3xl font-semibold text-[var(--text-primary)]">{autoscaling?.connected_devices ?? 0}</div>
              </div>
            </div>
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--surface-200)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Autoscaling Status</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{autoscaling?.status ?? 'watching'}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Gateway replicas: {autoscaling?.current_replicas ?? 1} of {autoscaling?.desired_replicas ?? 1}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface-200)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-2">Node Notes</div>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>Scheduler watches queue depth and connected devices every 5 seconds.</li>
                <li>Gateway replicas scale between 1 and 3 for the exam demo.</li>
                <li>Ollama remains a single shared runtime to keep the demo stable.</li>
              </ul>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 rounded-3xl p-5" style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">How this page is built</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Host metrics</div>
              <div className="text-[var(--text-primary)]">{provenance.metrics ?? 'live host metrics from psutil on the gateway container host'}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Requests served</div>
              <div className="text-[var(--text-primary)]">{provenance.requests_served ?? 'in-process counter since gateway start'}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-200)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">Service checks</div>
              <div className="text-[var(--text-primary)]">{provenance.services ?? 'live HTTP health checks'}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}