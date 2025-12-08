

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

      // Filter out duplicates (by username for simplicity) and keep last 20
      recents = [newPeer, ...recents.filter(p => p.profile.username !== profile.username)].slice(0, 20);
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
    // Don't clear error here, let it persist briefly if needed
  }, []);

  // --- MESSAGING ---
  const sendMessage = useCallback((text: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: text, dataType: 'text' };
      connRef.current.send(payload);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text,
        type: 'text',
        sender: 'me',
        timestamp: Date.now(),
        reactions: []
      }]);
    }
  }, [status]);

  const sendImage = useCallback((base64Image: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Image, dataType: 'image' };
      connRef.current.send(payload);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        fileData: base64Image,
        type: 'image',
        sender: 'me',
        timestamp: Date.now(),
        reactions: []
      }]);
    }
  }, [status]);

  const sendAudio = useCallback((base64Audio: string) => {
    if (connRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Audio, dataType: 'audio' };
      connRef.current.send(payload);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        fileData: base64Audio,
        type: 'audio',
        sender: 'me',
        timestamp: Date.now(),
        reactions: []
      }]);
    }
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
      setPartnerTyping(false);
      setPartnerRecording(false);
      
      const newMessage: Message = {
        id: Date.now().toString(), // Note: In a real app, use UUID provided by sender to match IDs for reactions
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
       // We received a reaction. 
       setMessages(prev => {
         const newMessages = [...prev];
         const lastMessageIndex = newMessages.map(m => m.sender).lastIndexOf('me');
         if (lastMessageIndex !== -1) {
            const msg = newMessages[lastMessageIndex];
            newMessages[lastMessageIndex] = {
               ...msg,
               reactions: [...(msg.reactions || []), { emoji: data.payload, sender: 'stranger' }]
            };
         }
         return newMessages;
       });

    } else if (data.type === 'typing') {
      setPartnerTyping(data.payload);
    } else if (data.type === 'recording') {
      setPartnerRecording(data.payload);
    } else if (data.type === 'profile') {
      setPartnerProfile(data.payload);
      // Save connection to history immediately when we receive profile
      if (connRef.current?.peer) {
        saveToRecent(data.payload, connRef.current.peer);
      }
    } else if (data.type === 'profile_update') {
      setPartnerProfile(data.payload);
    } else if (data.type === 'vanish_mode') {
      // Robust sync: Update remote mode state immediately
      setRemoteVanishMode(data.payload);
    } else if (data.type === 'disconnect') {
      setStatus(ChatMode.DISCONNECTED);
      setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      cleanup();
    }
  }, [cleanup, saveToRecent]);

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
    
    // Explicitly cast to any to avoid TS errors with .on()
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
      cleanup();
    });
    
    (conn as any).on('error', (err: any) => {
      console.error("Connection Error:", err);
      // Don't immediately cleanup on minor errors, but notify
      if (err.type === 'network') {
        setError("Network connection unstable.");
      } else {
        setError("Connection lost.");
        cleanup();
        setStatus(ChatMode.DISCONNECTED);
      }
    });
  }, [handleData, cleanup, status, userProfile]);

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
        
        // Update Online Users List with Profiles
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
            profile: userProfile // Broadcast profile so others see my name in Social Hub
          });
          setStatus(ChatMode.WAITING);
        }
      });

  }, [setupConnection, userProfile]);

  // --- CONNECT / CALL ---
  const connect = useCallback(() => {
    cleanup();
    setMessages([]);
    setPartnerProfile(null);
    setRemoteVanishMode(null);
    setError(null);
    
    const peer = new Peer({
      debug: 1, // Reduced debug level
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

    // --- Robust Error Handling ---
    (peer as any).on('error', (err: any) => {
      console.error("Peer Error:", err.type, err);
      
      switch (err.type) {
        case 'peer-unavailable':
          setError("User unavailable or currently offline.");
          // If we were trying to call someone specific, this lets us know. 
          // If we were waiting in lobby, we just stay waiting/searching.
          if (status === ChatMode.SEARCHING) {
             // Stay searching if in lobby
          } else {
             setStatus(ChatMode.DISCONNECTED);
          }
          break;

        case 'disconnected':
          setError("Lost connection to signaling server. Reconnecting...");
          // Automatic reconnection attempt
          if (!peer.destroyed) {
            peer.reconnect();
          }
          break;

        case 'network':
          setError("Network error. Checking internet connection...");
          break;

        case 'webrtc':
          setError("WebRTC connection failed.");
          setStatus(ChatMode.ERROR);
          cleanup();
          break;

        case 'browser-incompatible':
          setError("Your browser does not support WebRTC.");
          setStatus(ChatMode.ERROR);
          break;

        default:
          setError(`Connection error: ${err.type || 'Unknown'}`);
          if (status !== ChatMode.IDLE) {
            // Only disconnect if we were active
            cleanup();
            setStatus(ChatMode.ERROR);
          }
      }
      
      // Clear transient error messages after 5 seconds
      setTimeout(() => setError(null), 5000);
    });

  }, [cleanup, joinLobby, setupConnection, status]);

  // --- DIRECT CALL (From Recent) ---
  const callPeer = useCallback((targetPeerId: string) => {
    cleanup();
    setMessages([]);
    setPartnerProfile(null);
    setError(null);
    setStatus(ChatMode.SEARCHING); 

    const peer = new Peer({
      debug: 1,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    (peer as any).on('open', (myId: string) => {
       myPeerIdRef.current = myId;
       setMyPeerId(myId);
       // Directly connect instead of joining lobby
       const conn = peer.connect(targetPeerId, { reliable: true });
       if (conn) {
         setupConnection(conn);
       } else {
         setError("Could not initiate connection.");
         setStatus(ChatMode.IDLE);
       }
    });

    (peer as any).on('error', (err: any) => {
      console.error("Direct Call Error:", err);
      setError("Failed to connect to user. They may be offline.");
      setStatus(ChatMode.DISCONNECTED);
    });

  }, [cleanup, setupConnection]);

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
    sendTyping,
    sendRecording,
    updateMyProfile,
    sendVanishMode,
    connect,
    callPeer,
    disconnect 
  };
};