
import React from 'react';
import { Message } from '../types';
import { clsx } from 'clsx';
import { Flag, Smile } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  senderName?: string;
  textSize?: 'small' | 'medium' | 'large';
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, senderName, textSize = 'medium' }) => {
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

  return (
    <div className={clsx("flex w-full mb-4 group", isMe ? "justify-end" : "justify-start")}>
      <div className={clsx("flex flex-col max-w-[85%] sm:max-w-[70%]", isMe ? "items-end" : "items-start")}>
        <div className="text-[10px] text-slate-400 mb-1 px-1 font-medium uppercase">
            {displayName}
        </div>
        <div 
          className={clsx(
            "rounded-2xl shadow-sm relative transition-all overflow-hidden",
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
        </div>
        
        {/* Actions (Only for stranger messages, visualized for demo) */}
        {!isMe && (
           <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Smile size={14}/></button>
              <button className="text-slate-400 hover:text-red-500"><Flag size={14}/></button>
           </div>
        )}
        
        <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-1 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
