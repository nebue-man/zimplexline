import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import { useVerifications } from '../../hooks/useVerifications';
import { DashboardLayout } from '../../layouts/DashboardLayout';

// Sub-dashboards import
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import AgentDashboard from './AgentDashboard';
import SubagentDashboard from './SubagentDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: pendingVerifications, refresh: refreshVerifs } = useVerifications();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch verifications count on interval or load to synchronize notifications indicator
  useEffect(() => {
    if (user) {
      refreshVerifs();
    }
  }, [user, activeTab, refreshVerifs]);

  const pendingCount = pendingVerifications?.length || 0;

  const renderRoleDashboard = () => {
    if (!user) return null;

    switch (user.role) {
      case 'admin':
        return <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'manager':
        return <ManagerDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'agent':
        return <AgentDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      case 'subagent':
        return <SubagentDashboard activeTab={activeTab} setActiveTab={setActiveTab} />;
      default:
        return (
          <div className="flex h-[320px] items-center justify-center rounded-xl bg-white p-6 border text-slate-500 text-sm font-mono">
            Role "{user.role}" is not recognized or matching routing pathways.
          </div>
        );
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount}>
      {renderRoleDashboard()}
    </DashboardLayout>
  );
}
