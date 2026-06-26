import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Badge } from '../components/Badge';
import { useNotifications } from '../hooks/useNotifications';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Percent,
  CheckSquare,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react';

interface SidebarItem {
  id: string; // Tab identifier
  label: string;
  icon: React.ComponentType<any>;
}

interface DashboardLayoutProps {
  id?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  pendingCount?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  id,
  activeTab,
  setActiveTab,
  children,
  pendingCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead, refresh: fetchNotifications } = useNotifications();

  if (!user) return null;

  // Define sidebar navigation items based on the user's role
  const getNavItems = (): SidebarItem[] => {
    switch (user.role) {
      case 'admin':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
          { id: 'audit_log', label: 'Audit Log', icon: History },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
      case 'manager':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      case 'agent':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      case 'subagent':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'My Transactions', icon: ArrowLeftRight },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      case 'direct_agent':
        return [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'team', label: 'My Team', icon: Users },
          { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
          { id: 'commissions', label: 'Commissions', icon: Percent },
          { id: 'verifications', label: 'Verifications', icon: CheckSquare },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();
  const activeItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const timeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Shared Sidebar contents (renders desktop and mobile)
  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-white">
      {/* Brand area */}
      <div className="p-4 flex items-center border-b border-[#E2E8F0] shrink-0">
        <img src="/logo.jpeg" alt="Zimplexline" className="h-10 w-auto object-contain" />
      </div>

      {/* User profile section */}
      <div className="p-4 flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] select-none">
        <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white font-semibold text-sm">
          {getInitials(user.fullName)}
        </div>
        <div>
          <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider leading-none">
            {user.role}
          </p>
          <p className="text-sm font-semibold text-[#0F172A] mt-1 leading-tight">
            {user.fullName}
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-[#F1F5F9] text-[#0F172A]'
                  : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
              {item.id === 'verifications' && pendingCount > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-bold rounded-full font-mono">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout container footer */}
      <div className="p-4 border-t border-[#E2E8F0] shrink-0">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2 text-[#64748B] hover:text-[#EF4444] transition-colors font-medium text-sm"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div id={id} className="min-h-screen bg-[#F1F5F9] text-[#334155] font-sans flex overflow-hidden">
      {/* Off-canvas mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-45 lg:hidden">
          {/* Backdrop screen overlay */}
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Dialog Panel drawer */}
          <div className="fixed inset-y-0 left-0 w-60 z-50 shadow-2xl transition-transform duration-300">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Desktop static Sidebar */}
      <aside className="hidden lg:block w-60 border-r border-[#E2E8F0] shrink-0 bg-white">
        <div className="sticky top-0 h-screen flex flex-col">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Main Right Area wrapper */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 shrink-0 select-none">
          {/* Mobile hamburger toggler */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100 transition"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-[#0F172A]">
              {activeItem ? activeItem.label : 'Dashboard'}
            </h2>
          </div>

          {/* User badge and actions */}
          <div className="flex items-center gap-4">
            {/* Notification bell with dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIsNotifOpen(!isNotifOpen); if (!isNotifOpen) fetchNotifications(); }}
                className="rounded-full p-2 text-[#64748B] hover:bg-slate-50 hover:text-slate-600 transition relative"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-[10px] font-bold text-blue-600 hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifLoading ? (
                        <div className="py-8 text-center text-xs text-slate-400">Loading…</div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">No notifications yet.</div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={async () => {
                              if (!notif.is_read) await markAsRead(notif.id);
                              setIsNotifOpen(false);
                              if (notif.sender_id) navigate(`/admin/users/${notif.sender_id}/transactions`);
                            }}
                            className={`cursor-pointer px-4 py-3 hover:bg-slate-50 transition ${!notif.is_read ? 'border-l-2 border-blue-500 bg-blue-50/30' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-xs leading-tight ${!notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                {notif.title}
                              </p>
                              <span className="text-[9px] text-slate-400 shrink-0 font-mono">{timeAgo(notif.created_at)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-slate-100 px-4 py-2 bg-slate-50">
                      <p className="text-[9px] text-slate-400 text-center font-mono">In-app notifications only</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="h-8 w-[1px] bg-[#E2E8F0]"></div>

            {/* Avatar block circle */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B82F6] text-white text-xs font-semibold">
                {getInitials(user.fullName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-[#0F172A] leading-none">{user.fullName}</p>
                <p className="text-[10px] text-[#64748B] mt-1 font-mono leading-none uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard inner background */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#F1F5F9]">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
