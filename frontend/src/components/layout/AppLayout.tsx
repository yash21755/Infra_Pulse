import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Map as MapIcon, PlusCircle, BarChart3, Bell, User, Settings, LogOut, Menu } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

export const AppLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    auth?.logout();
    navigate('/');
  };

  const navItems = [
    { to: '/feed', icon: Home, label: 'Feed' },
    { to: '/map', icon: MapIcon, label: 'Map View' },
    { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/profile', icon: User, label: 'Profile' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-body overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-full">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">IP</div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">Infra_Pulse</span>
        </div>
        
        <div className="px-4 pb-4">
          <NavLink to="/report" className="flex items-center gap-3 bg-brand-600 text-white px-4 py-3 rounded-xl font-medium shadow-sm hover:bg-brand-700 transition-colors">
            <PlusCircle size={20} />
            Report Issue
          </NavLink>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl font-medium transition-colors">
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Topbar */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">IP</div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 p-3 shrink-0 pb-safe">
          <NavLink to="/feed" className={({isActive}) => `p-2 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}><Home size={24}/></NavLink>
          <NavLink to="/map" className={({isActive}) => `p-2 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}><MapIcon size={24}/></NavLink>
          <NavLink to="/report" className="p-3 bg-brand-600 text-white rounded-full shadow-md -mt-8"><PlusCircle size={24}/></NavLink>
          <NavLink to="/dashboard" className={({isActive}) => `p-2 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}><BarChart3 size={24}/></NavLink>
          <NavLink to="/profile" className={({isActive}) => `p-2 ${isActive ? 'text-brand-600' : 'text-slate-400'}`}><User size={24}/></NavLink>
        </nav>
      </main>
    </div>
  );
};