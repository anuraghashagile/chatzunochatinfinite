

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { clsx } from 'clsx';
import { Smile } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  senderName?: string;
  textSize?: 'small' | 'medium' | 'large';
  onReact?: (emoji: string) => void;
}

const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, senderName, textSize = 'medium', onReact }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (message.sender === 'system') {
    return (
      <div className="flex flex-col items-center gap-1 my-6 opacity-75">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {message.sender.toUpperCase()}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full text-center max-w-[80%]">
          {message.text}
        </span>
      </div>
    );
  }

  const isMe = message.sender === 'me';
  const displayName = isMe ? 'You' : (senderName || 'Stranger');

  const textSizeClass = {
    small: 'text-xs',
    medium: 'text-[15px]',
    large: 'text-lg'
  }[textSize];

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setShowPicker(true);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPicker(true);
  };

  const handleReactionSelect = (emoji: string) => {
    if (onReact) onReact(emoji);
    setShowPicker(false);
  };

  // Format timestamp using user's local timezone and preference
  const formatTime = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true // explicit preference for 12-hour clock in chat generally reads better, but undefined locale respects user settings
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className={clsx("flex w-full mb-6 group relative", isMe ? "justify-end" : "justify-start")}>
      
      {/* Reaction Picker Popover */}
      {showPicker && (
        <div className={clsx(
          "absolute bottom-full mb-2 z-50 bg-white dark:bg-[#1a1b26] p-2 rounded-full shadow-xl border border-slate-200 dark:border-white/10 flex gap-1 animate-in zoom-in-95 duration-200",
          isMe ? "right-0" : "left-0"
        )}>
           {PRESET_REACTIONS.map(emoji => (
             <button
               key={emoji}
               onClick={() => handleReactionSelect(emoji)}
               className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-lg transition-transform hover:scale-125"
             >
               {emoji}
             </button>
           ))}
        </div>
      )}

      <div className={clsx("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "items-end" : "items-start")}>
        <div className="text-[10px] text-slate-400 mb-1 px-1 font-medium uppercase">
            {displayName}
        </div>
        
        <div 
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            "rounded-2xl shadow-sm relative transition-all overflow-visible select-none active:scale-[0.98]",
            isMe 
              ? "bg-brand-50 dark:bg-brand-600 text-slate-900 dark:text-white rounded-tr-none border border-brand-100 dark:border-brand-500" 
              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700"
          )}
        >
          {message.type === 'text' && (
             <div className={clsx("px-5 py-3 leading-relaxed break-words whitespace-pre-wrap", textSizeClass)}>
               {message.text}
             </div>
          )}

          {message.type === 'image' && message.fileData && (
            <div className="p-1">
               <img 
                 src={message.fileData} 
                 alt="Attachment" 
                 className="max-w-full rounded-xl max-h-[300px] object-cover"
               />
            </div>
          )}

          {message.type === 'audio' && message.fileData && (
            <div className="px-3 py-2 flex items-center gap-2 min-w-[200px]">
               <audio controls src={message.fileData} className="w-full h-8 max-w-[250px]" />
            </div>
          )}

          {/* Reactions Display */}
          {message.reactions && message.reactions.length > 0 && (
             <div className={clsx(
               "absolute -bottom-4 flex gap-1",
               isMe ? "right-0" : "left-0"
             )}>
                {message.reactions.map((r, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-700 shadow-sm border border-slate-100 dark:border-white/5 rounded-full px-1.5 py-0.5 text-[10px] animate-in zoom-in spin-in-12">
                    {r.emoji}
                  </div>
                ))}
             </div>
          )}
        </div>
        
        {/* Actions (Only for stranger messages, visualized for demo) */}
        {!isMe && (
           <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity px-1">
              <button 
                onClick={() => setShowPicker(!showPicker)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Smile size={14}/>
              </button>
           </div>
        )}
        
        <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 px-1">
            {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};