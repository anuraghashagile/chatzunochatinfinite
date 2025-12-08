
import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, RecentPeer } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  ICE_SERVERS
} from '../constants';

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (userProfile: UserProfile | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [remoteVanishMode, setRemoteVanishMode] = useState<boolean | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);

  // --- PERSIST RECENT PEERS ---
  const saveToRecent = useCallback((profile: UserProfile, peerId: string) => {
    const key = 'recent_peers';
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
    isMatchmakerRef.current = false;
    setPartnerTyping(false);
    setPartnerRecording(false);
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
        timestamp: Date.now()
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
        timestamp: Date.now()
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
        timestamp: Date.now()
      }]);
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
        id: Date.now().toString(),
        sender: 'stranger',
        timestamp: Date.now(),
        type: data.dataType || 'text'
      };

      if (data.dataType === 'image' || data.dataType === 'audio') {
        newMessage.fileData = data.payload;
      } else {
        newMessage.text = data.payload;
      }

      setMessages(prev => [...prev, newMessage]);

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
      setRemoteVanishMode(data.payload);
    } else if (data.type === 'disconnect') {
      setStatus(ChatMode.DISCONNECTED);
      setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      cleanup();
    }
  }, [cleanup, saveToRecent]);

  const setupConnection = useCallback((conn: DataConnection) => {
    if (channelRef.current) {
      channelRef.current.untrack();
    }

    connRef.current = conn;
    
    conn.on('open', () => {
      setStatus(ChatMode.CONNECTED);
      setMessages([INITIAL_GREETING]);
      if (userProfile) {
        conn.send({ type: 'profile', payload: userProfile });
      }
    });

    conn.on('data', (data: any) => handleData(data));

    conn.on('close', () => {
      if (status === ChatMode.CONNECTED) {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      }
      cleanup();
    });
    
    conn.on('error', () => {
      cleanup();
      setStatus(ChatMode.DISCONNECTED);
    });
  }, [handleData, cleanup, status, userProfile]);

  // --- MATCHMAKING LOGIC ---
  const joinLobby = useCallback((myId: string) => {
    setStatus(ChatMode.SEARCHING);
    
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
    
    const peer = new Peer({
      debug: 0,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      myPeerIdRef.current = id;
      joinLobby(id);
    });

    peer.on('connection', (conn) => {
      isMatchmakerRef.current = true;
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error("Peer Error:", err);
      if (status !== ChatMode.CONNECTED) {
         setStatus(ChatMode.ERROR);
      }
    });

  }, [cleanup, joinLobby, setupConnection, status]);

  // --- DIRECT CALL (From Recent) ---
  const callPeer = useCallback((targetPeerId: string) => {
    cleanup();
    setMessages([]);
    setPartnerProfile(null);
    setStatus(ChatMode.SEARCHING); 

    const peer = new Peer({
      debug: 0,
      config: { iceServers: ICE_SERVERS }
    });
    peerRef.current = peer;

    peer.on('open', (myId) => {
       myPeerIdRef.current = myId;
       // Directly connect instead of joining lobby
       const conn = peer.connect(targetPeerId, { reliable: true });
       if (conn) {
         setupConnection(conn);
       } else {
         alert("Could not create connection.");
         setStatus(ChatMode.IDLE);
       }
    });

    peer.on('error', (err) => {
      console.error("Direct Call Error:", err);
      alert("User is likely offline or has a new session ID.");
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
    status, 
    partnerTyping,
    partnerRecording,
    partnerProfile,
    remoteVanishMode,
    onlineUsers, // Exporting for Social Hub
    sendMessage, 
    sendImage,
    sendAudio,
    sendTyping,
    sendRecording,
    updateMyProfile,
    sendVanishMode,
    connect,
    callPeer, // Exporting for Social Hub
    disconnect 
  };
};
