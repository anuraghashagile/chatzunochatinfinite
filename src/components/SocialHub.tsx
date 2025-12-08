
import React, { useState, useEffect, useRef } from 'react';
import { Users, History, Globe, MessageCircle, X, Wifi, Phone, Lock, ArrowLeft, Send, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { UserProfile, PresenceState, RecentPeer, Message, ChatMode, SessionType } from '../types';
import { clsx } from 'clsx';
import { MessageBubble } from './MessageBubble';

interface SocialHubProps {
  onlineUsers: PresenceState[];
  onCallPeer: (peerId: string, profile?: UserProfile) => void;
  globalMessages: Message[];
  sendGlobalMessage: (text: string) => void;
  myProfile: UserProfile | null;
  myPeerId?: string | null;
  privateMessages: Message[];
  sendPrivateMessage: (text: string) => void;
  sendReaction?: (messageId: string, emoji: string) => void;
  currentPartner: UserProfile | null;
  chatStatus: ChatMode;
  error?: string | null;
  onEditMessage?: (id: string, text: string) => void;
  sessionType: SessionType;
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
  chatStatus,
  error,
  onEditMessage,
  sessionType
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'recent' | 'global'>('online');
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  
  // Inputs
  const [globalInput, setGlobalInput] = useState('');
  const [privateInput, setPrivateInput] = useState('');
  
  // Active Chat State
  const [activePeer, setActivePeer] = useState<{id: string, profile: UserProfile} | null>(null);
  const [localChatHistory, setLocalChatHistory] = useState<Message[]>([]);
  
  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. LOAD RECENT PEERS ---
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
  }, [isOpen, chatStatus]);

  // --- 2. LOAD CHAT HISTORY WHEN CLICKING A USER ---
  useEffect(() => {
    if (activePeer) {
      const storageKey = `chat_history_${activePeer.id}`;
      const savedParams = localStorage.getItem(storageKey);
      if (savedParams) {
        try {
          setLocalChatHistory(JSON.parse(savedParams));
        } catch (e) {
          setLocalChatHistory([]);
        }
      } else {
        setLocalChatHistory([]);
      }
    }
  }, [activePeer]);

  // --- 3. SYNC REAL-TIME MESSAGES TO LOCAL HISTORY ---
  // When 'privateMessages' (from App.tsx/useHumanChat) updates, we assume it's for the ACTIVE connection.
  // We merge these into our local history for the active peer.
  useEffect(() => {
    if (activePeer && privateMessages.length > 0) {
      // Get the last message received from the hook
      const lastMsg = privateMessages[privateMessages.length - 1];
      
      setLocalChatHistory(prev => {
        // Avoid duplicates based on ID
        if (prev.some(m => m.id === lastMsg.id)) return prev;
        
        const newHistory = [...prev, lastMsg];
        // Save to LS immediately
        localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(newHistory));
        return newHistory;
      });
    }
  }, [privateMessages, activePeer]);

  // --- SCROLLING ---
  useEffect(() => {
    if (activeTab === 'global' && isOpen && !activePeer) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalMessages, activeTab, isOpen, activePeer]);

  useEffect(() => {
    if (activePeer && isOpen) {
      privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localChatHistory, activePeer, isOpen]);


  // --- HANDLERS ---

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalInput.trim()) {
      sendGlobalMessage(globalInput);
      setGlobalInput('');
    }
  };

  const handlePrivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (privateInput.trim() && activePeer) {
      // 1. Create Optimistic Message
      const newMsg: Message = {
        id: Date.now().toString(),
        text: privateInput,
        sender: 'me',
        timestamp: Date.now(),
        type: 'text',
        reactions: []
      };

      // 2. Update Local State & Storage
      const updatedHistory = [...localChatHistory, newMsg];
      setLocalChatHistory(updatedHistory);
      localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(updatedHistory));

      // 3. Send over Network (if connected)
      // Note: sendPrivateMessage internally in useHumanChat might fail if disconnected, 
      // but we've already saved it locally so the user sees it sent.
      sendPrivateMessage(privateInput);

      setPrivateInput('');
    }
  };

  const openPrivateChat = (peerId: string, profile?: UserProfile) => {
    // Set active peer UI immediately
    if (profile) {
      setActivePeer({ id: peerId, profile });
    }
    
    // Trigger connection in background (App.tsx handles this)
    onCallPeer(peerId, profile);
  };

  const closePrivateChat = () => {
    setActivePeer(null);
  };

  return (
    <>
      {/* FAB Trigger */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 right-4 sm:bottom-6 sm:right-6 z-40 bg-brand-500 hover:bg-brand-600 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center border-4 border-slate-50 dark:border-slate-900"
      >
        <MessageCircle size={28} />
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          
          <div className="bg-white dark:bg-[#0A0A0F] w-full sm:w-[400px] h-[80dvh] max-h-[800px] sm:h-[600px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-10 sm:slide-in-from-right-10 duration-300 relative">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 shrink-0">
              
              {activePeer ? (
                <div className="flex items-center gap-3">
                   <button onClick={closePrivateChat} className="p-2 -ml-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                     <ArrowLeft size={20} className="text-slate-500 dark:text-slate-200" />
                   </button>
                   <div>
                     <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                       {activePeer.profile.username}
                     </h2>
                     <div className="flex items-center gap-1.5">
                       {chatStatus === ChatMode.CONNECTED && currentPartner?.username === activePeer.profile.username ? (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> Online
                          </span>
                       ) : (
                          <span className="text-xs text-slate-400 font-medium">
                             {/* Show simple status, never error */}
                             Offline (Saved)
                          </span>
                       )}
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
            {!activePeer && (
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
                      {onlineUsers.map((user, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            if (user.peerId !== myPeerId && user.profile) {
                              openPrivateChat(user.peerId, user.profile);
                            }
                          }}
                          className={clsx(
                            "flex flex-col p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 transition-all group relative overflow-hidden",
                            (user.peerId === myPeerId)
                              ? "opacity-60 cursor-not-allowed" 
                              : "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
                          )}
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
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {user.profile ? `${user.profile.age} • ${user.profile.gender}` : 'Guest'}
                                  </div>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                             </div>
                          </div>
                        </div>
                      ))}
                      {onlineUsers.length === 0 && <div className="text-center text-slate-500 py-10">No users found</div>}
                    </div>
                  )}

                  {/* --- RECENT TAB --- */}
                  {activeTab === 'recent' && (
                    <div className="space-y-3">
                      {recentPeers.map((peer) => (
                        <div 
                          key={peer.id} 
                          onClick={() => openPrivateChat(peer.peerId, peer.profile)}
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
                                 {new Date(peer.metAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="p-2 text-slate-400 group-hover:text-brand-500">
                             <MessageCircle size={18} />
                          </div>
                        </div>
                      ))}
                      {recentPeers.length === 0 && <div className="text-center text-slate-500 py-10">No recent history.</div>}
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

            {/* --- PRIVATE CHAT MODE (IN-DRAWER) --- */}
            {activePeer && (
               <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 relative">
                  
                  <div className="flex-1 space-y-3 mb-4 overflow-y-auto min-h-0 pr-1 pt-2">
                     {localChatHistory.map(msg => (
                       <MessageBubble 
                          key={msg.id}
                          message={msg}
                          senderName={activePeer.profile.username}
                          onReact={sendReaction ? (emoji) => sendReaction(msg.id, emoji) : undefined}
                          onEdit={onEditMessage}
                       />
                     ))}
                     {localChatHistory.length === 0 && (
                       <div className="text-center text-slate-500 text-sm mt-10">
                          Start a conversation with {activePeer.profile.username}.<br/>
                          <span className="text-xs opacity-70">Messages are saved locally.</span>
                       </div>
                     )}
                     <div ref={privateMessagesEndRef} />
                  </div>

                  <form onSubmit={handlePrivateSubmit} className="mt-auto flex gap-2 shrink-0 pb-1">
                     <input 
                       className="flex-1 bg-slate-100 dark:bg-white/5 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                       placeholder="Type message..."
                       value={privateInput}
                       onChange={e => setPrivateInput(e.target.value)}
                       autoFocus
                     />
                     <button 
                       type="submit" 
                       disabled={!privateInput.trim()}
                       className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
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
