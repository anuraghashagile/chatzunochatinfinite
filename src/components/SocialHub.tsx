import React, { useState, useEffect, useRef } from 'react';
import { Users, History, Globe, MessageCircle, X, Wifi, Phone, Lock, ArrowLeft, Send, Zap, AlertTriangle, Loader2, UserPlus, Heart } from 'lucide-react';
import { UserProfile, PresenceState, RecentPeer, Message, ChatMode, SessionType, Friend, DirectMessageEvent } from '../types';
import { clsx } from 'clsx';
import { MessageBubble } from './MessageBubble';

interface SocialHubProps {
  onlineUsers: PresenceState[];
  onCallPeer: (peerId: string, profile?: UserProfile) => void;
  globalMessages: Message[];
  sendGlobalMessage: (text: string) => void;
  myProfile: UserProfile | null;
  myPeerId?: string | null;
  privateMessages: Message[]; // Main chat messages
  sendPrivateMessage: (text: string) => void; // Main chat send
  sendDirectMessage?: (peerId: string, text: string) => void; // Direct chat send
  sendReaction?: (messageId: string, emoji: string) => void;
  currentPartner: UserProfile | null;
  chatStatus: ChatMode;
  error?: string | null;
  onEditMessage?: (id: string, text: string) => void;
  sessionType: SessionType;
  incomingReaction?: { messageId: string, emoji: string, sender: 'stranger' } | null;
  incomingDirectMessage?: DirectMessageEvent | null;
  onCloseDirectChat?: () => void;
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
  sendDirectMessage,
  sendReaction,
  currentPartner,
  chatStatus,
  error,
  onEditMessage,
  sessionType,
  incomingReaction,
  incomingDirectMessage,
  onCloseDirectChat
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'recent' | 'global' | 'friends'>('online');
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Notification State
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Inputs
  const [globalInput, setGlobalInput] = useState('');
  const [privateInput, setPrivateInput] = useState('');
  
  // Active Chat State
  const [activePeer, setActivePeer] = useState<{id: string, profile: UserProfile} | null>(null);
  const [localChatHistory, setLocalChatHistory] = useState<Message[]>([]);
  
  // Refs for scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    // Load Recent
    const storedRecents = localStorage.getItem('recent_peers');
    if (storedRecents) {
      try { setRecentPeers(JSON.parse(storedRecents)); } catch (e) {}
    }
    // Load Friends
    const storedFriends = localStorage.getItem('chat_friends');
    if (storedFriends) {
      try { setFriends(JSON.parse(storedFriends)); } catch (e) {}
    }
  }, [isOpen, chatStatus, incomingDirectMessage]); // Reload when message arrives to update Recents order

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
      
      // Clear unread for this peer
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[activePeer.id];
        return next;
      });
    }
  }, [activePeer]);

  // --- 3. HANDLE INCOMING DIRECT MESSAGES & NOTIFICATIONS ---
  useEffect(() => {
    if (incomingDirectMessage) {
      const { peerId, message } = incomingDirectMessage;
      
      // Update persistent storage for this peer
      const storageKey = `chat_history_${peerId}`;
      const existingHistory = localStorage.getItem(storageKey);
      let history: Message[] = existingHistory ? JSON.parse(existingHistory) : [];
      
      // Avoid duplicates
      if (!history.some(m => m.id === message.id)) {
        history.push(message);
        localStorage.setItem(storageKey, JSON.stringify(history));
        
        // If this peer is active in the view, update the view state
        if (activePeer && activePeer.id === peerId) {
          setLocalChatHistory(history);
        } else {
          // Increment unread count
          setUnreadCounts(prev => ({
            ...prev,
            [peerId]: (prev[peerId] || 0) + 1
          }));
        }
      }
    }
  }, [incomingDirectMessage, activePeer]);


  // --- 4. SYNC INCOMING REACTIONS TO HISTORICAL MESSAGES ---
  useEffect(() => {
    if (incomingReaction && activePeer) {
      setLocalChatHistory(prev => {
        const updatedHistory = prev.map(msg => {
           if (msg.id === incomingReaction.messageId) {
             // Prevent duplicates
             const hasReaction = msg.reactions?.some(r => r.emoji === incomingReaction.emoji && r.sender === 'stranger');
             if (hasReaction) return msg;

             return {
               ...msg,
               reactions: [...(msg.reactions || []), { emoji: incomingReaction.emoji, sender: 'stranger' as const }]
             };
           }
           return msg;
        });
        localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(updatedHistory));
        return updatedHistory;
      });
    }
  }, [incomingReaction, activePeer]);


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

      // 2. Update Local State & Storage immediately
      const updatedHistory = [...localChatHistory, newMsg];
      setLocalChatHistory(updatedHistory);
      localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(updatedHistory));

      // 3. Send over Network (Directly to peer)
      if (sendDirectMessage) {
        sendDirectMessage(activePeer.id, privateInput);
      } else {
        // Fallback (Legacy behaviour if hook not updated)
        sendPrivateMessage(privateInput);
      }

      setPrivateInput('');
    }
  };

  const handleReactionSend = (messageId: string, emoji: string) => {
    // Optimistic update for sender side in local history
    if (activePeer) {
      setLocalChatHistory(prev => {
         const updated = prev.map(msg => {
           if (msg.id === messageId) {
             return {
               ...msg,
               reactions: [...(msg.reactions || []), { emoji, sender: 'me' as const }]
             };
           }
           return msg;
         });
         localStorage.setItem(`chat_history_${activePeer.id}`, JSON.stringify(updated));
         return updated;
      });
    }
    // Network send
    if (sendReaction) sendReaction(messageId, emoji);
  };

  const openPrivateChat = (peerId: string, profile?: UserProfile) => {
    if (profile) {
      setActivePeer({ id: peerId, profile });
      // Initiate direct connection without breaking main chat
      onCallPeer(peerId, profile);
      
      // Clear notification for this peer
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    }
  };

  const closePrivateChat = () => {
    setActivePeer(null);
    if (onCloseDirectChat) onCloseDirectChat();
  };

  const getTotalUnreadCount = () => Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* FAB Trigger - Updated sizing and positioning for better visibility across devices */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-5 sm:bottom-10 sm:right-10 z-[60] w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-2xl shadow-brand-500/40 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center border-[3px] border-slate-50 dark:border-slate-900 relative"
        aria-label="Open Social Hub"
      >
        <Users size={26} strokeWidth={2.5} />
        {getTotalUnreadCount() > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold animate-pulse shadow-sm">
            {getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount()}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-end sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          
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
                       {/* Status assumed online if in list */}
                       {onlineUsers.some(u => u.peerId === activePeer.id) ? (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> Online
                          </span>
                       ) : (
                          <span className="text-xs text-slate-400 font-medium">
                             Offline
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
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 mx-4 mt-4 rounded-xl shrink-0 overflow-x-auto">
                   {['online', 'friends', 'recent', 'global'].map((tab) => (
                      <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={clsx(
                          "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 capitalize whitespace-nowrap relative",
                          activeTab === tab ? "bg-white dark:bg-slate-800 text-brand-500 shadow-sm" : "text-slate-500"
                        )}
                      >
                         {tab === 'online' && <Wifi size={14} />}
                         {tab === 'friends' && <Heart size={14} />}
                         {tab === 'recent' && <History size={14} />}
                         {tab === 'global' && <Globe size={14} />}
                         {tab}
                         
                         {tab === 'friends' && friends.some(f => unreadCounts[f.id] > 0) && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                         )}
                         {tab === 'recent' && recentPeers.some(p => unreadCounts[p.peerId] > 0) && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                         )}
                      </button>
                   ))}
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
                              : "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98]"
                          )}
                        >
                          <div className="flex items-start justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 shadow-lg relative">
                                  {user.profile?.username?.[0]?.toUpperCase() || '?'}
                                  {unreadCounts[user.peerId] > 0 && (
                                     <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />
                                  )}
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
                             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          </div>
                        </div>
                      ))}
                      {onlineUsers.length === 0 && <div className="text-center text-slate-500 py-10">No users found</div>}
                    </div>
                  )}

                  {/* --- FRIENDS TAB --- */}
                  {activeTab === 'friends' && (
                     <div className="space-y-3">
                       {friends.map((friend) => (
                         <div 
                           key={friend.id} 
                           onClick={() => openPrivateChat(friend.id, friend.profile)}
                           className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
                         >
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold shrink-0 relative">
                               {friend.profile.username[0].toUpperCase()}
                               {unreadCounts[friend.id] > 0 && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />
                               )}
                             </div>
                             <div className="min-w-0">
                               <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                 {friend.profile.username}
                               </div>
                               <div className="text-xs text-slate-500">
                                  Added {new Date(friend.addedAt).toLocaleDateString()}
                               </div>
                             </div>
                           </div>
                           <div className="p-2 text-rose-400">
                              <Heart size={18} fill="currentColor" />
                           </div>
                         </div>
                       ))}
                       {friends.length === 0 && (
                         <div className="text-center py-10">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                               <UserPlus size={24} />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                              No friends yet.<br/>Connect with strangers to add them!
                            </p>
                         </div>
                       )}
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
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-lg font-bold shrink-0 relative">
                              {peer.profile.username[0].toUpperCase()}
                              {unreadCounts[peer.peerId] > 0 && (
                                 <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white dark:border-slate-900" />
                              )}
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
                          onReact={(emoji) => handleReactionSend(msg.id, emoji)}
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