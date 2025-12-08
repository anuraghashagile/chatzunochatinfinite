
import React from 'react';
import { Infinity, Moon, Sun, Settings, ArrowLeft, Edit2 } from 'lucide-react';
import { ChatMode, UserProfile } from '../types';

interface HeaderProps {
  onlineCount: number;
  mode: ChatMode;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onDisconnect: () => void;
  partnerProfile: UserProfile | null;
  onOpenSettings: () => void;
  onEditProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onlineCount, 
  mode, 
  theme, 
  toggleTheme, 
  onDisconnect, 
  partnerProfile,
  onOpenSettings,
  onEditProfile
}) => {
  const isConnected = mode === ChatMode.CONNECTED;

  return (
    <header className="h-16 border-b border-slate-200 dark:border-white/5 bg-white/90 dark:bg-[#05050A]/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 transition-colors font-sans shrink-0">
      
      <div className="flex items-center gap-3 overflow-hidden">
        {isConnected && (
          <button 
            onClick={onDisconnect}
            className="sm:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {isConnected && partnerProfile ? (
          // WhatsApp Style Header (Personal)
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                {partnerProfile.username[0].toUpperCase()}
             </div>
             <div className="flex flex-col min-w-0">
                <h1 className="font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs leading-tight">
                  {partnerProfile.username}
                </h1>
                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Online
                </span>
             </div>
          </div>
        ) : (
          // Default Header
          <div className="flex items-center gap-3">
            <div className="text-slate-900 dark:text-white shrink-0 hidden sm:block">
              <Infinity className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-900 dark:text-white tracking-tight">Chatzuno</h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  {onlineCount.toLocaleString()} online
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors hidden sm:block"
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Logged In Actions */}
        {mode !== ChatMode.IDLE && (
          <>
             <button 
               onClick={onEditProfile}
               className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
               title="Edit Profile"
             >
               <Edit2 size={18} />
             </button>
             <button 
               onClick={onOpenSettings}
               className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors hidden sm:block"
             >
              <Settings size={18} />
             </button>

             {isConnected && (
               <button 
                onClick={onDisconnect}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-4 sm:px-5 py-2 rounded-full text-sm font-bold transition-colors"
              >
                <span className="hidden sm:inline">End Chat</span>
                <span className="sm:hidden">End</span>
              </button>
             )}
          </>
        )}
      </div>
    </header>
  );
};
