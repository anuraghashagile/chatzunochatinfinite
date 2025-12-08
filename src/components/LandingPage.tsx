
import React from 'react';
import { ArrowRight, Ghost } from 'lucide-react';
import { Button } from './Button';

interface LandingPageProps {
  onlineCount: number;
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onlineCount, onStart }) => {
  return (
    <div className="min-h-[100dvh] bg-[#05050A] flex flex-col relative text-white font-sans selection:bg-violet-500/30 overflow-y-auto">
      
      {/* --- ABSTRACT BEAM BACKGROUND --- */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        {/* Central Glow Core */}
        <div className="absolute w-[800px] h-[200px] bg-white opacity-5 blur-[120px] rounded-[100%] animate-pulse"></div>
        
        {/* Top Beam */}
        <div className="absolute top-[-20%] w-[150%] h-[60%] bg-gradient-to-b from-violet-900/40 via-violet-600/20 to-transparent blur-[80px] rotate-[-5deg] transform translate-y-[-10%] animate-beam"></div>
        
        {/* Bottom Beam */}
        <div className="absolute bottom-[-20%] w-[150%] h-[60%] bg-gradient-to-t from-brand-900/40 via-brand-600/20 to-transparent blur-[80px] rotate-[-5deg] transform translate-y-[10%] animate-beam" style={{ animationDelay: '2s' }}></div>
        
        {/* Subtle Noise Texture Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      </div>

      {/* --- NAVBAR --- */}
      <nav className="relative z-10 p-4 sm:p-6 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 group cursor-pointer">
           <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/5 group-hover:bg-white/20 transition-all">
             <Ghost size={24} className="text-white"/>
           </div>
           <span className="font-bold text-xl sm:text-2xl tracking-tight">Chatzuno</span>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium text-white/60">
           <div className="px-3 sm:px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-xs flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">{onlineCount.toLocaleString()} online</span>
              <span className="sm:hidden">{onlineCount.toLocaleString()}</span>
           </div>
        </div>
      </nav>

      {/* --- HERO CONTENT --- */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center w-full">
        
        <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-1000">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[10px] sm:text-xs font-medium text-violet-200 mb-2 sm:mb-4 hover:bg-white/10 transition-colors cursor-default">
            <span className="bg-violet-500 rounded-full w-1.5 h-1.5"></span>
            Case Study & Research
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/60 pb-2">
            Where Unknown People <br className="hidden sm:block"/> Become Unforgettable.
          </h1>

          <p className="text-base sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed px-4">
            Experience the next generation of anonymous connection. 
            Zero trace. End-to-end encrypted. Pure human interaction.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center items-center w-full sm:w-auto px-4 pb-12">
             <Button 
               onClick={onStart}
               className="h-14 w-full sm:w-auto px-8 text-lg rounded-full bg-white text-black hover:bg-slate-200 hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] border-none"
             >
               Start Chatting
               <ArrowRight className="w-5 h-5 ml-2" />
             </Button>
             
             <button className="h-14 w-full sm:w-auto px-8 text-lg rounded-full bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all backdrop-blur-sm">
               Learn more
             </button>
          </div>

        </div>
        
        {/* Bottom Abstract Graphic */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xs h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full blur-[1px]"></div>
      </main>

    </div>
  );
};
