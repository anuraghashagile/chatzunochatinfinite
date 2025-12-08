
import React from 'react';
import { X, Volume2, Type, EyeOff, VolumeX } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0A0A0F] rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          
          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-500 rounded-lg">
                {settings.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white text-sm">Sound Effects</div>
                <div className="text-xs text-slate-500">Play sounds for messages</div>
              </div>
            </div>
            <button 
              onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={`w-11 h-6 rounded-full transition-colors relative ${settings.soundEnabled ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Vanish Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-lg">
                <EyeOff size={20} />
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white text-sm">Vanish Mode</div>
                <div className="text-xs text-slate-500">Messages disappear (Local only)</div>
              </div>
            </div>
            <button 
              onClick={() => onUpdateSettings({ ...settings, vanishMode: !settings.vanishMode })}
              className={`w-11 h-6 rounded-full transition-colors relative ${settings.vanishMode ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${settings.vanishMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Text Size */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">
                <Type size={20} />
              </div>
              <div className="font-medium text-slate-900 dark:text-white text-sm">Text Size</div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onUpdateSettings({ ...settings, textSize: size })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    settings.textSize === size 
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
