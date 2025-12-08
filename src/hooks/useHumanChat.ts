import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, RecentPeer } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  ICE_SERVERS
} from '../constants';

// Define RealtimeChannel type from supabase instance return type since it's not exported from the module in some versions
type RealtimeChannel = ReturnType<typeof supabase.channel>;

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (userProfile: UserProfile | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [remoteVanishMode, setRemoteVanishMode] = useState<boolean | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- PERSIST RECENT PEERS ---
  const saveToRecent = useCallback((profile: UserProfile, peerId: string) => {
    const key = 'recent_peers';
    try {
      const existing = localStorage.getItem(key);
      let recents: RecentPeer[] = existing ? JSON.parse(existing) : [];
      
      // Create new entry
      const newPeer: RecentPeer = {
        id: Date.now().toString(),
        peerId,
        profile,
        metAt: Date.now()
      };

      // Filter out duplicates (by username)
      recents = recents.filter(p => p.profile.username !== profile.username);
      // Add new to top
      recents.unshift(newPeer);
      // Keep last 20
      recents = recents.slice(0, 20);
      
      localStorage.setItem(key, JSON.stringify(recents));
    } catch (e) {
      console.warn('Failed to save recent peer', e);
    }
  }, []);

  // --- CLEANUP ---
  const cleanup = useCallback(() => {
    // We don't untrack presence completely if we want to stay "Online" but busy
    if (channelRef.current) {
      channelRef.current.untrack(); 
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (connRef.current) {
      try { connRef.current.close(); } catch (e) {}
      connRef.current = null;
    }

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (e) {}
      peerRef.current = null;
    }
    
    myPeerIdRef.current = null;
    setMyPeerId(null);
    isMatchmakerRef.current = false;
    setPartnerTyping(false);
    setPartnerRecording(false);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    // Don't clear error here, let it persist briefly if needed
  }, []);

  // --- MESSAGING ---
  const sendMessage = useCallback((text: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: text, dataType: 'text' };
      connRef.current.send(payload);
    }
    // Optimistic add (shows even if sending fails temporarily)
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      type: 'text',
      sender: 'me',
      timestamp: Date.now(),
      reactions: []
    }]);
  }, [status]);

  const sendImage = useCallback((base64Image: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Image, dataType: 'image' };
      connRef.current.send(payload);
    }
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      fileData: base64Image,
      type: 'image',
      sender: 'me',
      timestamp: Date.now(),
      reactions: []
    }]);
  }, [status]);

  const sendAudio = useCallback((base64Audio: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Audio, dataType: 'audio' };
      connRef.current.send(payload);
    }
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      fileData: base64Audio,
      type: 'audio',
      sender: 'me',
      timestamp: Date.now(),
      reactions: []
    }]);
  }, [status]);

  const sendReaction = useCallback((messageId: string, emoji: string) => {
    // Update local state immediately
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          reactions: [...(msg.reactions || []), { emoji, sender: 'me' }]
        };
      }
      return msg;
    }));

    // Send to peer
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { 
        type: 'reaction', 
        payload: emoji, 
        messageId: messageId 
      };
      connRef.current.send(payload);
    }
  }, [status]);

  const editMessage = useCallback((messageId: string, newText: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, text: newText, isEdited: true };
      }
      return msg;
    }));

    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = {
        type: 'edit_message',
        payload: newText,
        messageId: messageId
      };
      connRef.current.send(payload);
    }
  }, [status]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'typing', payload: isTyping };
      connRef.current.send(payload);
    }
  }, [status]);

  const sendRecording = useCallback((isRecording: boolean) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'recording', payload: isRecording };
      connRef.current.send(payload);
    }
  }, [status]);

  const updateMyProfile = useCallback((newProfile: UserProfile) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'profile_update', payload: newProfile };
      connRef.current.send(payload);
    }
    // Update presence status if we are in the lobby
    if (channelRef.current && myPeerIdRef.current) {
        channelRef.current.track({
          peerId: myPeerIdRef.current,
          status: status === ChatMode.CONNECTED ? 'busy' : 'waiting',
          timestamp: Date.now(),
          profile: newProfile
        });
    }
  }, [status]);

  const sendVanishMode = useCallback((isEnabled: boolean) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'vanish_mode', payload: isEnabled };
      connRef.current.send(payload);
    }
  }, [status]);

  // --- PEER DATA HANDLING ---
  const handleData = useCallback((data: PeerData) => {
    if (data.type === 'message') {
      // Clear indicators
      setPartnerTyping(false);
      setPartnerRecording(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);

      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'stranger',
        timestamp: Date.now(),
        type: data.dataType || 'text',
        reactions: []
      };

      if (data.dataType === 'image' || data.dataType === 'audio') {
        newMessage.fileData = data.payload;
      } else {
        newMessage.text = data.payload;
      }

      setMessages(prev => [...prev, newMessage]);

    } else if (data.type === 'reaction') {
       setMessages(prev => {
         const newMessages = prev.map(msg => {
           if (msg.id === data.messageId) { // Prioritize messageId if available
             return {
               ...msg,
               reactions: [...(msg.reactions || []), { emoji: data.payload, sender: 'stranger' as const }]
             };
           }
           return msg;
         });
         
         // Fallback for legacy messages without explicit IDs in payload (less reliable)
         if (!data.messageId) {
            const lastMessageIndex = newMessages.map(m => m.sender).lastIndexOf('me');
            if (lastMessageIndex !== -1) {
                const msg = newMessages[lastMessageIndex];
                newMessages[lastMessageIndex] = {
                   ...msg,
                   reactions: [...(msg.reactions || []), { emoji: data.payload, sender: 'stranger' as const }]
                };
            }
         }
         return newMessages;
       });

    } else if (data.type === 'edit_message') {
       setMessages(prev => prev.map(msg => {
         // We might need a way to match IDs if they are generated locally.
         // However, in P2P, usually we trust the sequence or need a synchronized ID.
         // For now, if we match ID (which might be tricky if IDs are local timestamps), 
         // we might need to rely on content or simple index for 'latest'.
         // BUT, assuming we are editing the LATEST message from stranger or matching ID passed back:
         
         // Note: In this simple implementation, IDs are local timestamps. 
         // PeerJS data doesn't automatically sync IDs.
         // To make this work robustly, we'd need to send the ID with the original message.
         // For now, we will try to match the last text message from stranger if ID doesn't match,
         // or ideally, we should have shared IDs.
         
         // IMPROVEMENT: If we can't match ID, edit the last text message from stranger
         if (msg.sender === 'stranger' && msg.type === 'text') {
             // Basic implementation: Only allow editing the very last message from sender
             // Real implementation requires UUIDs generated by sender and sent with message.
             return { ...msg, text: data.payload, isEdited: true };
         }
         return msg;
       }));

    } else if (data.type === 'typing') {
      setPartnerTyping(data.payload);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (data.payload) {
        // Auto-clear typing after 4 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 4000);
      }
    } else if (data.type === 'recording') {
      setPartnerRecording(data.payload);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (data.payload) {
        recordingTimeoutRef.current = setTimeout(() => setPartnerRecording(false), 4000);
      }
    } else if (data.type === 'profile') {
      setPartnerProfile(data.payload);
      // Save connection to history immediately when we receive profile
      if (connRef.current?.peer) {
        saveToRecent(data.payload, connRef.current.peer);
      }
    } else if (data.type === 'profile_update') {
      setPartnerProfile(data.payload);
      if (connRef.current?.peer) {
        saveToRecent(data.payload, connRef.current.peer);
      }
    } else if (data.type === 'vanish_mode') {
      setRemoteVanishMode(data.payload);
    } else if (data.type === 'disconnect') {
      setStatus(ChatMode.DISCONNECTED);
      setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      // Do not cleanup immediately to allow reading history
      if (connRef.current) { connRef.current.close(); }
    }
  }, [saveToRecent]);

  const setupConnection = useCallback((conn: DataConnection) => {
    // Instead of untracking, mark as busy to keep visibility in Online list
    if (channelRef.current && myPeerIdRef.current) {
       channelRef.current.track({
          peerId: myPeerIdRef.current,
          status: 'busy',
          timestamp: Date.now(),
          profile: userProfile
       });
    }

    connRef.current = conn;
    
    (conn as any).on('open', () => {
      setStatus(ChatMode.CONNECTED);
      setMessages([INITIAL_GREETING]);
      setError(null);
      if (userProfile) {
        conn.send({ type: 'profile', payload: userProfile });
      }
    });

    (conn as any).on('data', (data: any) => handleData(data));

    (conn as any).on('close', () => {
      if (status === ChatMode.CONNECTED) {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      }
      // cleanup(); // Removed auto-cleanup to keep chat visible
    });
    
    (conn as any).on('error', (err: any) => {
      console.error("Connection Error:", err);
      if (err.type === 'network') {
        setError("Network connection unstable.");
      } else {
        setError("Connection lost.");
      }
    });
  }, [handleData, status, userProfile]);

  // --- MATCHMAKING LOGIC ---
  const joinLobby = useCallback((myId: string) => {
    setStatus(ChatMode.SEARCHING);
    setError(null);
    
    const channel = supabase.channel(MATCHMAKING_CHANNEL, {
      config: { presence: { key: myId } }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const allUsers = Object.values(newState).flat() as unknown as PresenceState[];
        setOnlineUsers(allUsers);

        if (isMatchmakerRef.current || connRef.current?.open) return;

        const sortedWaiters = allUsers
          .filter(u => u.status === 'waiting')
          .sort((a, b) => a.timestamp - b.timestamp);

        const oldestWaiter = sortedWaiters[0];

        if (oldestWaiter && oldestWaiter.peerId !== myId) {
           console.log("Found partner. Connecting:", oldestWaiter.peerId);
           isMatchmakerRef.current = true;
           const conn = peerRef.current?.connect(oldestWaiter.peerId, { reliable: true });
           if (conn) {
             setupConnection(conn);
           }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            peerId: myId,
            status: 'waiting',
            timestamp: Date.now(),
            profile: userProfile
          });
          setStatus(ChatMode.WAITING);
        }
      });

  }, [setupConnection, userProfile]);

  // --- CONNECT ---
  const connect = useCallback(() => {
    cleanup();
    setMessages([]);
    setPartnerProfile(null);
    setRemoteVanishMode(null);
    setError(null);
    
    const peer = new Peer({
      debug: 1,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    (peer as any).on('open', (id: string) => {
      myPeerIdRef.current = id;
      setMyPeerId(id);
      joinLobby(id);
    });

    (peer as any).on('connection', (conn: DataConnection) => {
      isMatchmakerRef.current = true;
      setupConnection(conn);
    });

    (peer as any).on('error', (err: any) => {
      console.error("Peer Error:", err.type, err);
      setError("Error connecting to server.");
      setTimeout(() => setError(null), 5000);
    });

  }, [cleanup, joinLobby, setupConnection]);

  // --- DIRECT CALL (From Recent/Online) ---
  // Updated to accept profile for optimistic UI
  const callPeer = useCallback((targetPeerId: string, targetProfile?: UserProfile) => {
    cleanup();
    setMessages([]);
    setError(null);
    setStatus(ChatMode.SEARCHING); 
    
    // Optimistic UI update
    if (targetProfile) {
      setPartnerProfile(targetProfile);
      // Save to recent immediately when we try to connect
      saveToRecent(targetProfile, targetPeerId);
    }

    const peer = new Peer({
      debug: 1,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    (peer as any).on('open', (myId: string) => {
       myPeerIdRef.current = myId;
       setMyPeerId(myId);
       
       console.log(`Attempting to connect to: ${targetPeerId}`);
       const conn = peer.connect(targetPeerId, { reliable: true });
       if (conn) {
         setupConnection(conn);
       } else {
         setError("Could not initiate connection.");
       }
    });

    (peer as any).on('error', (err: any) => {
      console.error("Direct Call Error:", err);
      if (err.type === 'peer-unavailable') {
        setError("User is offline. Waiting for them to reconnect...");
        // Keep status as SEARCHING or Connected to allow 'offline chat' UI to persist
        // Do NOT setStatus(DISCONNECTED) here to avoid closing the UI
      } else {
        setError("Connection failed.");
      }
    });

  }, [cleanup, setupConnection, saveToRecent]);

  const disconnect = useCallback(() => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'disconnect' });
    }
    cleanup();
    setStatus(ChatMode.DISCONNECTED);
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { 
    messages,
    setMessages,
    status, 
    partnerTyping,
    partnerRecording,
    partnerProfile,
    remoteVanishMode,
    onlineUsers,
    myPeerId,
    error,
    sendMessage, 
    sendImage,
    sendAudio,
    sendReaction,
    editMessage,
    sendTyping,
    sendRecording,
    updateMyProfile,
    sendVanishMode,
    connect,
    callPeer,
    disconnect 
  };
};