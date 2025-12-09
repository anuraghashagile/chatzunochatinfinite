import React, { useState } from 'react';
import { ArrowRight, Shield, Check, AlertCircle, FileText, X, Sun, Moon } from 'lucide-react';
import { Button } from './Button';
import { clsx } from 'clsx';

interface LandingPageProps {
  onlineCount: number;
  onStart: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const TERMS_TEXT = `By using this app, you confirm that you are 18 years or older and agree that you are solely responsible for your actions and interactions at all times. This platform only provides a technical service that connects anonymous users for casual conversation, and we do not monitor, filter, supervise, or verify any messages, media, or behaviour shared by users. 

You strictly agree not to share, request, or engage in any illegal, harmful, abusive, explicit, sexual, pornographic, or inappropriate content of any kind.`;

export const LandingPage: React.FC<LandingPageProps> = ({ onlineCount, onStart, theme, toggleTheme }) => {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-500/10 dark:bg-brand-500/20 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 dark:bg-purple-500/20 blur-[120px] rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Header */}
      <header className="flex justify-between items-center p-6 z-10 relative">
        <div className="flex items-center gap-2">
           <img 
              src="https://i.ibb.co/68038vj/73229-1.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain drop-shadow-md"
            />
           <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Chatzuno</span>
        </div>
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative max-w-2xl mx-auto w-full">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm mb-8 animate-in slide-in-from-top-4 fade-in duration-700">
           <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
           </span>
           <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
             {onlineCount.toLocaleString()} people online now
           </span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight leading-[1.1]">
          Chat with <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-600 animate-gradient-x">Strangers</span>
        </h1>
        
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-lg leading-relaxed">
          Connect instantly with random people from around the world. No login required. Anonymous, safe, and fun.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
           <Button 
             onClick={() => setShowTerms(true)}
             className="h-14 text-lg shadow-xl shadow-brand-500/30 w-full"
           >
             Start Chatting <ArrowRight size={20} />
           </Button>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8 text-slate-400 dark:text-slate-500">
           <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl mb-1">
                 <Shield size={24} />
              </div>
              <span className="text-xs font-medium">Anonymous</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl mb-1">
                 <Check size={24} />
              </div>
              <span className="text-xs font-medium">Free</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl mb-1">
                 <AlertCircle size={24} />
              </div>
              <span className="text-xs font-medium">No Login</span>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-400 dark:text-slate-600 z-10 relative">
        &copy; {new Date().getFullYear()} Chatzuno. Connect responsibly.
      </footer>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-[#0A0A0F] p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/10 animate-in zoom-in-95 duration-200 relative">
              <button 
                onClick={() => setShowTerms(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                 <div className="p-3 bg-brand-100 dark:bg-brand-900/20 text-brand-500 rounded-2xl">
                    <FileText size={24} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Terms of Use</h2>
              </div>
              
              <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto mb-6 text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                 {TERMS_TEXT}
              </div>

              <Button onClick={onStart} fullWidth className="h-12 text-md">
                 I Agree, Let's Go
              </Button>
           </div>
        </div>
      )}
    </div>
  );
};