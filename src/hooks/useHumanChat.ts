import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { supabase } from '../lib/supabase';
import { Message, ChatMode, PeerData, PresenceState, UserProfile, RecentPeer, Friend, FriendRequest, ConnectionMetadata, DirectMessageEvent } from '../types';
import { 
  INITIAL_GREETING, 
  STRANGER_DISCONNECTED_MSG, 
  ICE_SERVERS
} from '../constants';

// Define RealtimeChannel type from supabase instance return type since it's not exported from the module in some versions
type RealtimeChannel = ReturnType<typeof supabase.channel>;

const MATCHMAKING_CHANNEL = 'global-lobby-v1';

export const useHumanChat = (userProfile: UserProfile | null) => {
  // --- MAIN CHAT STATE (Random 1-on-1) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatMode>(ChatMode.IDLE);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [remoteVanishMode, setRemoteVanishMode] = useState<boolean | null>(null);
  
  // --- GLOBAL STATE ---
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // --- DIRECT CHAT STATE (Social Hub) ---
  // We expose a generic event for direct messages so the UI (SocialHub) can listen and update specific histories
  const [incomingDirectMessage, setIncomingDirectMessage] = useState<DirectMessageEvent | null>(null);
  const [incomingReaction, setIncomingReaction] = useState<{ messageId: string, emoji: string, sender: 'stranger' } | null>(null);
  
  // Friend System State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingFriendRequest, setIncomingFriendRequest] = useState<FriendRequest | null>(null);
  
  // --- REFS ---
  const peerRef = useRef<Peer | null>(null);
  
  // Connection Refs
  const mainConnRef = useRef<DataConnection | null>(null); // For Random/Main Chat
  const directConnsRef = useRef<Map<string, DataConnection>>(new Map()); // For Social Hub Chats (Map<peerId, Connection>)

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const isMatchmakerRef = useRef(false);
  
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- LOAD FRIENDS ---
  useEffect(() => {
    const loadFriends = () => {
      try {
        const stored = localStorage.getItem('chat_friends');
        if (stored) {
          setFriends(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("Failed to load friends", e);
      }
    };
    loadFriends();
  }, []);

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

  // --- SAVE FRIEND ---
  const saveFriend = useCallback((profile: UserProfile, peerId: string) => {
    const key = 'chat_friends';
    try {
      const existing = localStorage.getItem(key);
      let friendList: Friend[] = existing ? JSON.parse(existing) : [];
      
      // Check if already exists
      if (friendList.some(f => f.profile.username === profile.username)) return;

      const newFriend: Friend = {
        id: peerId, 
        profile,
        addedAt: Date.now()
      };

      friendList.unshift(newFriend);
      localStorage.setItem(key, JSON.stringify(friendList));
      setFriends(friendList);
    } catch (e) {
      console.warn("Failed to save friend", e);
    }
  }, []);

  // --- CLEANUP ---
  const cleanupMain = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.untrack(); 
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (mainConnRef.current) {
      try { mainConnRef.current.close(); } catch (e) {}
      mainConnRef.current = null;
    }

    // We do NOT destroy peerRef here, as direct chats might rely on it.
    
    isMatchmakerRef.current = false;
    setPartnerTyping(false);
    setPartnerRecording(false);
    setStatus(ChatMode.DISCONNECTED);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
  }, []);

  // --- DATA HANDLING ---
  const handleIncomingData = useCallback((data: PeerData, conn: DataConnection) => {
    const isMain = conn === mainConnRef.current;
    
    // 1. MESSAGES
    if (data.type === 'message') {
      const newMessage: Message = {
        id: Date.now().toString() + Math.random().toString(),
        sender: 'stranger',
        timestamp: Date.now(),
        type: data.dataType || 'text',
        reactions: [],
        text: (data.dataType !== 'image' && data.dataType !== 'audio') ? data.payload : undefined,
        fileData: (data.dataType === 'image' || data.dataType === 'audio') ? data.payload : undefined
      };

      if (isMain) {
        // Main Chat Logic
        setPartnerTyping(false);
        setPartnerRecording(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        setMessages(prev => [...prev, newMessage]);
      } else {
        // Direct Chat Logic (Social Hub)
        setIncomingDirectMessage({
          peerId: conn.peer,
          message: newMessage
        });
      }

    // 2. REACTIONS
    } else if (data.type === 'reaction') {
       // Logic for updating historical/local messages is shared
       if (data.messageId) {
         setIncomingReaction({ messageId: data.messageId, emoji: data.payload, sender: 'stranger' });
         
         // If it's the main chat, update visual state too
         if (isMain) {
            setMessages(prev => prev.map(msg => {
               if (msg.id === data.messageId) {
                 return { ...msg, reactions: [...(msg.reactions || []), { emoji: data.payload, sender: 'stranger' as const }] };
               }
               return msg;
            }));
         }
         
         // Trigger event for direct message listener to update local storage history
         if (!isMain) {
           // We might need a mechanism to tell SocialHub "update history for peer X"
           // Using incomingDirectMessage or incomingReaction (which is global) works if ID is unique enough
         }
       }

    // 3. EDIT MESSAGE
    } else if (data.type === 'edit_message') {
       if (isMain) {
         setMessages(prev => prev.map(msg => {
           if (msg.sender === 'stranger' && msg.type === 'text' && (!data.messageId || msg.id === data.messageId)) {
               return { ...msg, text: data.payload, isEdited: true };
           }
           return msg;
         }));
       }
       // Note: Direct message editing sync not fully implemented for history yet, but reaction is priority

    // 4. INDICATORS (Main Only typically)
    } else if (data.type === 'typing' && isMain) {
      setPartnerTyping(data.payload);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (data.payload) typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 4000);

    } else if (data.type === 'recording' && isMain) {
      setPartnerRecording(data.payload);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (data.payload) recordingTimeoutRef.current = setTimeout(() => setPartnerRecording(false), 4000);

    // 5. PROFILE
    } else if (data.type === 'profile') {
      if (isMain) {
        setPartnerProfile(data.payload);
        saveToRecent(data.payload, conn.peer);
        setMessages(prev => prev.map(msg => {
          if (msg.id === 'init-1') return { ...msg, text: `Connected with ${data.payload.username}. Say hello!` };
          return msg;
        }));
      } else {
        // Profile for direct chat - save to recent immediately
        saveToRecent(data.payload, conn.peer);
      }

    // 6. VANISH MODE
    } else if (data.type === 'vanish_mode' && isMain) {
      setRemoteVanishMode(data.payload);

    // 7. FRIEND REQUESTS
    } else if (data.type === 'friend_request') {
      setIncomingFriendRequest({ profile: data.payload, peerId: conn.peer });

    } else if (data.type === 'friend_accept') {
      saveFriend(data.payload, conn.peer);

    // 8. DISCONNECT
    } else if (data.type === 'disconnect') {
      if (isMain) {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
        mainConnRef.current?.close();
        mainConnRef.current = null;
      } else {
        // Clean up direct connection
        directConnsRef.current.delete(conn.peer);
      }
    }
  }, [saveToRecent, saveFriend]);

  // --- CONNECTION SETUP ---
  const setupConnection = useCallback((conn: DataConnection, metadata: ConnectionMetadata) => {
    // If Random Chat (Main)
    if (metadata?.type === 'random' || (!metadata && isMatchmakerRef.current)) {
       mainConnRef.current = conn;
       
       // Update lobby presence to Busy
       if (channelRef.current && myPeerIdRef.current) {
          channelRef.current.track({
             peerId: myPeerIdRef.current,
             status: 'busy',
             timestamp: Date.now(),
             profile: userProfile
          });
       }
    } else {
       // Direct Chat (Social Hub)
       directConnsRef.current.set(conn.peer, conn);
    }
    
    (conn as any).on('open', () => {
      if (conn === mainConnRef.current) {
        setStatus(ChatMode.CONNECTED);
        setMessages([INITIAL_GREETING]);
        setError(null);
      }
      // Send profile to establish identity
      if (userProfile) {
        conn.send({ type: 'profile', payload: userProfile });
      }
    });

    (conn as any).on('data', (data: any) => handleIncomingData(data, conn));

    (conn as any).on('close', () => {
      if (conn === mainConnRef.current && status === ChatMode.CONNECTED) {
        setStatus(ChatMode.DISCONNECTED);
        setMessages(prev => [...prev, STRANGER_DISCONNECTED_MSG]);
      } else {
        directConnsRef.current.delete(conn.peer);
      }
    });
    
    (conn as any).on('error', (err: any) => {
      console.error("Connection Error:", err);
      if (conn === mainConnRef.current) {
         setError("Connection lost.");
      }
    });
  }, [handleIncomingData, status, userProfile]);


  // --- INITIALIZE PEER ---
  const initPeer = useCallback(() => {
    if (peerRef.current) return peerRef.current;

    const peer = new Peer({ debug: 1, config: { iceServers: ICE_SERVERS } });
    peerRef.current = peer;

    (peer as any).on('open', (id: string) => {
      myPeerIdRef.current = id;
      setMyPeerId(id);
    });

    (peer as any).on('connection', (conn: DataConnection) => {
      // Incoming connection
      const metadata = conn.metadata as ConnectionMetadata;
      setupConnection(conn, metadata);
    });

    return peer;
  }, [setupConnection]);


  // --- CONNECT (RANDOM) ---
  const connect = useCallback(() => {
    // Clean up ONLY main connection items
    cleanupMain();
    setMessages([]);
    setPartnerProfile(null);
    setRemoteVanishMode(null);
    setError(null);
    setIncomingFriendRequest(null);
    
    const peer = initPeer();

    if (peer.id) {
       joinLobby(peer.id);
    } else {
       peer.on('open', (id) => joinLobby(id));
    }

  }, [cleanupMain, initPeer]); // joinLobby is defined below but hoisted via closure in real usage, wait we need to define joinLobby first or use refs.

  // Re-ordering joinLobby definition to be before usage or use `useCallback` dependency flow.
  // Actually, let's define joinLobby inside the hook scope.

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

        // Only matchmaking if we are NOT already connected in main chat
        if (isMatchmakerRef.current || mainConnRef.current?.open) return;

        const sortedWaiters = allUsers
          .filter(u => u.status === 'waiting')
          .sort((a, b) => a.timestamp - b.timestamp);

        const oldestWaiter = sortedWaiters[0];

        if (oldestWaiter && oldestWaiter.peerId !== myId) {
           console.log("Found partner. Connecting:", oldestWaiter.peerId);
           isMatchmakerRef.current = true;
           const conn = peerRef.current?.connect(oldestWaiter.peerId, { 
             reliable: true,
             metadata: { type: 'random' } 
           });
           if (conn) {
             setupConnection(conn, { type: 'random' });
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


  // --- SEND MESSAGES (MAIN) ---
  const sendMessage = useCallback((text: string) => {
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: text, dataType: 'text' };
      mainConnRef.current.send(payload);
    }
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
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Image, dataType: 'image' };
      mainConnRef.current.send(payload);
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
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      const payload: PeerData = { type: 'message', payload: base64Audio, dataType: 'audio' };
      mainConnRef.current.send(payload);
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
    // Update main chat messages
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, reactions: [...(msg.reactions || []), { emoji, sender: 'me' }] };
      }
      return msg;
    }));
    
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'reaction', payload: emoji, messageId });
    }
  }, [status]);

  const editMessage = useCallback((messageId: string, newText: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) return { ...msg, text: newText, isEdited: true };
      return msg;
    }));

    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'edit_message', payload: newText, messageId });
    }
  }, [status]);

  // --- SEND DIRECT MESSAGE (SOCIAL HUB) ---
  const sendDirectMessage = useCallback((targetPeerId: string, text: string) => {
    // 1. Check if we already have a connection
    let conn = directConnsRef.current.get(targetPeerId);

    // 2. If not, try to connect immediately
    if (!conn && peerRef.current) {
      console.log(`Creating new direct connection to ${targetPeerId}`);
      try {
        conn = peerRef.current.connect(targetPeerId, { 
          reliable: true,
          metadata: { type: 'direct' }
        });
        if (conn) {
          setupConnection(conn, { type: 'direct' });
          // Note: Connection takes a moment to open. PeerJS queues data if strict mode is off, 
          // or we might need to wait for 'open' event.
          // For simplicity in this React hook, we'll try sending. 
          // PeerJS buffers automatically if connection is not yet open.
        }
      } catch (e) {
        console.error("Failed to connect direct", e);
      }
    }

    if (conn) {
      const payload: PeerData = { type: 'message', payload: text, dataType: 'text' };
      conn.send(payload);
    }
    
    // Note: Local storage update for direct messages happens in the UI component (SocialHub)
    // to keep this hook focused on transport.
  }, [setupConnection]);

  // --- CALL PEER (Direct) ---
  const callPeer = useCallback((targetPeerId: string, targetProfile?: UserProfile) => {
    // This function initializes a direct connection without disrupting main chat
    
    // Ensure peer is ready
    const peer = initPeer();
    
    // Save to recent immediately
    if (targetProfile) {
      saveToRecent(targetProfile, targetPeerId);
    }

    // Connect if not exists
    if (!directConnsRef.current.has(targetPeerId)) {
      const conn = peer.connect(targetPeerId, { 
        reliable: true, 
        metadata: { type: 'direct' }
      });
      if (conn) {
        setupConnection(conn, { type: 'direct' });
      }
    }
  }, [initPeer, saveToRecent, setupConnection]);

  // --- OTHERS ---
  const sendTyping = useCallback((isTyping: boolean) => {
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'typing', payload: isTyping });
    }
  }, [status]);

  const sendRecording = useCallback((isRecording: boolean) => {
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'recording', payload: isRecording });
    }
  }, [status]);

  const updateMyProfile = useCallback((newProfile: UserProfile) => {
    // Update main
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'profile_update', payload: newProfile });
    }
    // Update all direct peers
    directConnsRef.current.forEach(conn => {
      conn.send({ type: 'profile_update', payload: newProfile });
    });

    if (channelRef.current && myPeerIdRef.current) {
        channelRef.current.track({
          peerId: myPeerIdRef.current,
          status: status === ChatMode.CONNECTED ? 'busy' : 'waiting',
          timestamp: Date.now(),
          profile: newProfile
        });
    }
  }, [status, userProfile]);

  const sendVanishMode = useCallback((isEnabled: boolean) => {
    if (mainConnRef.current && status === ChatMode.CONNECTED) {
      mainConnRef.current.send({ type: 'vanish_mode', payload: isEnabled });
    }
  }, [status]);

  const sendFriendRequest = useCallback(() => {
    // Usually only relevant in Main Chat to convert stranger to friend
    if (mainConnRef.current && status === ChatMode.CONNECTED && userProfile) {
      mainConnRef.current.send({ type: 'friend_request', payload: userProfile });
    }
  }, [status, userProfile]);

  const acceptFriendRequest = useCallback(() => {
    // Can be either context, but usually main
    if (incomingFriendRequest && userProfile) {
      saveFriend(incomingFriendRequest.profile, incomingFriendRequest.peerId);
      
      // Try to send accept back via whatever connection we have for that peer
      const directConn = directConnsRef.current.get(incomingFriendRequest.peerId);
      if (directConn && directConn.open) {
         directConn.send({ type: 'friend_accept', payload: userProfile });
      } else if (mainConnRef.current?.peer === incomingFriendRequest.peerId) {
         mainConnRef.current.send({ type: 'friend_accept', payload: userProfile });
      }
      
      setIncomingFriendRequest(null);
    }
  }, [incomingFriendRequest, userProfile, saveFriend]);

  const disconnect = useCallback(() => {
    // Only disconnect main chat (Stranger)
    if (partnerProfile && mainConnRef.current?.peer) {
      saveToRecent(partnerProfile, mainConnRef.current.peer);
    }
    cleanupMain();
  }, [cleanupMain, partnerProfile, saveToRecent]);

  useEffect(() => {
    // Full cleanup on unmount
    return () => {
      cleanupMain();
      directConnsRef.current.forEach(c => c.close());
      directConnsRef.current.clear();
      peerRef.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    friends,
    incomingFriendRequest,
    incomingReaction,
    incomingDirectMessage, // New export
    sendMessage, 
    sendDirectMessage, // New export
    sendImage,
    sendAudio,
    sendReaction,
    editMessage,
    sendTyping,
    sendRecording,
    updateMyProfile,
    sendVanishMode,
    sendFriendRequest,
    acceptFriendRequest,
    connect,
    callPeer,
    disconnect 
  };
};