import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import {
  Activity,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Clock,
} from 'lucide-react';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenChat,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPortalBadge = () => {
    switch (user.role) {
      case 'patient':
        return {
          title: 'Patient Portal',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: UserIcon,
        };
      case 'nurse':
        return {
          title: 'Staff & Triage Nurse Portal',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Activity,
        };
      case 'doctor':
        return {
          title: 'Physician Clinical Portal',
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
          icon: Stethoscope,
        };
    }
  };

  const portalBadge = getPortalBadge();
  const IconComponent = portalBadge.icon;

  return (
    <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-40 shadow-xs backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-sm text-white">
              <HeartPulse className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  ER<span className="text-sky-600">Vision</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                  Hospital OS
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Emergency Care & Hospital Intelligence Ecosystem
              </p>
            </div>
          </div>

          {/* Active Portal Badge (Protected & Role-Bound) */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold select-none ${portalBadge.badgeClass}`}
            title={`Active authenticated session: ${portalBadge.title}`}
          >
            <IconComponent className="h-3.5 w-3.5" />
            <span>{portalBadge.title}</span>
          </div>

          {/* Right Side: Clock, User Profile & Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Clock */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/80">
              <Clock className="h-3.5 w-3.5 text-sky-600" />
              <span className="font-mono">{currentTime}</span>
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase">
                {user.name.slice(0, 2)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <span>{user.name}</span>
                  {user.role === 'doctor' && (
                    <ShieldCheck className="h-3 w-3 text-sky-600 inline" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  <span className="capitalize">{user.role}</span>
                  {user.specialty && <span> · {user.specialty}</span>}
                  {user.department && <span> · {user.department}</span>}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors"
              title="Safely log out"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
