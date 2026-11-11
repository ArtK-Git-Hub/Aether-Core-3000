
import React from 'react';

interface TemperatureDisplayProps {
  label: string;
  value: number;
}

const TemperatureDisplay: React.FC<TemperatureDisplayProps> = ({ label, value }) => {
  return (
    <div className="relative group p-10 flex flex-col items-center justify-center transition-all duration-1000">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-foreground/[0.01] rounded-full filter blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <span className="text-xs uppercase font-light tracking-[0.4em] text-foreground/50 mb-6 group-hover:text-foreground/90 transition-colors">{label}</span>
      
      <div className="relative">
        <div className="font-thin text-8xl tracking-tighter chromatic-aberration text-foreground opacity-100">
          {value.toFixed(1)}
        </div>
        <div className="absolute -top-4 -right-8 text-sm font-light tracking-widest text-foreground/60 uppercase italic">Vibrations</div>
      </div>
      
      <div className="mt-8 flex gap-4 opacity-20 group-hover:opacity-50 transition-opacity">
        {Array.from({length: 3}).map((_, i) => (
            <div key={i} className="w-px h-8 bg-gradient-to-t from-transparent via-foreground to-transparent animate-pulse" style={{animationDelay: `${i * 0.5}s`}}></div>
        ))}
      </div>
    </div>
  );
};

export default TemperatureDisplay;
