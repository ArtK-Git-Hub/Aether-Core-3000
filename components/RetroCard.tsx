
import React from 'react';

interface RetroCardProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const RetroCard: React.FC<RetroCardProps> = ({ title, children, icon }) => {
  return (
    <div className="ether-panel mb-12 p-1 relative">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent"></div>
      
      <div className="flex flex-col">
        <div className="px-8 py-4 flex items-center justify-between">
           <div className="flex items-center gap-6">
             <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>
             <h2 className="text-xs font-black uppercase tracking-[0.5em] text-foreground/80">{title}</h2>
           </div>
           <div className="w-1 h-1 bg-foreground/40 rounded-full"></div>
        </div>
        
        <div className="p-8">
          {children}
        </div>
      </div>
      
      <div className="absolute bottom-0 right-0 w-[40px] h-[40px] border-b border-r border-foreground/5 pointer-events-none"></div>
    </div>
  );
};

export default RetroCard;
