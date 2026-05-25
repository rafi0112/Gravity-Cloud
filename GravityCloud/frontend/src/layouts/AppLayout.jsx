import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';

const TITLES = {
  '/': 'Dashboard',
  '/nodes': 'Nodes',
  '/chat': 'AI Chat',
  '/documents': 'Documents',
  '/settings': 'Settings',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-900)' }}>
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen(v => !v)}
          onSidebarToggle={() => setSidebarCollapsed(v => !v)}
          sidebarCollapsed={sidebarCollapsed}
          title={TITLES[pathname] ?? 'Gravity Cloud'}
        />
        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
