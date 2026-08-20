import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  BookOpenCheck,
  BarChart3,
  Award,
} from 'lucide-react';
import Badge from '../components/common/Badge';
import logoImg from '../assets/images/logo.png';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, badge: null },
  { to: '/admin/members', label: 'All Members', icon: Users, badge: '277' },
  { to: '/admin/projects', label: 'All Projects', icon: FolderKanban, badge: null },
  { to: '/admin/publications', label: 'Publications Queue', icon: FileText, badge: '12' },
  { to: '/admin/support', label: 'Support Requests', icon: ShieldCheck, badge: '8' },
  { to: '/admin/messages', label: 'Member Messages', icon: MessageSquare, badge: '5' },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3, badge: null },
  { to: '/admin/awards', label: 'Credentials & IDs', icon: Award, badge: null },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loc = useLocation();
  const currentPage = navItems.find((n) =>
    n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)
  );

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <div
        className={`fixed inset-0 z-40 bg-forum-900/50 backdrop-blur-sm lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-gradient-to-b from-forum-900 to-forum-950 text-forum-100 transition-transform lg:translate-x-0 lg:static lg:inset-auto lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-forum-700">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="IFSMHP Logo"
              className="h-9 w-9 rounded-md object-contain bg-white p-0.5 ring-2 ring-brass-500/30"
            />
            <div className="leading-tight">
              <span className="block font-display text-base font-semibold text-white">
                CRO Admin
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-brass-100/80">
                Chief Research Office
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-forum-200/70 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-forum-700">
          <div className="rounded-xl bg-forum-800/60 ring-1 ring-brass-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brass-500 text-white font-bold shadow-lg shadow-brass-500/20">
                CRO
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm">
                  Office of the CRO
                </p>
                <Badge variant="brass">
                  <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                  Admin Role
                </Badge>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-forum-700/50">
              <div className="flex items-center gap-1.5 text-[11px] text-forum-200/70">
                <span className="h-2 w-2 rounded-full bg-success-100 border border-success-600/30" />
                42 members online
              </div>
              <button className="text-[11px] text-brass-100 hover:text-white font-medium inline-flex items-center gap-1">
                View all
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <nav className="p-3 overflow-y-auto h-[calc(100%-18rem)] space-y-1">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-forum-200/40">
            Administration
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-brass-500/20 to-forum-700/50 text-white shadow-sm border border-brass-500/20'
                      : 'text-forum-100/80 hover:bg-forum-800 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-bold text-white shadow">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-forum-700 p-4 bg-forum-900">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-forum-100/70 hover:bg-forum-800 hover:text-white transition-colors"
            onClick={() => (window.location.href = '/login')}
          >
            <LogOut className="h-4.5 w-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-paper-border bg-paper-raised/95 backdrop-blur-sm">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-700"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-display font-semibold text-forum-900">
                  {currentPage?.label || 'Admin Dashboard'}
                </h1>
                <p className="text-xs text-ink-subtle">
                  Chief Research Officer Console · <span className="text-brass-700 font-medium">Elevated permissions</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative inline-flex items-center justify-center rounded-md h-9 w-9 text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-brass-500 ring-2 ring-paper-raised" />
              </button>
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                Member View
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
