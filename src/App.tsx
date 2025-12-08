
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, RefreshCw, EyeOff, Shield, Image as ImageIcon, Mic, X, Square, AlertTriangle } from 'lucide-react';
import { supabase, saveMessageToHistory, fetchChatHistory } from './lib/supabase';
import { Message, ChatMode, UserProfile, AppSettings } from './types';
import { useHumanChat } from './hooks/useHumanChat';
import { useGlobalChat } from './hooks/useGlobalChat';
import { MessageBubble } from './components/MessageBubble';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { JoinModal } from './components/JoinModal';
import { SettingsModal } from './components/SettingsModal';
import { SocialHub } from './components/SocialHub';
import { NOTIFICATION_SOUND } from './constants';
import { clsx } from 'clsx';

// Simple user ID persistence
const getStoredUserId = () => {
  if (typeof window === 'undefined') return 'server_user';
  let id = localStorage.getItem('chat_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chat_user_id', id);
  }
  return id;
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  
  // App Settings State
  const [settings, setSettings] = useState<AppSettings>({
    soundEnabled: true,
    textSize: 'medium',
    vanishMode: false
  });
  
  const [isRecording, setIsRecording] = useState(false);
  const userId = useRef(getStoredUserId()).current;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Chat Hooks
  const { 
    messages,
    setMessages, // Exposed to handle message deletion
    status, 
    partnerTyping, 
    partnerRecording,
    partnerProfile,
    remoteVanishMode,
    onlineUsers, // Get online list
    myPeerId, // Get my peer ID
    error, // New error state
    sendMessage, 
    sendImage, 
    sendAudio,
    sendReaction,
    sendTyping, 
    sendRecording,
    updateMyProfile,
    sendVanishMode,
    connect, 
    callPeer, // Get direct call capability
    disconnect 
  } = useHumanChat(userProfile);

  const { globalMessages, sendGlobalMessage } = useGlobalChat(userProfile);

  // --- SOUND EFFECTS ---
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  const playSound = () => {
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
  };

  // Play sound on connection
  useEffect(() => {
    if (status === ChatMode.CONNECTED) playSound();
  }, [status]);

  // Play sound on new personal message
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === 'stranger') {
      playSound();
    }
  }, [messages]);

  // --- SYNC VANISH MODE ---
  useEffect(() => {
    if (remoteVanishMode !== null && remoteVanishMode !== undefined) {
      setSettings(prev => ({ ...prev, vanishMode: remoteVanishMode }));
    }
  }, [remoteVanishMode]);

  // --- AUTO-DELETE MESSAGES IN VANISH MODE ---
  useEffect(() => {
    // Timer to check for expired messages every second
    const interval = setInterval(() => {
      if (messages.some(m => m.isVanish)) {
        const now = Date.now();
        setMessages(prev => prev.filter(msg => {
          if (!msg.isVanish) return true;
          // Keep if younger than 10 seconds
          return (now - msg.timestamp) < 10000;
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [messages, setMessages]);


  // --- HISTORY LOADING ---
  useEffect(() => {
    const loadHistory = async () => {
      await fetchChatHistory(userId);
    };
    loadHistory();
  }, [userId]);

  // Save outgoing messages to history
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === 'me' && !settings.vanishMode) {
       saveMessageToHistory(userId, lastMsg);
    }
  }, [messages, userId, settings.vanishMode]);

  // Theme management
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const handleStartClick = () => setShowJoinModal(true);

  const handleJoin = (profile: UserProfile) => {
    setUserProfile(profile);
    setShowJoinModal(false);
    connect();
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    updateMyProfile(profile);
    setShowEditProfileModal(false);
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (newSettings.vanishMode !== settings.vanishMode) {
      sendVanishMode(newSettings.vanishMode);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    sendMessage(inputText);
    
    // Manually add isVanish flag for local rendering if enabled (sender side)
    if (settings.vanishMode) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'me') {
           const updated = [...prev];
           updated[updated.length - 1] = { ...last, isVanish: true };
           return updated;
        }
        return prev;
      });
    }

    sendTyping(false);
    setInputText('');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1000);
  };

  const handleNewChat = () => {
    disconnect(); 
    setTimeout(connect, 200);
  };

  // --- IMAGE UPLOAD ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        sendImage(base64);
        
        // Handle vanish flag for images locally
        if (settings.vanishMode) {
           setTimeout(() => {
             setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].sender === 'me') {
                  updated[lastIdx] = { ...updated[lastIdx], isVanish: true };
                }
                return updated;
             });
           }, 50);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- AUDIO RECORDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
           const base64Audio = reader.result as string;
           sendAudio(base64Audio);
           
           // Handle vanish flag for audio locally
           if (settings.vanishMode) {
             setTimeout(() => {
               setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].sender === 'me') {
                    updated[lastIdx] = { ...updated[lastIdx], isVanish: true };
                  }
                  return updated;
               });
             }, 50);
           }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      sendRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      sendRecording(false);
    }
  };

  // --- 1. LANDING PAGE ---
  if (status === ChatMode.IDLE && !userProfile) {
    return (
      <>
        <LandingPage onlineCount={Math.max(onlineUsers.length, 1)} onStart={handleStartClick} />
        {showJoinModal && (
          <JoinModal 
            onClose={() => setShowJoinModal(false)} 
            onJoin={handleJoin} 
          />
        )}
      </>
    );
  }

  // --- 2. CONNECTING SCREEN ---
  if (status === ChatMode.SEARCHING || status === ChatMode.WAITING) {
    return (
      <div className="h-[100dvh] bg-white dark:bg-slate-950 flex flex-col transition-colors overflow-hidden relative">
        <Header 
           onlineCount={onlineUsers.length} mode={status} theme={theme} toggleTheme={toggleTheme} onDisconnect={() => {}} partnerProfile={null} onOpenSettings={() => setShowSettingsModal(true)} onEditProfile={() => setShowEditProfileModal(true)}
        />
        
        {/* Error Toast */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5">
             <div className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
               <AlertTriangle size={16} /> {error}
             </div>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-brand-500 blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative z-10 p-6 bg-slate-50 dark:bg-slate-900 rounded-full shadow-2xl border border-slate-200 dark:border-slate-800">
               <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Matching you...</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto animate-pulse mb-8">
             Finding a stranger with similar vibes...
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto mb-12">
             {userProfile?.interests.map(i => (
                <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-medium">{i}</span>
             ))}
          </div>
          <Button variant="secondary" onClick={() => { disconnect(); }}>Cancel</Button>
        </div>
        
        {/* Social Hub available even while waiting */}
        {userProfile && (
          <SocialHub 
            onlineUsers={onlineUsers} 
            onCallPeer={callPeer}
            globalMessages={globalMessages}
            sendGlobalMessage={sendGlobalMessage}
            myProfile={userProfile}
            myPeerId={myPeerId}
            // Pass private chat props
            privateMessages={messages}
            sendPrivateMessage={sendMessage}
            sendReaction={sendReaction}
            currentPartner={partnerProfile}
            chatStatus={status}
            error={error}
          />
        )}
      </div>
    );
  }

  // --- 3. MAIN CHAT SCREEN ---
  return (
    <div className={clsx(
      "flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950 transition-colors fixed inset-0 overflow-hidden",
      settings.vanishMode && "dark:bg-slate-950" 
    )}>
      
      {settings.vanishMode && (
        <div className="absolute inset-0 pointer-events-none z-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      )}

      {/* Error Toast in Chat */}
      {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5">
             <div className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
               <AlertTriangle size={16} /> {error}
             </div>
          </div>
      )}

      {settings.vanishMode && (
         <div className="absolute top-16 left-0 right-0 z-40 flex justify-center pointer-events-none animate-in slide-in-from-top-4">
            <div className="bg-purple-500/10 backdrop-blur-md border border-purple-500/20 px-4 py-1.5 rounded-b-xl text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-purple-900/20">
               <EyeOff size={12} />
               Vanish Mode Active
            </div>
         </div>
      )}

      <Header 
        onlineCount={onlineUsers.length} 
        mode={status} 
        theme={theme}
        toggleTheme={toggleTheme}
        onDisconnect={() => disconnect()}
        partnerProfile={partnerProfile}
        onOpenSettings={() => setShowSettingsModal(true)}
        onEditProfile={() => setShowEditProfileModal(true)}
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 w-full max-w-4xl mx-auto z-10 relative scroll-smooth">
         {!partnerProfile && status === ChatMode.CONNECTED && (
            <div className="text-center text-xs text-slate-400 my-4">Connected encrypted connection...</div>
         )}
         
         {messages.map((msg) => (
            <div key={msg.id} className={clsx("transition-opacity duration-1000", msg.isVanish && "animate-pulse")}>
               <MessageBubble 
                  message={msg} 
                  senderName={partnerProfile?.username} 
                  textSize={settings.textSize}
                  onReact={(emoji) => sendReaction(msg.id, emoji)}
               />
            </div>
         ))}

         {(status === ChatMode.DISCONNECTED || status === ChatMode.IDLE) && (
            <div className="py-8 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 mt-8 border-t border-slate-100 dark:border-white/5 pt-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400"><Shield size={32} /></div>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chat Ended</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">You have disconnected.</p>
              </div>
              <Button onClick={handleNewChat} className="shadow-lg shadow-brand-500/20 px-8"><RefreshCw size={18} /> Find New Stranger</Button>
            </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={clsx(
        "border-t shrink-0 w-full z-20 pb-[env(safe-area-inset-bottom)] transition-colors",
        settings.vanishMode ? "bg-[#1a0b2e] dark:bg-[#1a0b2e] border-purple-500/30" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5",
        status !== ChatMode.CONNECTED && "opacity-50 pointer-events-none grayscale"
      )}>
        <div className="max-w-4xl mx-auto p-2 sm:p-4">
           {partnerTyping && (
             <div className="h-5 px-4 mb-1 text-xs text-brand-500 font-medium animate-pulse flex items-center gap-1">
                 typing...
             </div>
           )}

           <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
             <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} disabled={status !== ChatMode.CONNECTED}/>
             <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 shrink-0"><ImageIcon size={24} /></button>
             {!inputText.trim() && (
                isRecording ? (
                   <button type="button" onClick={stopRecording} className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all animate-pulse shrink-0"><Square size={24} fill="currentColor" /></button>
                ) : (
                   <button type="button" onClick={startRecording} className="p-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0" disabled={status !== ChatMode.CONNECTED}><Mic size={24} /></button>
                )
             )}

            <div className={clsx("relative flex-1 rounded-2xl flex items-center min-h-[50px] bg-slate-100 dark:bg-slate-800")}>
               <input
                 type="text"
                 value={inputText}
                 onChange={handleTyping}
                 placeholder={status === ChatMode.CONNECTED ? (settings.vanishMode ? "Vanish message..." : "Type a message...") : "Disconnected"}
                 className="w-full bg-transparent border-0 px-4 py-3 placeholder:text-slate-400 focus:outline-none text-slate-900 dark:text-white"
                 autoComplete="off"
               />
            </div>

            {inputText.trim() && (
              <button type="submit" className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-95 shrink-0"><Send size={24} /></button>
            )}
          </form>
        </div>
      </div>

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} settings={settings} onUpdateSettings={handleUpdateSettings}/>
      {showEditProfileModal && userProfile && (
        <JoinModal onClose={() => setShowEditProfileModal(false)} onJoin={handleUpdateProfile} initialProfile={userProfile} isEditing={true}/>
      )}

      {/* Social Hub - Always accessible if logged in */}
      {userProfile && (
        <SocialHub 
          onlineUsers={onlineUsers} 
          onCallPeer={callPeer}
          globalMessages={globalMessages}
          sendGlobalMessage={sendGlobalMessage}
          myProfile={userProfile}
          myPeerId={myPeerId}
          // Pass private chat props
          privateMessages={messages}
          sendPrivateMessage={sendMessage}
          sendReaction={sendReaction}
          currentPartner={partnerProfile}
          chatStatus={status}
          error={error}
        />
      )}
    </div>
  );
}
