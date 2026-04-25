import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Wind, 
  MapPin, 
  ChevronRight, 
  Info, 
  Thermometer, 
  Eye, 
  Cpu,
  RefreshCw,
  Layers
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import Background from './components/Background';
import { 
  resolveResort, 
  fetchWeatherData, 
  fetchAIVerdict, 
  type WeatherData, 
  type DayForecast 
} from './services/weatherService';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; lat: number; lon: number; location?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('F');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [aiVerdict, setAiVerdict] = useState<string | null>(null);
  const [isAiVerdictLoading, setIsAiVerdictLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const aiVerdictRequestIdRef = useRef(0);
  const aiVerdictLoadingGateRef = useRef(false);

  // Ultra-fast search suggestions
  useEffect(() => {
    if (searchQuery.length < 2 || isSearching) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    setIsFetchingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const results = await resolveResort(searchQuery);
        setSuggestions(results);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 250); // Slightly longer debounce for better API efficiency
    return () => clearTimeout(timer);
  }, [searchQuery, isSearching]);

  const handleSelectResort = async (resort: { name: string; lat: number; lon: number; location?: string }) => {
    setSearchQuery(resort.name);
    setSuggestions([]);
    setIsSearching(true);
    setIsLoading(true);
    setError(null);
    setAiVerdict(null);
    
    try {
      let targetLat = resort.lat;
      let targetLon = resort.lon;

      // If coordinates are zero (e.g. from quick tags), resolve them first
      if (targetLat === 0 && targetLon === 0) {
        const resolved = await resolveResort(resort.name);
        if (resolved && resolved.length > 0) {
          targetLat = resolved[0].lat;
          targetLon = resolved[0].lon;
        } else {
          throw new Error("Could not find coordinates for this resort.");
        }
      }

      const data = await fetchWeatherData(targetLat, targetLon, resort.name);
      setWeather(data);
      setSelectedDayIndex(0);
      setIsLoading(false); // Stop main loading as soon as weather data is ready

      aiVerdictLoadingGateRef.current = true;
      setIsAiVerdictLoading(true);
      const aiId = ++aiVerdictRequestIdRef.current;
      fetchAIVerdict(data.current, data.resortName)
        .then((verdict) => {
          if (aiId === aiVerdictRequestIdRef.current) setAiVerdict(verdict);
        })
        .catch(() => {
          if (aiId === aiVerdictRequestIdRef.current) {
            setAiVerdict("Protocol scan complete. Proceed with caution.");
          }
        })
        .finally(() => {
          if (aiId === aiVerdictRequestIdRef.current) {
            aiVerdictLoadingGateRef.current = false;
            setIsAiVerdictLoading(false);
          }
        });
    } catch (err) {
      setError("System failure: Could not link to alpine orbital sensors.");
      setIsLoading(false);
    }
  };

  const handleDaySelect = async (index: number) => {
    if (!weather) return;
    if (index === selectedDayIndex && aiVerdict !== null) return;
    if (aiVerdictLoadingGateRef.current) return;

    aiVerdictLoadingGateRef.current = true;
    setIsAiVerdictLoading(true);
    const aiId = ++aiVerdictRequestIdRef.current;
    setSelectedDayIndex(index);
    setAiVerdict(null);

    try {
      const day = weather.forecast[index];
      const verdict = await fetchAIVerdict(day, weather.resortName);
      if (aiId === aiVerdictRequestIdRef.current) setAiVerdict(verdict);
    } finally {
      if (aiId === aiVerdictRequestIdRef.current) {
        aiVerdictLoadingGateRef.current = false;
        setIsAiVerdictLoading(false);
      }
    }
  };

  const activeWeather = weather?.forecast[selectedDayIndex];
  
  const convertTemp = (c: number) => {
    if (unit === 'F') return Math.round((c * 9/5) + 32);
    return Math.round(c);
  };

  const needsMidLayer = activeWeather ? (unit === 'F' ? convertTemp(activeWeather.apparentTemp) < 25 : activeWeather.apparentTemp < -4) : false;
  
  const goggleLens = activeWeather 
    ? (activeWeather.cloudCover > 40 || activeWeather.condition === 'snow' || activeWeather.condition === 'rain' ? "LOW LIGHT" : "HIGH LIGHT")
    : null;

  return (
    <div className="relative min-h-screen flex flex-col items-center p-6 overflow-hidden">
      <Background condition={activeWeather?.condition || 'sunny'} />

      {/* Main Content Container */}
      <div className="w-full max-w-xl flex-1 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {!weather ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex-1 flex flex-col items-center justify-center py-12"
            >
              <div className="text-6xl mb-8 drop-shadow-lg">🏂</div>
              
              <div className="text-center space-y-4 mb-8">
                <h1 className="text-4xl md:text-6xl font-display font-bold italic tracking-[0.05em] text-neon-cyan leading-[1.1] uppercase">
                  Do I need a<br />Mid Layer?
                </h1>
                <p className="text-[10px] md:text-xs tracking-[0.4em] font-bold text-white/60 uppercase">
                  LIVE MOUNTAIN WEATHER • AI POWERED
                </p>
              </div>

              {/* Unit Toggle */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-full p-1 mb-12 shadow-2xl">
                <button 
                  onClick={() => setUnit('C')}
                  className={cn(
                    "px-6 py-2 rounded-full text-xs font-bold transition-all",
                    unit === 'C' ? "bg-slate-800 text-neon-cyan" : "text-slate-500"
                  )}
                >
                  °C
                </button>
                <button 
                  onClick={() => setUnit('F')}
                  className={cn(
                    "px-6 py-2 rounded-full text-xs font-bold transition-all",
                    unit === 'F' ? "bg-slate-800 text-neon-cyan" : "text-slate-500"
                  )}
                >
                  °F
                </button>
              </div>

              {/* Search Section */}
              <div className="w-full max-w-md space-y-6">
                <div className="space-y-4">
                   <div className="text-[10px] tracking-[0.3em] font-bold text-neon-cyan/80 uppercase ml-1">
                     FIND YOUR RESORT
                   </div>
                   <div className="relative group">
                     <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                       <Search className={cn("w-5 h-5 transition-colors", isFetchingSuggestions ? "text-neon-cyan animate-pulse" : "text-white/30")} />
                     </div>
                     <input
                       type="text"
                       placeholder="Search resort or region..."
                       value={searchQuery}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && suggestions.length > 0) handleSelectResort(suggestions[0]);
                       }}
                       onChange={(e) => {
                         setSearchQuery(e.target.value);
                         setIsSearching(false);
                       }}
                       className="w-full bg-[#0a1120] border border-slate-700/50 rounded-xl py-5 pl-14 pr-6 text-white placeholder:text-white/20 text-lg font-mono focus:outline-none focus:border-neon-cyan/40 transition-all shadow-inner"
                     />

                     {/* Suggestions for Landing Page */}
                     <AnimatePresence>
                        {suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5"
                          >
                            {suggestions.map((resort, i) => (
                              <button
                                key={i}
                                onClick={() => handleSelectResort(resort)}
                                className="w-full py-5 px-6 flex items-center justify-between hover:bg-white/5 transition-colors text-left group"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-white uppercase tracking-widest group-hover:text-neon-cyan transition-colors">
                                    {resort.name}
                                  </span>
                                  {resort.location && (
                                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">
                                      {resort.location}
                                    </span>
                                  )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-neon-cyan opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                              </button>
                            ))}
                          </motion.div>
                        )}
                     </AnimatePresence>
                   </div>
                </div>

                <div className="text-center space-y-8">
                  <p className="text-xs text-white/30 font-medium">
                    Search any ski resort worldwide<br />
                    and get a real-time midlayer verdict 🏔️
                  </p>

                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      { name: 'Chamonix', lat: 45.9237, lon: 6.8694 },
                      { name: 'Whistler Blackcomb', lat: 50.1150, lon: -122.9486 },
                      { name: 'Niseko United', lat: 42.8631, lon: 140.6720 },
                      { name: 'Zermatt', lat: 46.0207, lon: 7.7491 },
                      { name: 'Jackson Hole', lat: 43.5875, lon: -110.8279 }
                    ].map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => handleSelectResort(tag)}
                        className="px-5 py-2.5 bg-slate-900/30 border border-slate-800 rounded-full text-xs font-medium text-white/40 hover:text-white hover:border-white/20 transition-all"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>

                  <div className="pt-12 text-[9px] tracking-[0.2em] font-bold text-white/20 uppercase whitespace-nowrap">
                    LIVE WEB SEARCH • 390+ RESORTS • ★ EPIC ♦ IKON ♦ PRIVATE
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full space-y-6 pt-12"
            >
              {/* Results Top Header */}
              <div className="flex justify-between items-center w-full max-w-md mx-auto mb-8">
                <button 
                  onClick={() => {
                    aiVerdictRequestIdRef.current += 1;
                    aiVerdictLoadingGateRef.current = false;
                    setIsAiVerdictLoading(false);
                    setWeather(null);
                  }}
                  className="p-2 bg-slate-900 rounded-full border border-slate-800"
                >
                   <MapPin className="w-4 h-4 text-neon-cyan" />
                </button>
                <div className="text-center">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/40 leading-none mb-1">Resort Profile</h2>
                  <p className="text-lg font-display font-bold italic tracking-[0.05em] text-white uppercase italic">{weather.resortName}</p>
                </div>
                <button 
                  onClick={() => handleSelectResort({ name: weather.resortName, lat: 0, lon: 0 })}
                  className={cn(
                    "p-2 bg-slate-900 rounded-full border border-slate-800 transition-transform active:scale-95",
                    isLoading && "animate-spin"
                  )}
                >
                   <RefreshCw className="w-4 h-4 text-neon-cyan" />
                </button>
              </div>

              <div className="w-full max-w-md mx-auto space-y-4">
                 {/* Results content remains similar to previous iteration but refined */}
                 <div className="bg-slate-950/50 rounded-[40px] border-2 border-slate-800 p-10 text-center relative overflow-hidden shadow-inner flex flex-col items-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Status</p>
                  <motion.div
                    key={needsMidLayer ? 'YES' : 'NO'}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "text-[120px] leading-none font-black text-white italic tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] mb-2",
                      needsMidLayer ? "text-glow-pink" : "text-glow-cyan"
                    )}
                  >
                    {needsMidLayer ? "YES" : "NO"}
                  </motion.div>
                  <div className={cn(
                    "font-bold text-sm tracking-[0.2em] animate-pulse uppercase italic",
                    needsMidLayer ? "text-neon-pink" : "text-neon-cyan"
                  )}>
                    {needsMidLayer ? "COLD PROTOCOL ACTIVE" : "STANDARD LAYERING DETECTED"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card rounded-3xl p-5 flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold">Goggle Lens</span>
                    <span className={cn(
                      "text-[11px] font-black leading-tight uppercase text-center italic",
                      goggleLens === "LOW LIGHT" ? "text-neon-cyan" : "text-amber-400"
                    )}>
                      {goggleLens}
                    </span>
                  </div>
                  <div className="glass-card rounded-3xl p-5 flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Ambient Temp</span>
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-display font-black">{convertTemp(activeWeather!.temp)}°</span>
                        <span className="text-xs text-slate-400 font-bold">{unit}</span>
                      </div>
                      <span className="text-[9px] text-cyan-400/80 font-bold uppercase tracking-tight">
                        Feels like {convertTemp(activeWeather!.apparentTemp)}°
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-cyan-950/20 border border-cyan-500/20 rounded-3xl p-6 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse"></div>
                    <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em]">AI Verdict</span>
                  </div>
                  <div className="text-[13px] text-slate-200 leading-relaxed font-sans font-medium tracking-tight opacity-95 markdown-verdict">
                    {aiVerdict ? (
                      <Markdown>{aiVerdict}</Markdown>
                    ) : (
                      <p>"DECODING MOUNTAIN DATA..."</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {weather.forecast.map((day, idx) => {
                    const date = new Date(day.date);
                    const isSelected = selectedDayIndex === idx;
                    const dayName = idx === 0 ? "LIVE" : date.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={isAiVerdictLoading}
                        onClick={() => handleDaySelect(idx)}
                        className={cn(
                          "flex-shrink-0 w-20 flex flex-col items-center p-3 rounded-2xl border transition-all duration-300",
                          isSelected 
                            ? "bg-neon-cyan/10 border-neon-cyan ring-2 ring-neon-cyan/20" 
                            : "bg-white/5 border-white/5 hover:bg-white/10",
                          isAiVerdictLoading && "opacity-40 cursor-not-allowed hover:bg-white/5"
                        )}
                      >
                        <span className={cn("text-[9px] font-black uppercase tracking-wider mb-2", isSelected ? "text-neon-cyan" : "text-white/40")}>{dayName}</span>
                        <span className="text-lg font-black mb-1">{convertTemp(day.temp)}°</span>
                        <div className="text-xs opacity-60">
                          {day.condition === 'snow' ? '❄️' : day.condition === 'rain' ? '🌧️' : day.condition === 'sunny' ? '☀️' : '☁️'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Search Bar (Small) for Results Page */}
              <div className="w-full max-w-md mx-auto pt-8">
                 <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                       <Search className={cn("w-4 h-4 transition-colors", isFetchingSuggestions ? "text-neon-cyan animate-pulse" : "text-white/30")} />
                    </div>
                    <input
                      type="text"
                      placeholder="SCAN ANOTHER RESORT..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsSearching(false);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold tracking-widest text-neon-cyan placeholder:text-white/10 uppercase focus:border-neon-cyan/30 transition-all"
                    />
                    {isFetchingSuggestions && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                         <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-ping"></div>
                      </div>
                    )}
                    {suggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-50">
                        {suggestions.map((resort, i) => (
                            <button
                              key={i}
                              onClick={() => handleSelectResort(resort)}
                              className="w-full py-4 px-5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group"
                            >
                              <div className="text-[11px] font-black text-white uppercase tracking-widest group-hover:text-neon-cyan transition-colors">
                                {resort.name}
                              </div>
                              {resort.location && (
                                <div className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">
                                  {resort.location}
                                </div>
                              )}
                            </button>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-10 left-10 text-[8px] font-mono text-slate-700 tracking-[0.2em]"> STATION_ID: W_BLK_881 </div>
      <div className="absolute bottom-10 right-10 text-[8px] font-mono text-slate-700 tracking-[0.2em] text-right"> UI_ENGINE: RAD_OS </div>
    </div>
  );
}
