import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, MemoryStick, Network, Waves, Server } from 'lucide-react';
import { getNodes, getAutoscalingStatus } from '../services/api';

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