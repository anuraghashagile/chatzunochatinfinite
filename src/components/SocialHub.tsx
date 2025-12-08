

import React, { useState, useEffect, useRef } from 'react';
import { Users, History, Globe, MessageCircle, X, Wifi, Phone, Lock, ArrowLeft, Send, Zap } from 'lucide-react';
import { UserProfile, PresenceState, RecentPeer, Message, ChatMode } from '../types';
import { clsx } from 'clsx';
import { MessageBubble } from './MessageBubble';

interface SocialHubProps {
  onlineUsers: PresenceState[];
  onCallPeer: (peerId: string) => void;
  globalMessages: Message[];
  sendGlobalMessage: (text: string) => void;
  myProfile: UserProfile | null;
  myPeerId?: string | null;
  
  // New props for private chat inside Hub
  privateMessages: Message[];
  sendPrivateMessage: (text: string) => void;
  // Added reaction support
  sendReaction?: (messageId: string, emoji: string) => void;
  currentPartner: UserProfile | null;
  chatStatus: ChatMode;
}

export const SocialHub: React.FC<SocialHubProps> = ({ 
  onlineUsers, 
  onCallPeer,
  globalMessages,
  sendGlobalMessage,
  myProfile,
  myPeerId,
  privateMessages,
  sendPrivateMessage,
  sendReaction,
  currentPartner,
  chatStatus
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'recent' | 'global'>('online');
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  const [globalInput, setGlobalInput] = useState('');
  const [privateInput, setPrivateInput] = useState('');
  
  // 'list' = showing users tabs, 'chat' = showing active private chat
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // Load Recent Peers from LocalStorage
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('recent_peers');
      if (stored) {
        try {
          setRecentPeers(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse recent peers", e);
        }
      }
    }
  }, [isOpen]);

  // If chat disconnects, go back to list
  useEffect(() => {
    if (chatStatus !== ChatMode.CONNECTED && viewMode === 'chat') {
       // Optional: stay in chat view to see history or go back?
       // For now, let's allow them to stay but they will see "Disconnected" status in the UI
    }
  }, [chatStatus, viewMode]);

  // Auto-scroll Global Chat
  useEffect(() => {
    if (activeTab === 'global' && isOpen && viewMode === 'list') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalMessages, activeTab, isOpen, viewMode]);

  // Auto-scroll Private Chat
  useEffect(() => {
    if (viewMode === 'chat' && isOpen) {
      privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [privateMessages, viewMode, isOpen]);

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalInput.trim()) {
      sendGlobalMessage(globalInput);
      setGlobalInput('');
    }
  };

  const handlePrivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (privateInput.trim()) {
      sendPrivateMessage(privateInput);
      setPrivateInput('');
    }
  };

  const handleUserClick = (peerId: string) => {
    // Clicking row can also open chat, but we also have a dedicated button
    onCallPeer(peerId);
    setViewMode('chat');
  };

  return (
    <>
      {/* FAB Trigger - Moved UP to bottom-36 (mobile) to avoid covering input bar */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 right-4 sm:bottom-6 sm:right-6 z-40 bg-brand-500 hover:bg-brand-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center border-4 border-slate-50 dark:border-slate-900"
      >
        <MessageCircle size={28} />
        {/* Unread dot simulation */}
        <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-brand-500"></span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          
          <div className="bg-white dark:bg-[#0A0A0F] w-full sm:w-[400px] h-[80dvh] max-h-[800px] sm:h-[600px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-10 sm:slide-in-from-right-10 duration-300">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 shrink-0">
              
              {viewMode === 'chat' ? (
                <div className="flex items-center gap-3">
                   <button onClick={() => setViewMode('list')} className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                     <ArrowLeft size={20} className="text-slate-500 dark:text-slate-200" />
                   </button>
                   <div>
                     <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                       {currentPartner?.username || 'Stranger'}
                     </h2>
                     <div className="text-xs text-brand-500 font-medium">
                       {chatStatus === ChatMode.CONNECTED ? 'Connected' : 'Connecting...'}
                     </div>
                   </div>
                </div>
              ) : (
                <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  Social Hub
                </h2>
              )}

              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <X size={20} />
              </button>
            </div>

            {/* --- LIST MODE CONTENT --- */}
            {viewMode === 'list' && (
              <>
                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 mx-4 mt-4 rounded-xl shrink-0">
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

                <div className="flex-1 overflow-y-auto p-4 scroll-smooth min-h-0">
                  
                  {/* --- ONLINE TAB --- */}
                  {activeTab === 'online' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        {onlineUsers.length} Active Users
                      </div>
                      {onlineUsers.map((user, i) => (
                        <div 
                          key={i} 
                          className="flex flex-col p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between mb-3">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 shadow-lg">
                                  {user.profile?.username?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {user.profile?.username || 'Anonymous'}
                                    {user.profile?.username === myProfile?.username && <span className="text-[10px] text-brand-500 bg-brand-500/10 px-1.5 rounded-full shrink-0">(You)</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    {user.profile ? (
                                      <>
                                        <span>{user.profile.age}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span>{user.profile.gender}</span>
                                      </>
                                    ) : (
                                      <span>Guest</span>
                                    )}
                                  </div>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                               {user.status === 'busy' && <Lock size={14} className="text-slate-400" />}
                               <span className={clsx(
                                  "w-2 h-2 rounded-full",
                                  user.status === 'waiting' ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                                )}></span>
                             </div>
                          </div>

                          {/* Profile Bio/Interests */}
                          {user.profile?.interests && user.profile.interests.length > 0 && (
                             <div className="flex flex-wrap gap-1.5 mb-4">
                               {user.profile.interests.slice(0, 3).map((interest, idx) => (
                                 <span key={idx} className="px-2 py-0.5 bg-white dark:bg-black/20 text-slate-500 dark:text-slate-400 rounded-md text-[10px] font-medium border border-slate-100 dark:border-white/5">
                                   {interest}
                                 </span>
                               ))}
                               {user.profile.interests.length > 3 && (
                                 <span className="text-[10px] text-slate-400 flex items-center px-1">+{user.profile.interests.length - 3}</span>
                               )}
                             </div>
                          )}

                          {/* Connect Button */}
                          <button 
                            onClick={() => handleUserClick(user.peerId)}
                            disabled={user.peerId === myPeerId || user.status === 'busy'} 
                            className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                             <Zap size={14} fill="currentColor" /> 
                             {user.status === 'busy' ? 'Busy' : 'Connect'}
                          </button>
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
                          <div 
                            key={peer.id} 
                            onClick={() => handleUserClick(peer.peerId)}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-lg font-bold shrink-0">
                                {peer.profile.username[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {peer.profile.username}
                                </div>
                                <div className="text-xs text-slate-500">
                                   Met {new Date(peer.metAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </div>
                            </div>
                            <button 
                              className="p-2 bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded-lg group-hover:bg-brand-500 group-hover:text-white transition-colors"
                              title="Chat Again"
                            >
                              <MessageCircle size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* --- GLOBAL TAB --- */}
                  {activeTab === 'global' && (
                    <div className="h-full flex flex-col">
                      <div className="flex-1 space-y-3 mb-4 min-h-0">
                         {globalMessages.map(msg => (
                           <div key={msg.id} className={clsx("flex flex-col", msg.sender === 'me' ? "items-end" : "items-start")}>
                              <div className="px-3 py-2 rounded-xl text-sm max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white break-words">
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
                      <form onSubmit={handleGlobalSubmit} className="mt-auto flex gap-2 shrink-0 pb-1">
                         <input 
                           className="flex-1 bg-slate-100 dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                           placeholder="Global message..."
                           value={globalInput}
                           onChange={e => setGlobalInput(e.target.value)}
                         />
                         <button type="submit" className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                           <Send size={18} />
                         </button>
                      </form>
                    </div>
                  )}

                </div>
              </>
            )}

            {/* --- PRIVATE CHAT MODE CONTENT --- */}
            {viewMode === 'chat' && (
               <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
                  <div className="flex-1 space-y-3 mb-4 overflow-y-auto min-h-0 pr-1">
                     {privateMessages.map(msg => (
                       <MessageBubble 
                          key={msg.id}
                          message={msg}
                          senderName={currentPartner?.username}
                          onReact={sendReaction ? (emoji) => sendReaction(msg.id, emoji) : undefined}
                       />
                     ))}
                     {privateMessages.length === 0 && (
                       <div className="text-center text-slate-500 text-sm mt-10">Start the conversation!</div>
                     )}
                     <div ref={privateMessagesEndRef} />
                  </div>

                  <form onSubmit={handlePrivateSubmit} className="mt-auto flex gap-2 shrink-0 pb-1">
                     <input 
                       className="flex-1 bg-slate-100 dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none disabled:opacity-50"
                       placeholder={chatStatus === ChatMode.CONNECTED ? "Type message..." : "Connecting..."}
                       value={privateInput}
                       onChange={e => setPrivateInput(e.target.value)}
                       disabled={chatStatus !== ChatMode.CONNECTED}
                     />
                     <button 
                       type="submit" 
                       disabled={chatStatus !== ChatMode.CONNECTED || !privateInput.trim()}
                       className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Send size={18} />
                     </button>
                  </form>
               </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};