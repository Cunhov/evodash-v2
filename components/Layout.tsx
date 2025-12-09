import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clearConfig, getStoredConfig } from '../services/storage';
import ConsoleLogger from './ConsoleLogger';
import { Server, Users, MessageSquare, Menu, X, Calendar, LayoutDashboard, Send, LogOut, Smartphone, Zap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Read config directly to determine theme
  const config = getStoredConfig();
  const provider = config?.provider || 'evolution';
  const isEvo = provider === 'evolution';

  // Theme Constants
  const theme = {
    title: isEvo ? 'EvoDash' : 'UazDash',
    titleGradient: isEvo ? 'from-emerald-400 to-teal-400' : 'from-violet-400 to-fuchsia-400',
    iconBg: isEvo ? 'bg-emerald-500' : 'bg-violet-500',
    activeLink: isEvo
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-lg shadow-violet-500/5',
    mobileActive: isEvo ? 'bg-emerald-600 text-white' : 'bg-violet-600 text-white'
  };

  const handleLogout = () => {
    if (window.confirm('Disconnect from your server?')) {
      clearConfig();
      navigate('/');
      window.location.reload();
    }
  };

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' }, // Added Dashboard link
    { icon: <Server size={20} />, label: 'Instances', path: '/instances' }, // Changed icon for Instances
    { icon: <Users size={20} />, label: 'Groups', path: '/groups' },
    { icon: <Send size={20} />, label: 'Messenger', path: '/send' },
    { icon: <Calendar size={20} />, label: 'Scheduler', path: '/scheduler' },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-950/50 backdrop-blur-xl shrink-0">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <div className={`p-2 rounded-lg ${theme.iconBg}`}>
            {isEvo ? <Smartphone className="text-white" size={24} /> : <Zap className="text-white" size={24} />}
          </div>
          <h1 className={`text-xl font-bold bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent`}>
            {theme.title}
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive
                  ? theme.activeLink
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
              `}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full z-50 bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded ${theme.iconBg}`}>
            {isEvo ? <Smartphone className="text-white" size={20} /> : <Zap className="text-white" size={20} />}
          </div>
          <span className="font-bold text-lg">{theme.title}</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-300">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900 md:hidden pt-20 px-4 overflow-y-auto">
          <nav className="space-y-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                   flex items-center space-x-3 px-4 py-4 rounded-xl text-lg
                   ${isActive ? theme.mobileActive : 'bg-slate-800 text-slate-300'}
                 `}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 px-4 py-4 w-full rounded-xl bg-slate-800 text-rose-400 mt-8"
            >
              <LogOut size={20} />
              <span>Disconnect Server</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden md:pt-0 pt-16 relative">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pr-16 md:pr-12 min-h-full">
          {children}
        </div>
      </main>

      {/* Global Console Logger */}
      <ConsoleLogger />
    </div>
  );
};

export default Layout;