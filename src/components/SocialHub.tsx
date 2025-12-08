
import React, { useState, useEffect, useRef } from 'react';
import { Users, History, Globe, MessageCircle, X, Wifi, Phone } from 'lucide-react';
import { UserProfile, PresenceState, RecentPeer, Message } from '../types';
import { clsx } from 'clsx';

interface SocialHubProps {
  onlineUsers: PresenceState[];
  onCallPeer: (peerId: string) => void;
  globalMessages: Message[];
  sendGlobalMessage: (text: string) => void;
  myProfile: UserProfile | null;
}

export const SocialHub: React.FC<SocialHubProps> = ({ 
  onlineUsers, 
  onCallPeer,
  globalMessages,
  sendGlobalMessage,
  myProfile
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'recent' | 'global'>('online');
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  const [globalInput, setGlobalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Recent Peers from LocalStorage
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('recent_peers');
      if (stored) {
        setRecentPeers(JSON.parse(stored));
      }
    }
  }, [isOpen]);

  // Auto-scroll Global Chat
  useEffect(() => {
    if (activeTab === 'global' && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalMessages, activeTab, isOpen]);

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalInput.trim()) {
      sendGlobalMessage(globalInput);
      setGlobalInput('');
    }
  };

  return (
    <>
      {/* FAB Trigger */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-brand-500 hover:bg-brand-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center border-4 border-slate-50 dark:border-slate-900"
      >
        <MessageCircle size={28} />
        {/* Unread dot simulation */}
        <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-brand-500"></span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          
          <div className="bg-white dark:bg-[#0A0A0F] w-full sm:w-[400px] h-[80dvh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-10 sm:slide-in-from-right-10 duration-300">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Social Hub
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 mx-4 mt-4 rounded-xl">
              <button 
                onClick={() => setActiveTab('online')}
                className={clsx(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  activeTab === 'online' ? "bg-white dark:bg-slate-800 text-brand-500 shadow-sm" : "text-slate-500"
                )}
              >
                <Wifi size={16} /> Online
              </button>
              <button 
                onClick={() => setActiveTab('recent')}
                className={clsx(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  activeTab === 'recent' ? "bg-white dark:bg-slate-800 text-brand-500 shadow-sm" : "text-slate-500"
                )}
              >
                <History size={16} /> Recent
              </button>
              <button 
                onClick={() => setActiveTab('global')}
                className={clsx(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                  activeTab === 'global' ? "bg-white dark:bg-slate-800 text-brand-500 shadow-sm" : "text-slate-500"
                )}
              >
                <Globe size={16} /> Global
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
              
              {/* --- ONLINE TAB --- */}
              {activeTab === 'online' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    {onlineUsers.length} Active Users
                  </div>
                  {onlineUsers.map((user, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {user.profile?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {user.profile?.username || 'Anonymous'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                             {user.status === 'waiting' ? 'Looking for chat' : 'In a chat'}
                          </div>
                        </div>
                      </div>
                      <span className={clsx(
                        "w-2 h-2 rounded-full",
                        user.status === 'waiting' ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      )}></span>
                    </div>
                  ))}
                  {onlineUsers.length === 0 && (
                    <div className="text-center text-slate-500 py-10">No users found</div>
                  )}
                </div>
              )}

              {/* --- RECENT TAB --- */}
              {activeTab === 'recent' && (
                <div className="space-y-3">
                  {recentPeers.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">
                      No recent history.
                    </div>
                  ) : (
                    recentPeers.map((peer) => (
                      <div key={peer.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-lg font-bold">
                            {peer.profile.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {peer.profile.username}
                            </div>
                            <div className="text-xs text-slate-500">
                               Met {new Date(peer.metAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setIsOpen(false);
                            onCallPeer(peer.peerId);
                          }}
                          className="p-2 bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded-lg hover:bg-brand-200 transition-colors"
                          title="Call Again"
                        >
                          <Phone size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* --- GLOBAL TAB --- */}
              {activeTab === 'global' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 space-y-3 mb-4">
                     {globalMessages.map(msg => (
                       <div key={msg.id} className={clsx("flex flex-col", msg.sender === 'me' ? "items-end" : "items-start")}>
                          <div className="px-3 py-2 rounded-xl text-sm max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                             <span className="text-[10px] text-brand-500 block font-bold mb-0.5">
                               {msg.sender === 'me' ? 'You' : msg.senderName}
                             </span>
                             {msg.text}
                          </div>
                       </div>
                     ))}
                     {globalMessages.length === 0 && <div className="text-center text-slate-500 text-sm">Welcome to Global Chat</div>}
                     <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={handleGlobalSubmit} className="mt-auto flex gap-2">
                     <input 
                       className="flex-1 bg-slate-100 dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                       placeholder="Global message..."
                       value={globalInput}
                       onChange={e => setGlobalInput(e.target.value)}
                     />
                     <button type="submit" className="p-2 bg-brand-500 text-white rounded-lg">
                       <MessageCircle size={18} />
                     </button>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
};
