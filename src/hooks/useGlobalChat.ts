
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Message, UserProfile } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

const GLOBAL_CHAT_CHANNEL = 'global-chat-room';

export const useGlobalChat = (userProfile: UserProfile | null) => {
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase.channel(GLOBAL_CHAT_CHANNEL);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setGlobalMessages((prev) => [...prev, payload]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  const sendGlobalMessage = useCallback(async (text: string) => {
    if (!channelRef.current || !userProfile) return;

    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(),
      text,
      sender: 'stranger',
      senderName: userProfile.username, // Send my name
      timestamp: Date.now(),
      type: 'text'
    };

    // Broadcast to others
    await channelRef.current.send({
      type: 'broadcast',
      event: 'message',
      payload: newMessage
    });

    // Add to local state (sender: 'me')
    setGlobalMessages((prev) => [...prev, { ...newMessage, sender: 'me' }]);
  }, [userProfile]);

  return {
    globalMessages,
    sendGlobalMessage
  };
};
