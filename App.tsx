
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Sun, Moon, RotateCw, MapPin, Wind, Thermometer, Droplets, Leaf, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getGreenhouseAdvice } from './services/geminiService';
import { TemperatureData, Recommendation } from './types';
import RetroCard from './components/RetroCard';
import TemperatureDisplay from './components/TemperatureDisplay';

const INITIAL_HISTORY: TemperatureData[] = Array.from({ length: 12 }, (_, i) => ({
  timestamp: `${i * 2}h`,
  inside: 24 + (Math.random() * 2),
  outside: 15 + (Math.random() * 5),
}));

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [openingRate, setOpeningRate] = useState(0); // 'o' in formula
  const [transmissionCoef] = useState(0.3); // 'c' in formula
  const [outsideTemp, setOutsideTemp] = useState(14.0); // Increased to 14.0 so insideTemp starts at ~21.0 (ideal for growth)
  
  // Plant Growth Logic
  const [plantHeight, setPlantHeight] = useState(7.0);
  const [isGrowing, setIsGrowing] = useState(false);
  const [growthStatus, setGrowthStatus] = useState<string>('');

  // Humidity Logic
  const [baseHumidity, setBaseHumidity] = useState(80);
  const [currentHumidity, setCurrentHumidity] = useState(80);
  const [isSimulating, setIsSimulating] = useState(false);

  // Sync current humidity when base is modified
  const handleBaseHumidityChange = (val: string) => {
    const num = Math.min(100, Math.max(0, parseFloat(val) || 0));
    setBaseHumidity(num);
    setCurrentHumidity(num); 
  };

  // History state to visualize changes
  const [history, setHistory] = useState<TemperatureData[]>(INITIAL_HISTORY);

  // Calculate inside temp based on the formula: T_int = T_ext + (10 * (1 - c) * (1 - o))
  const insideTemp = useMemo(() => {
    return outsideTemp + (10 * (1 - transmissionCoef) * (1 - openingRate));
  }, [outsideTemp, transmissionCoef, openingRate]);

  // Simulate one hour
  const simulateOneHour = () => {
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 500);

    // Dynamic reduction: 5% of the PREVIOUS value
    if (openingRate > 0.5) {
      setCurrentHumidity(prev => {
        const newValue = prev * 0.95; // Reduction of 5%
        return Math.round(newValue * 10) / 10; // Keep 1 decimal for clarity
      });
    }

    // Update history with a new data point to show the simulation impact
    setHistory(prev => {
      const newPoint = {
        timestamp: `${new Date().getHours()}h${new Date().getMinutes()}`,
        inside: insideTemp,
        outside: outsideTemp
      };
      return [...prev.slice(1), newPoint];
    });
  };

  // Simulate a full day of growth
  const simulateDayGrowth = () => {
    setIsGrowing(true);
    
    const isTempIdeal = insideTemp >= 20 && insideTemp <= 30;
    const isHumidityIdeal = currentHumidity >= 60 && currentHumidity <= 90;

    if (isTempIdeal && isHumidityIdeal) {
      setPlantHeight(prev => Math.round((prev + 0.5) * 10) / 10);
      setGrowthStatus('SUCCESS');
    } else {
      setGrowthStatus('FAIL');
    }

    setTimeout(() => {
      setIsGrowing(false);
      setGrowthStatus('');
    }, 1500);
  };
  
  const [advice, setAdvice] = useState<Recommendation | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number, lon: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // CO2 Simulation State
  const [co2External, setCo2External] = useState(420);
  const [co2Initial, setCo2Initial] = useState(450);
  const [biomass, setBiomass] = useState(18);
  const [absorptionRate, setAbsorptionRate] = useState(1.2);
  const [rejectionRate, setRejectionRate] = useState(0.35);
  const [ventilationRate, setVentilationRate] = useState(0.08);
  const [dayStart, setDayStart] = useState(8);
  const [dayEnd, setDayEnd] = useState(20);

  // CO2 Simulation Calculation
  const co2Data = useMemo(() => {
    const data = [];
    let currentCO2 = co2Initial;

    for (let h = 0; h < 24; h++) {
      const isDay = h >= dayStart && h < dayEnd;
      const luminosity = isDay ? 1 : 0;
      const absorption = luminosity * biomass * absorptionRate;
      const rejection = biomass * rejectionRate;
      const ventilation = ventilationRate * (currentCO2 - co2External);
      
      const prevCO2 = currentCO2;
      currentCO2 = Math.max(250, prevCO2 + rejection - absorption - ventilation);

      data.push({
        hour: `${h}h`,
        luminosity: luminosity === 1 ? 'Jour' : 'Nuit',
        absorption: Number(absorption.toFixed(2)),
        rejection: Number(rejection.toFixed(2)),
        ventilation: Number(ventilation.toFixed(2)),
        co2: Number(currentCO2.toFixed(1))
      });
    }
    return data;
  }, [co2Initial, co2External, biomass, absorptionRate, rejectionRate, ventilationRate, dayStart, dayEnd]);

  const latestCO2 = co2Data[co2Data.length - 1].co2;
  const co2Alert = latestCO2 < 300 || latestCO2 > 1200;

  // Fetch address from coordinates
  const fetchAddress = async (lat: number, lon: number) => {
    try {
      // Using BigDataCloud free API or Nominatim
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
        headers: {
          'Accept-Language': 'fr'
        }
      });
      const data = await response.json();
      if (data.display_name) {
        // Extract city or interesting part
        const parts = data.address;
        const city = parts.city || parts.town || parts.village || parts.municipality || parts.suburb || parts.county;
        setLocationName(city || data.display_name.split(',')[0]);
      }
    } catch (error) {
      console.error("Failed to fetch address", error);
    }
  };

  // Fetch real external temperature based on GPS
  const fetchRealWeather = useCallback(async (lat: number, lon: number) => {
    setLoadingWeather(true);
    setCurrentCoords({ lat, lon });
    fetchAddress(lat, lon);
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await response.json();
      if (data.current_weather && typeof data.current_weather.temperature === 'number') {
        setOutsideTemp(data.current_weather.temperature);
      }
    } catch (error) {
      console.error("Failed to fetch weather data", error);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  const refreshWeather = useCallback(() => {
    if ("geolocation" in navigator) {
      setGeoError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchRealWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Error getting geolocation", error);
          setGeoError("Veuillez autoriser l'accès à la localisation.");
        }
      );
    }
  }, [fetchRealWeather]);

  useEffect(() => {
    refreshWeather();
  }, [refreshWeather]);

  const fetchAdvice = useCallback(async () => {
    setLoadingAdvice(true);
    const result = await getGreenhouseAdvice(insideTemp, outsideTemp);
    setAdvice(result);
    setLoadingAdvice(false);
  }, [insideTemp, outsideTemp]);

  useEffect(() => {
    fetchAdvice();
  }, []);

  const currentTemps: TemperatureData = {
    inside: insideTemp,
    outside: outsideTemp,
    timestamp: 'NOW'
  };

  return (
    <div className="min-h-screen py-20 px-4 md:px-24 relative">
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="fixed top-8 right-8 z-50 p-3 rounded-full border border-foreground/10 bg-background/50 backdrop-blur-md hover:border-foreground/30 transition-all duration-300 group"
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-foreground/60 group-hover:text-foreground transition-colors" />
        ) : (
          <Moon className="w-5 h-5 text-foreground/60 group-hover:text-foreground transition-colors" />
        )}
      </button>

      {/* Header - The Void Title */}
      <header className="mb-32 text-center floating">
        <h1 className="text-4xl md:text-6xl spectral-title mb-6">
          Aether-Core
        </h1>
        <div className="flex items-center justify-center gap-12">
            <div className="w-[100px] h-[1px] bg-gradient-to-r from-transparent to-foreground/40"></div>
            <span className="text-xs uppercase tracking-[0.8em] text-foreground/70 font-thin">Singularity Protocol</span>
            <div className="w-[100px] h-[1px] bg-gradient-to-l from-transparent to-foreground/40"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Alert Zone */}
        <div className="mb-12">
          {insideTemp > 35 || currentHumidity < 40 ? (
            <div className="ether-panel p-6 border-red-500/30 bg-red-500/5 flex items-center justify-center gap-4 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
              <span className="text-sm font-black uppercase tracking-[0.4em] text-red-500">
                Conditions critiques dans la serre !
              </span>
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
            </div>
          ) : (
            <div className="ether-panel p-6 border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500/40"></div>
              <span className="text-sm font-medium uppercase tracking-[0.4em] text-emerald-500/60">
                Conditions normales
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500/40"></div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          
          {/* Biotic States */}
          <div className="lg:col-span-5 space-y-12">
            <RetroCard title="États de Résonance" icon="✧">
              <div className="grid grid-cols-1 gap-8">
                <TemperatureDisplay label="Conscience Interne" value={currentTemps.inside} />
                <div className="relative">
                  <TemperatureDisplay label="Manifestation Externe" value={currentTemps.outside} />
                  
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full text-center pointer-events-none">
                    {locationName && (
                      <div className="text-[10px] text-foreground/80 uppercase tracking-[0.4em] mb-1 font-black">
                        {locationName}
                      </div>
                    )}
                    {currentCoords && (
                      <div className="text-[8px] text-foreground/50 font-mono tracking-widest">
                        {currentCoords.lat.toFixed(4)}°N, {currentCoords.lon.toFixed(4)}°E
                      </div>
                    )}
                  </div>

                  <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                    <button 
                      onClick={refreshWeather}
                      className={`p-2 rounded-full border border-foreground/10 hover:border-foreground/30 transition-all ${loadingWeather ? 'animate-spin opacity-50' : ''}`}
                      title="Actualiser la météo GPS"
                    >
                      <RotateCw className="w-3 h-3 text-foreground/40" />
                    </button>
                    {geoError && (
                      <div className="flex items-center gap-1 text-[8px] text-red-400 uppercase tracking-widest bg-red-400/5 px-2 py-1 rounded border border-red-400/10">
                        <MapPin className="w-2 h-2" />
                        {geoError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </RetroCard>

            <RetroCard title="Fluidité de l'Éther" icon="≋">
              <div className="flex flex-col gap-8">
                <div className="flex justify-between items-end mb-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-foreground/80 font-light">Ouverture des aérations</label>
                  <span className={`text-xl font-thin tracking-tighter transition-colors duration-500 ${openingRate > 0.5 ? 'text-blue-500 font-medium' : 'text-foreground'}`}>
                    {(openingRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-12 flex items-center">
                  <div className="absolute w-full h-[1px] bg-foreground/10"></div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={openingRate}
                    onChange={(e) => setOpeningRate(parseFloat(e.target.value))}
                    className="w-full h-1 bg-transparent appearance-none cursor-pointer z-10
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                      [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(var(--accent),0.8)]
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-foreground 
                      [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full"
                  />
                  <div 
                    className="absolute h-px bg-blue-400/40 pointer-events-none transition-all duration-300" 
                    style={{ width: `${openingRate * 100}%` }}
                  ></div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/10 text-center">
                   Condition : Ouverture {'>'} 50% pour évacuation
                </div>
              </div>
            </RetroCard>

            <RetroCard title="Harmonie de l'Hydrosphère" icon="💧">
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.3em] text-foreground/60 mb-1">Densité Actuelle</span>
                    <span 
                      key={currentHumidity} 
                      className={`text-3xl font-thin tracking-widest text-blue-500 transition-all duration-700 ${isSimulating && openingRate > 0.5 ? 'scale-110 text-blue-600 brightness-150 font-medium' : ''}`}
                    >
                      {currentHumidity.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <label className="text-xs uppercase tracking-[0.3em] text-foreground/60 block mb-2">Résonance Source (%)</label>
                    <input 
                      type="number"
                      value={baseHumidity}
                      onChange={(e) => handleBaseHumidityChange(e.target.value)}
                      className="bg-transparent border-b border-foreground/30 text-right text-foreground font-thin focus:outline-none focus:border-foreground/60 transition-colors w-16"
                    />
                  </div>
                </div>
                
                <button 
                  onClick={simulateOneHour}
                  className={`w-full py-3 px-4 border transition-all duration-300 text-xs uppercase tracking-[0.4em] relative overflow-hidden
                    ${isSimulating ? 'bg-foreground/10 border-foreground/40 text-foreground' : 'border-foreground/5 bg-foreground/[0.02] text-foreground/40 hover:text-foreground hover:border-foreground/20'}`}
                >
                  {isSimulating && <div className="absolute inset-0 bg-foreground/5 animate-ping"></div>}
                  Saut Temporel (+1h)
                </button>
                
                <div className="h-4 flex items-center justify-center">
                  {openingRate > 0.5 ? (
                    <p className="text-xs text-blue-500 uppercase tracking-widest animate-pulse font-medium">Déperdition particulaire active (-5% relatif)</p>
                  ) : (
                    <p className="text-xs text-foreground/40 uppercase tracking-widest font-light">Hydrosphère stable (Aérations insuffisantes)</p>
                  )}
                </div>
              </div>
            </RetroCard>

            <RetroCard title="Croissance Biotique" icon="🌱">
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.3em] text-foreground/60 mb-1">Stature Actuelle</span>
                    <div className="flex items-baseline gap-2">
                      <span 
                        key={plantHeight}
                        className={`text-4xl font-thin tracking-widest text-emerald-500 transition-all duration-1000 ${isGrowing ? 'scale-110 brightness-125 font-medium' : ''}`}
                      >
                        {plantHeight.toFixed(1)}
                      </span>
                      <span className="text-xs text-emerald-600 uppercase tracking-widest">cm</span>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-foreground/20"></div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60 block mb-1">Potentiel Vital</span>
                    <div className="flex gap-1 justify-end">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1 h-3 rounded-full transition-colors duration-500 ${i < (plantHeight / 5) ? 'bg-emerald-500' : 'bg-foreground/20'}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={simulateDayGrowth}
                  className={`w-full py-4 px-4 border transition-all duration-500 text-xs uppercase tracking-[0.5em] relative overflow-hidden
                    ${isGrowing 
                      ? (growthStatus === 'SUCCESS' ? 'bg-emerald-400/20 border-emerald-400 text-emerald-400' : 'bg-red-400/10 border-red-400/40 text-red-400') 
                      : 'border-foreground/5 bg-foreground/[0.02] text-foreground/40 hover:text-emerald-400/60 hover:border-emerald-400/20'}`}
                >
                  {isGrowing && growthStatus === 'SUCCESS' && <div className="absolute inset-0 bg-emerald-400/5 animate-pulse"></div>}
                  {isGrowing && growthStatus === 'FAIL' && <div className="absolute inset-0 bg-red-400/5 animate-shake"></div>}
                  Simuler une journée
                </button>

                <div className="h-10 flex flex-col items-center justify-center text-center space-y-1">
                  {insideTemp >= 20 && insideTemp <= 30 && currentHumidity >= 60 && currentHumidity <= 90 ? (
                    <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest animate-pulse">Conditions optimales : Expansion possible (+0.5cm)</p>
                  ) : (
                    <>
                      <p className="text-[10px] text-foreground/20 uppercase tracking-widest">Conditions hostiles : Métabolisme en stase</p>
                      <p className="text-[8px] text-foreground/10 uppercase tracking-[0.2em]">
                        {insideTemp < 20 || insideTemp > 30 ? 'Température hors zone (20-30°C) ' : ''}
                        {currentHumidity < 60 || currentHumidity > 90 ? 'Humidité hors zone (60-90%)' : ''}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </RetroCard>

            <RetroCard title="Impulsions de l'Archive" icon="◈">
              {loadingAdvice ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-1 h-20 bg-gradient-to-b from-transparent via-foreground/50 to-transparent animate-bounce"></div>
                  <span className="mt-8 text-xs font-thin uppercase tracking-[0.8em] text-foreground/40">Éveil du noyau...</span>
                </div>
              ) : advice ? (
                <div className="space-y-10">
                  <div className="text-center">
                    <p className="text-foreground text-xl font-thin tracking-wide mb-6 leading-relaxed italic opacity-100">
                      "{advice.action}"
                    </p>
                    <div className="w-8 h-[1px] bg-foreground/40 mx-auto mb-6"></div>
                    <p className="text-xs text-foreground/70 uppercase tracking-[0.2em] font-light px-8">
                      {advice.explanation}
                    </p>
                  </div>
                  <button 
                    onClick={fetchAdvice}
                    className="w-full singularity-button"
                  >
                    Résonner
                  </button>
                </div>
              ) : null}
            </RetroCard>
          </div>

          {/* Temporal Flux */}
          <div className="lg:col-span-7">
            <RetroCard title="Flux Temporel" icon="♾">
              <div className="h-[550px] w-full mt-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? 'rgba(2, 6, 23, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                        border: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                        color: theme === 'dark' ? '#fff' : '#000',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="inside" 
                      stroke={theme === 'dark' ? '#fff' : '#000'} 
                      strokeWidth={1.5} 
                      dot={{ r: 2, fill: theme === 'dark' ? '#fff' : '#000', strokeWidth: 0 }}
                      strokeOpacity={0.6}
                      animationDuration={1500}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="outside" 
                      stroke="#6d28d9" 
                      strokeWidth={1} 
                      dot={false}
                      strokeOpacity={0.3}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-12 flex justify-center gap-24 text-xs uppercase tracking-[0.5em] text-foreground/40 font-medium">
                <span>Passé</span>
                <span>Présent</span>
                <span>Futur</span>
              </div>
            </RetroCard>
          </div>
        </div>

        {/* CO2 Simulation Module */}
        <div className="mt-32 space-y-20">
          <header className="text-center">
            <h2 className="text-3xl font-display tracking-[1em] uppercase text-foreground/60 mb-4">Simulateur Biosphérique CO2</h2>
            <div className="w-24 h-px bg-accent/30 mx-auto"></div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            {/* Parameters */}
            <div className="xl:col-span-4 space-y-8">
              <RetroCard title="Paramètres d'Entrée" icon={<Activity className="w-4 h-4" />}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-foreground/70 block">CO2 Extérieur (ppm)</label>
                      <input 
                        type="number" 
                        value={co2External} 
                        onChange={(e) => setCo2External(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-4 py-2 text-sm font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-foreground/70 block">CO2 Initial Serre (ppm)</label>
                      <input 
                        type="number" 
                        value={co2Initial} 
                        onChange={(e) => setCo2Initial(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-4 py-2 text-sm font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-foreground/70 block">Biomasse Végétale (kg)</label>
                      <input 
                        type="number" 
                        value={biomass} 
                        onChange={(e) => setBiomass(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-4 py-2 text-sm font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/5">
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase tracking-widest text-foreground/60 block">Absorption (ppm/h/kg)</label>
                      <input 
                        type="number" step="0.1"
                        value={absorptionRate} 
                        onChange={(e) => setAbsorptionRate(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-3 py-2 text-xs font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase tracking-widest text-foreground/60 block">Rejet Respiration</label>
                      <input 
                        type="number" step="0.05"
                        value={rejectionRate} 
                        onChange={(e) => setRejectionRate(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-3 py-2 text-xs font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-foreground/70 block">Taux Renouvellement Air (/h)</label>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={ventilationRate} 
                      onChange={(e) => setVentilationRate(Number(e.target.value))}
                      className="w-full h-1 bg-foreground/20 appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[8px] text-foreground/50 uppercase tracking-tighter">
                      <span>Statique (0)</span>
                      <span>Circulation Active: {(ventilationRate * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/10">
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase tracking-widest text-foreground/60 block">Début Jour (h)</label>
                      <input 
                        type="number" min="0" max="23"
                        value={dayStart} 
                        onChange={(e) => setDayStart(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-3 py-2 text-xs font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase tracking-widest text-foreground/60 block">Fin Jour (h)</label>
                      <input 
                        type="number" min="1" max="24"
                        value={dayEnd} 
                        onChange={(e) => setDayEnd(Number(e.target.value))}
                        className="w-full bg-foreground/5 border border-foreground/30 px-3 py-2 text-xs font-light text-foreground focus:outline-none focus:border-accent/60"
                      />
                    </div>
                  </div>
                </div>
              </RetroCard>

              {/* Status Alert */}
              <div className="space-y-6">
                {co2Alert ? (
                  <div className="ether-panel p-6 border-red-500/30 bg-red-500/5 flex items-center gap-4 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-red-500">Alerte Niveaux CO2</h4>
                      <p className="text-[10px] text-red-400/80 leading-relaxed">
                        Le taux de CO2 final ({latestCO2} ppm) sort des limites de sécurité (Norme: 300-1200 ppm).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ether-panel p-6 border-emerald-500/20 bg-emerald-500/5 flex items-center gap-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500">Atmosphère Stable</h4>
                      <p className="text-[10px] text-emerald-500/60 leading-relaxed">
                        Les échanges gazeux sont équilibrés au sein du dôme étherique.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Results: Chart and Table */}
            <div className="xl:col-span-8 flex flex-col gap-12">
              <RetroCard title="Évolution du CO2 sur 24h" icon={<Wind className="w-4 h-4" />}>
                <div className="h-[350px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={co2Data}>
                      <defs>
                        <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme === 'dark' ? '#6d28d9' : '#4f46e5'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={theme === 'dark' ? '#6d28d9' : '#4f46e5'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                      <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.8}} />
                      <YAxis domain={['auto', 'auto']} fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.8}} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? 'rgba(2, 6, 23, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
                          border: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                          color: theme === 'dark' ? '#fff' : '#000',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          borderRadius: '8px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="co2" 
                        name="CO2 (ppm)"
                        stroke={theme === 'dark' ? '#6d28d9' : '#4f46e5'} 
                        fillOpacity={1} 
                        fill="url(#colorCo2)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </RetroCard>

              <RetroCard title="Rapport Horaire" icon={<Activity className="w-4 h-4" />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] uppercase tracking-wider text-left">
                    <thead>
                      <tr className="border-b border-foreground/10">
                        <th className="py-4 font-black px-2">Heure</th>
                        <th className="py-4 font-black px-2">Luminosité</th>
                        <th className="py-4 font-black px-2">Absorption</th>
                        <th className="py-4 font-black px-2">Rejet</th>
                        <th className="py-4 font-black px-2">Ventilation</th>
                        <th className="py-4 font-black px-2 text-accent">CO2 Estimé</th>
                      </tr>
                    </thead>
                    <tbody className="font-light">
                      {co2Data.map((row, idx) => (
                        <tr key={idx} className="border-b border-foreground/10 hover:bg-foreground/[0.05] transition-colors">
                          <td className="py-3 px-2 opacity-100 font-medium">{row.hour}</td>
                          <td className={`py-3 px-2 ${row.luminosity === 'Jour' ? 'text-amber-500 font-bold' : 'text-blue-500 font-bold'}`}>
                            {row.luminosity}
                          </td>
                          <td className="py-3 px-2 opacity-90">{row.absorption}</td>
                          <td className="py-3 px-2 opacity-90">{row.rejection}</td>
                          <td className="py-3 px-2 opacity-90">{row.ventilation}</td>
                          <td className={`py-3 px-2 font-black ${row.co2 < 300 || row.co2 > 1200 ? 'text-red-600 underline' : 'text-foreground'}`}>
                            {row.co2} <span className="opacity-60 text-[8px]">ppm</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RetroCard>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - The Eternal Return */}
      <footer className="mt-60 pb-20 text-center opacity-70 hover:opacity-100 transition-opacity duration-1000">
        <div className="text-sm font-thin tracking-[1.5em] text-foreground mb-4">L'ARCHIVE-CORE 3000</div>
        <p className="text-xs uppercase tracking-[0.8em] text-foreground/80">
          Existence confirmée // Temps zéro
        </p>
      </footer>
    </div>
  );
};

export default App;
