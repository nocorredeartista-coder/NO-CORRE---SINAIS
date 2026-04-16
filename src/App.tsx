import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  BarChart3, 
  Zap, 
  Settings2, 
  History, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Digit, Stats, Signal, Management, Performance } from './types';
import { cn } from '@/lib/utils';

export default function App() {
  const [digits, setDigits] = useState<Digit[]>([]);
  const [activeTab, setActiveTab] = useState('flow');
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [symbol, setSymbol] = useState('1HZ100V');
  const [lastPrice, setLastPrice] = useState<string | null>(null);
  const [autoPerformance, setAutoPerformance] = useState<{
    wins: number;
    losses: number;
    history: { prediction: 'par' | 'impar'; actual: 'par' | 'impar'; result: 'win' | 'loss'; timestamp: number }[];
  }>({ wins: 0, losses: 0, history: [] });
  const [voicePerformance, setVoicePerformance] = useState<{
    wins: number;
    losses: number;
  }>({ wins: 0, losses: 0 });
  const pendingPredictionRef = useRef<'par' | 'impar' | null>(null);
  const pendingVoicePredictionRef = useRef<'par' | 'impar' | null>(null);
  const [soundSettings, setSoundSettings] = useState({
    master: true,
    ticks: true,
    streaks: true,
    highProb: true
  });
  const [voiceSuggestionsEnabled, setVoiceSuggestionsEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSpokenPredictionRef = useRef<string | null>(null);
  const hasPlayedHighProbForCurrentStreak = useRef(false);

  const speak = useCallback((text: string) => {
    if (!voiceSuggestionsEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.2;
    window.speechSynthesis.speak(utterance);
  }, [voiceSuggestionsEnabled]);

  const playTickSound = useCallback(() => {
    if (!soundSettings.master || !soundSettings.ticks) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // High pitch subtle tick
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.05, ctx.currentTime); // Very subtle volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.error('Error playing sound:', e);
    }
  }, [soundSettings]);

  const playAlertSound = useCallback(() => {
    if (!soundSettings.master || !soundSettings.streaks) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'square'; // More aggressive sound for alert
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error('Error playing alert sound:', e);
    }
  }, [soundSettings]);

  const playHighProbSound = useCallback(() => {
    if (!soundSettings.master || !soundSettings.highProb) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error('Error playing high prob sound:', e);
    }
  }, [soundSettings]);

  const [management, setManagement] = useState<Management>({
    stake: 1.00,
    stopLoss: 10.00,
    stopWin: 20.00,
    galeLevel: 0
  });
  const [performance, setPerformance] = useState<Performance>({
    wins: 0,
    losses: 0,
    winRate: 0,
    history: []
  });

  // Deriv WebSocket Connection
  useEffect(() => {
    const app_id = 1089; // Default app_id for testing
    const socket = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({ ticks: symbol }));
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.tick) {
        const pipSize = data.tick.pip_size || 0;
        const quoteStr = data.tick.quote.toFixed(pipSize);
        const lastDigit = parseInt(quoteStr.slice(-1));
        const type = lastDigit % 2 === 0 ? 'par' : 'impar';
        
        // Verify previous automated prediction
        if (pendingPredictionRef.current) {
          const result = pendingPredictionRef.current === type ? 'win' : 'loss';
          
          setAutoPerformance(prev => {
            const newWins = result === 'win' ? prev.wins + 1 : prev.wins;
            const newLosses = result === 'loss' ? prev.losses + 1 : prev.losses;
            const newHistory = [{ 
              prediction: pendingPredictionRef.current!, 
              actual: type, 
              result, 
              timestamp: Date.now() 
            }, ...prev.history].slice(0, 50);
            return { wins: newWins, losses: newLosses, history: newHistory };
          });
          pendingPredictionRef.current = null;
        }

        // Verify previous voice prediction
        if (pendingVoicePredictionRef.current) {
          const result = pendingVoicePredictionRef.current === type ? 'win' : 'loss';
          setVoicePerformance(prev => ({
            wins: result === 'win' ? prev.wins + 1 : prev.wins,
            losses: result === 'loss' ? prev.losses + 1 : prev.losses
          }));
          pendingVoicePredictionRef.current = null;
        }

        setLastPrice(quoteStr);
        const newDigit: Digit = {
          value: lastDigit,
          timestamp: data.tick.epoch * 1000,
          type: lastDigit % 2 === 0 ? 'par' : 'impar'
        };
        setDigits(prev => [newDigit, ...prev].slice(0, 100));
        playTickSound();
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [symbol]);

  const stats = useMemo<Stats>(() => {
    const recent = digits.slice(0, 50);
    const evenCount = recent.filter(d => d.type === 'par').length;
    const oddCount = recent.length - evenCount;
    const total = recent.length || 1;

    let currentStreakType: 'par' | 'impar' | null = null;
    let currentStreakCount = 0;

    if (digits.length > 0) {
      currentStreakType = digits[0].type;
      for (const d of digits) {
        if (d.type === currentStreakType) {
          currentStreakCount++;
        } else {
          break;
        }
      }
    }

    // Advanced Math Calculations
    const breakProbability = 100 * (1 - Math.pow(0.5, currentStreakCount));

    const digitFrequency: Record<number, number> = {};
    const digitGaps: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) {
      digitFrequency[i] = digits.filter(d => d.value === i).length;
      const lastIndex = digits.findIndex(d => d.value === i);
      digitGaps[i] = lastIndex === -1 ? digits.length : lastIndex;
    }

    // Suggest next based on "Gap Analysis" (Cold numbers)
    const expectedNext = Object.entries(digitGaps)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([num]) => parseInt(num));

    // Pattern Analysis (Last 50)
    let alternations = 0;
    let repetitions = 0;
    const patterns: Record<string, number> = {};
    
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i].type !== recent[i + 1].type) {
        alternations++;
      } else {
        repetitions++;
      }
      
      // Look for 3-digit patterns
      if (i < recent.length - 2) {
        const p = `${recent[i].type[0]}${recent[i+1].type[0]}${recent[i+2].type[0]}`;
        patterns[p] = (patterns[p] || 0) + 1;
      }
    }

    const commonPatterns = Object.entries(patterns)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([pattern, count]) => ({ pattern, count }));

    const alternationRate = (alternations / (recent.length - 1 || 1)) * 100;
    const repetitionRate = (repetitions / (recent.length - 1 || 1)) * 100;

    // Auto Prediction Logic
    let prediction: 'par' | 'impar' | 'aguardar' = 'aguardar';
    let confidence = 0;
    let reason = "Aguardando padrões claros...";

    if (recent.length >= 20) {
      const evenP = (evenCount / recent.length) * 100;
      const oddP = (oddCount / recent.length) * 100;
      
      // Strategy 1: High Streak Exhaustion (5+ Ticks) - ENTRY SIGNAL
      if (currentStreakCount >= 5) {
        prediction = currentStreakType === 'par' ? 'impar' : 'par';
        confidence = 92 + Math.min(currentStreakCount, 5); 
        reason = `ENTRADA CONFIRMADA: ${currentStreakCount} ${currentStreakType}s seguidos. Alta probabilidade de reversão.`;
      }
      // Strategy 1.5: Probability Alert (4 Ticks) - WARNING ONLY
      else if (currentStreakCount === 4) {
        prediction = 'aguardar'; 
        confidence = breakProbability;
        reason = `ALERTA DE PROBABILIDADE: ${currentStreakCount} ${currentStreakType}s seguidos. Chance de quebra: ${breakProbability.toFixed(1)}%.`;
      } 
      // Other strategies disabled per user focus on 5-tick pattern
    }

    // Voice Suggestion Trigger
    const streakKey = `${currentStreakType}-${currentStreakCount}`;
    
    // 4 Ticks Alert
    if (currentStreakCount === 4 && lastSpokenPredictionRef.current !== streakKey) {
      speak(`Atenção. ${breakProbability.toFixed(0)} por cento de probabilidade.`);
      lastSpokenPredictionRef.current = streakKey;
    } 
    // 5+ Ticks Entry
    else if (prediction !== 'aguardar' && currentStreakCount >= 5 && lastSpokenPredictionRef.current !== streakKey) {
      speak(`${prediction === 'par' ? 'Par' : 'Ímpar'}. ${confidence.toFixed(0)} por cento de acerto.`);
      lastSpokenPredictionRef.current = streakKey;
      pendingVoicePredictionRef.current = prediction;
    }
    // Other predictions (Trends, etc)
    else if (prediction !== 'aguardar' && currentStreakCount < 4 && prediction !== lastSpokenPredictionRef.current) {
      speak(`${prediction === 'par' ? 'Par' : 'Ímpar'}. ${confidence.toFixed(0)} por cento de acerto.`);
      lastSpokenPredictionRef.current = prediction;
      pendingVoicePredictionRef.current = prediction;
    }
    else if (prediction === 'aguardar' && currentStreakCount < 4) {
      lastSpokenPredictionRef.current = null;
    }

    return {
      evenCount,
      oddCount,
      evenPercentage: (evenCount / total) * 100,
      oddPercentage: (oddCount / total) * 100,
      currentStreak: {
        type: currentStreakType,
        count: currentStreakCount
      },
      breakProbability,
      digitFrequency,
      digitGaps,
      expectedNext,
      patternAnalysis: {
        alternationRate,
        repetitionRate,
        commonPatterns
      },
      autoPrediction: {
        type: prediction,
        confidence: Math.min(confidence, 99),
        reason
      }
    };
  }, [digits, speak]);

  // Streak Alert Effect
  useEffect(() => {
    if (stats.currentStreak.count >= 3) {
      playAlertSound();
    }
    
    if (stats.breakProbability >= 80) {
      if (!hasPlayedHighProbForCurrentStreak.current) {
        playHighProbSound();
        hasPlayedHighProbForCurrentStreak.current = true;
      }
    } else {
      hasPlayedHighProbForCurrentStreak.current = false;
    }
  }, [stats.currentStreak.count, stats.currentStreak.type, stats.breakProbability, playAlertSound, playHighProbSound]);

  // Update pending prediction for next tick
  useEffect(() => {
    if (stats.autoPrediction.type !== 'aguardar' && stats.autoPrediction.confidence >= 70) {
      pendingPredictionRef.current = stats.autoPrediction.type;
    } else {
      pendingPredictionRef.current = null;
    }
  }, [stats.autoPrediction.type, stats.autoPrediction.confidence]);

  const signal = useMemo<Signal>(() => {
    if (digits.length < 10) return { type: 'aguardar', confidence: 'baixa', reason: 'Aguardando mais dados...' };

    const recent10 = digits.slice(0, 10);
    const even10 = recent10.filter(d => d.type === 'par').length;
    const odd10 = recent10.length - even10;

    if (even10 >= 7) {
      return { 
        type: 'par', 
        confidence: 'alta', 
        reason: `${even10 * 10}% de pares nos últimos 10 ticks. Forte tendência de repetição.` 
      };
    }
    if (odd10 >= 7) {
      return { 
        type: 'impar', 
        confidence: 'alta', 
        reason: `${odd10 * 10}% de ímpares nos últimos 10 ticks. Forte tendência de repetição.` 
      };
    }
    if (stats.currentStreak.count >= 4) {
      const opposite = stats.currentStreak.type === 'par' ? 'impar' : 'par';
      return { 
        type: opposite, 
        confidence: 'media', 
        reason: `Sequência de ${stats.currentStreak.count} ${stats.currentStreak.type}s. Possível quebra de padrão.` 
      };
    }

    return { type: 'aguardar', confidence: 'baixa', reason: 'Mercado em zona neutra. Sem padrões claros.' };
  }, [digits, stats]);

  const handleSimulateTrade = (result: 'win' | 'loss') => {
    const profit = result === 'win' ? management.stake * 0.95 : -management.stake;
    setPerformance(prev => {
      const newWins = result === 'win' ? prev.wins + 1 : prev.wins;
      const newLosses = result === 'loss' ? prev.losses + 1 : prev.losses;
      const newHistory = [{ result, profit, timestamp: Date.now() }, ...prev.history].slice(0, 50);
      return {
        wins: newWins,
        losses: newLosses,
        winRate: (newWins / (newWins + newLosses)) * 100,
        history: newHistory
      };
    });
  };

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      setLastCommand(command);
      handleVoiceCommand(command);
      
      // Visual feedback for command
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg z-50 animate-bounce';
      toast.innerText = `Comando: "${command}"`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    };

    recognition.onend = () => {
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Recognition restart error:', e);
        }
      }
    };

    recognitionRef.current = recognition;

    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }

    return () => {
      recognition.stop();
    };
  }, [isListening]);

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  const handleVoiceCommand = (command: string) => {
    console.log('Voice Command:', command);
    
    // Tab Navigation
    if (command.includes('fluxo')) setActiveTab('flow');
    if (command.includes('análise') || command.includes('analise')) setActiveTab('analysis');
    if (command.includes('sinais') || command.includes('sinal')) setActiveTab('signals');
    if (command.includes('gestão') || command.includes('gestao')) setActiveTab('management');
    if (command.includes('desempenho') || command.includes('performance')) setActiveTab('performance');

    // Trade Registration
    if (command.includes('win') || command.includes('ganhei') || command.includes('venci')) {
      handleSimulateTrade('win');
    }
    if (command.includes('loss') || command.includes('perdi') || command.includes('derrota')) {
      handleSimulateTrade('loss');
    }

    // Stake Management
    if (command.includes('aumentar entrada') || command.includes('aumentar stake')) {
      setManagement(m => ({ ...m, stake: m.stake + 1 }));
    }
    if (command.includes('diminuir entrada') || command.includes('diminuir stake')) {
      setManagement(m => ({ ...m, stake: Math.max(0.35, m.stake - 1) }));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <Activity className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">NO CORRE - DOLLAR</h1>
            </div>
            <p className="text-zinc-500 text-sm font-medium">ESTRATÉGIA DE DÍGITOS • ANÁLISE DERIV</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Voice Accuracy Badge */}
            <AnimatePresence>
              {(voicePerformance.wins + voicePerformance.losses > 0) && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hidden lg:flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full shadow-lg"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Acertabilidade Voz:</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {((voicePerformance.wins / (voicePerformance.wins + voicePerformance.losses || 1)) * 100).toFixed(0)}%
                  </span>
                  <div className="flex gap-1 ml-1">
                    <span className="text-[10px] text-green-500 font-bold">{voicePerformance.wins}W</span>
                    <span className="text-[10px] text-red-500 font-bold">{voicePerformance.losses}L</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
              <Popover>
                <PopoverTrigger 
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 px-2 gap-2",
                    soundSettings.master ? "text-blue-500 hover:text-blue-400" : "text-zinc-500 hover:text-zinc-400"
                  )}
                >
                  {soundSettings.master ? <Volume2 className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span className="text-[10px] font-bold uppercase hidden sm:inline">
                    {soundSettings.master ? "Som" : "Mudo"}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-56 bg-zinc-950 border-zinc-800 p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase">Som Master</span>
                      <Switch 
                        checked={soundSettings.master} 
                        onCheckedChange={(val) => setSoundSettings(s => ({ ...s, master: val }))} 
                      />
                    </div>
                    <Separator className="bg-zinc-800" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Ticks (Mercado)</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-zinc-600" onClick={(e) => { e.stopPropagation(); playTickSound(); }}>
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Switch 
                          disabled={!soundSettings.master}
                          checked={soundSettings.ticks} 
                          onCheckedChange={(val) => setSoundSettings(s => ({ ...s, ticks: val }))} 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Alertas de Streak</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-zinc-600" onClick={(e) => { e.stopPropagation(); playAlertSound(); }}>
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Switch 
                          disabled={!soundSettings.master}
                          checked={soundSettings.streaks} 
                          onCheckedChange={(val) => setSoundSettings(s => ({ ...s, streaks: val }))} 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Probabilidade {'>'} 80%</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-zinc-600" onClick={(e) => { e.stopPropagation(); playHighProbSound(); }}>
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Switch 
                          disabled={!soundSettings.master}
                          checked={soundSettings.highProb} 
                          onCheckedChange={(val) => setSoundSettings(s => ({ ...s, highProb: val }))} 
                        />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Separator orientation="vertical" className="h-4 bg-zinc-800" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setVoiceSuggestionsEnabled(!voiceSuggestionsEnabled)}
                className={cn(
                  "h-8 px-2 gap-2",
                  voiceSuggestionsEnabled ? "text-yellow-500 hover:text-yellow-400" : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase hidden sm:inline">
                  {voiceSuggestionsEnabled ? "Voz Ativa" : "Voz Off"}
                </span>
              </Button>
              <Separator orientation="vertical" className="h-4 bg-zinc-800" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleListening}
                className={cn(
                  "h-8 px-2 gap-2",
                  isListening ? "text-red-500 hover:text-red-400" : "text-zinc-400 hover:text-zinc-300"
                )}
              >
                {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
                <span className="text-[10px] font-bold uppercase hidden sm:inline">
                  {isListening ? "Ouvindo..." : "Voz Desativada"}
                </span>
              </Button>
              {lastCommand && isListening && (
                <div className="px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-blue-400 max-w-[150px] truncate">
                  "{lastCommand}"
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-auto grid grid-cols-3 md:grid-cols-5 gap-1">
              <TabsTrigger value="flow" className="data-[state=active]:bg-zinc-800 py-2">
                <Activity className="w-4 h-4 mr-2" />
                Fluxo
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-zinc-800 py-2">
                <BarChart3 className="w-4 h-4 mr-2" />
                Análise
              </TabsTrigger>
              <TabsTrigger value="signals" className="data-[state=active]:bg-zinc-800 py-2">
                <Zap className="w-4 h-4 mr-2" />
                Sinais
              </TabsTrigger>
              <TabsTrigger value="management" className="data-[state=active]:bg-zinc-800 py-2">
                <Settings2 className="w-4 h-4 mr-2" />
                Gestão
              </TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-zinc-800 py-2">
                <History className="w-4 h-4 mr-2" />
                Desempenho
              </TabsTrigger>
            </TabsList>

            {/* TELA 1 — FLUXO AO VIVO */}
            <TabsContent value="flow" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 hardware-panel border-zinc-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-zinc-100 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Fluxo de Dígitos Real-Time ({symbol})
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <select 
                          value={symbol} 
                          onChange={(e) => setSymbol(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 text-xs rounded px-2 py-1 text-zinc-300 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="R_10">Volatility 10</option>
                          <option value="R_25">Volatility 25</option>
                          <option value="R_50">Volatility 50</option>
                          <option value="R_75">Volatility 75</option>
                          <option value="R_100">Volatility 100</option>
                          <option value="1HZ10V">Volatility 10 (1s)</option>
                          <option value="1HZ100V">Volatility 100 (1s)</option>
                        </select>
                        <Badge variant="outline" className={cn(
                          "transition-colors",
                          isConnected ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                        )}>
                          {isConnected ? 'Conectado' : 'Desconectado'}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-zinc-500 flex items-center justify-between">
                      <span>Últimos ticks recebidos do mercado</span>
                      <a 
                        href={`https://app.deriv.com/dtrader?symbol=${symbol}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-xs"
                      >
                        Ver Gráfico Oficial
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Alerta de Sequência */}
                    <AnimatePresence>
                      {stats.currentStreak.count >= 3 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={cn(
                            "p-3 rounded-lg border flex items-center justify-between animate-pulse",
                            stats.currentStreak.type === 'par' 
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                              : "bg-red-500/10 border-red-500/30 text-red-400"
                          )}>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">
                                Alerta de Sequência: {stats.currentStreak.count} {stats.currentStreak.type === 'par' ? 'Pares' : 'Ímpares'} seguidos!
                              </span>
                            </div>
                            <Badge className={cn(
                              "font-mono",
                              stats.currentStreak.type === 'par' ? "bg-blue-600" : "bg-red-600"
                            )}>
                              {stats.breakProbability.toFixed(0)}% QUEBRA
                            </Badge>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Preço Atual */}
                    <div className="flex items-center justify-center p-6 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest mb-1">Preço Atual</p>
                        <div className="text-4xl font-mono font-bold tracking-tighter">
                          {lastPrice ? (
                            <>
                              <span className="text-zinc-400">{lastPrice.slice(0, -1)}</span>
                              <span className={cn(
                                "text-5xl",
                                parseInt(lastPrice.slice(-1)) % 2 === 0 ? "text-blue-500" : "text-red-500"
                              )}>
                                {lastPrice.slice(-1)}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-700">---</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      <AnimatePresence mode="popLayout">
                        {digits.slice(0, 20).map((digit, idx) => (
                          <motion.div
                            key={digit.timestamp}
                            initial={{ scale: 0.5, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className={cn(
                              "digit-card h-14",
                              digit.type === 'par' ? "digit-even" : "digit-odd",
                              idx === 0 && "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                            )}
                          >
                            {digit.value}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hardware-panel border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-100 text-lg">Distribuição (50)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-400 font-bold">PAR</span>
                        <span className="text-zinc-400">{stats.evenCount} ({stats.evenPercentage.toFixed(0)}%)</span>
                      </div>
                      <Progress value={stats.evenPercentage} className="h-2 bg-zinc-800 [&>div]:bg-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400 font-bold">ÍMPAR</span>
                        <span className="text-zinc-400">{stats.oddCount} ({stats.oddPercentage.toFixed(0)}%)</span>
                      </div>
                      <Progress value={stats.oddPercentage} className="h-2 bg-zinc-800 [&>div]:bg-red-500" />
                    </div>
                    
                    <Separator className="bg-zinc-800" />
                    
                    <div className="pt-2">
                      <p className="text-xs text-zinc-500 uppercase font-bold mb-3 tracking-wider">Sequência Atual</p>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold",
                          stats.currentStreak.type === 'par' ? "bg-blue-500/20 text-blue-500" : "bg-red-500/20 text-red-500"
                        )}>
                          {stats.currentStreak.count}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-200">{stats.currentStreak.type === 'par' ? 'PARES' : 'ÍMPARES'}</p>
                          <p className="text-xs text-zinc-500">Consecutivos</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TELA 2 — LEITURA DO MERCADO */}
            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hardware-panel border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-100 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Análise de Probabilidade
                    </CardTitle>
                    <CardDescription>Cálculos baseados em exaustão de sequência</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-400">Probabilidade de Quebra</span>
                        <span className={cn(
                          "text-2xl font-black font-mono",
                          stats.breakProbability > 80 ? "text-red-500" : "text-blue-400"
                        )}>
                          {stats.breakProbability.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={stats.breakProbability} 
                        className={cn(
                          "h-3 bg-zinc-800",
                          stats.breakProbability > 80 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"
                        )} 
                      />
                      <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        *A probabilidade aumenta exponencialmente conforme a sequência de {stats.currentStreak.type}s se prolonga.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Taxa de Alternância</p>
                        <p className="text-xl font-mono font-bold text-yellow-500">{stats.patternAnalysis.alternationRate.toFixed(1)}%</p>
                      </div>
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Taxa de Repetição</p>
                        <p className="text-xl font-mono font-bold text-blue-500">{stats.patternAnalysis.repetitionRate.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Padrões Comuns (3-Ticks)</p>
                      <div className="flex flex-wrap gap-2">
                        {stats.patternAnalysis.commonPatterns.map((p, i) => (
                          <Badge key={i} variant="outline" className="bg-zinc-900 border-zinc-800 py-1 px-3">
                            <span className="font-mono tracking-widest mr-2">{p.pattern}</span>
                            <span className="text-zinc-500">{p.count}x</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hardware-panel border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-100 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Sugestão de Próximo Dígito
                    </CardTitle>
                    <CardDescription>Baseado em Gap Analysis (Números Atrasados)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex justify-around items-center py-4">
                      {stats.expectedNext.map((num, i) => (
                        <div key={num} className="text-center space-y-2">
                          <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black border-2",
                            i === 0 ? "bg-yellow-500/20 border-yellow-500 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                          )}>
                            {num}
                          </div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase">
                            {i === 0 ? 'Mais Provável' : `Atraso: ${stats.digitGaps[num]}`}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Top 5 Frequência (100)</p>
                      <div className="flex gap-2">
                        {Object.entries(stats.digitFrequency as Record<number, number>)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 5)
                          .map(([num, freq]) => (
                            <Badge key={num} variant="outline" className="bg-zinc-900 border-zinc-800 py-1 px-3">
                              {num}: <span className="text-blue-400 ml-1">{freq}</span>
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="hardware-panel border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-100 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    Guia de Padrões e Tendências
                  </CardTitle>
                  <CardDescription>Entenda o significado dos padrões de 3 ticks na análise de dígitos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-blue-600 font-mono">PPP</Badge>
                        <Badge className="bg-red-600 font-mono">III</Badge>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-200">Sequências (Trends)</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Indica uma força dominante de Pares ou Ímpares. Sequências de 3 são comuns, mas ao atingir 4 ou 5, a probabilidade de <span className="text-blue-400 font-bold">Exaustão</span> aumenta drasticamente, sugerindo uma entrada na direção oposta.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-zinc-700 font-mono">PIP</Badge>
                        <Badge className="bg-zinc-700 font-mono">IPI</Badge>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-200">Alternância (Chop)</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        O mercado está "picotado" ou em equilíbrio. Quando esse padrão se repete, indica uma <span className="text-yellow-500 font-bold">Tendência de Alternância</span>. Estratégias de "Follow the Flow" (seguir a troca) são eficazes aqui.
                      </p>
                    </div>

                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-zinc-800 border-zinc-700 font-mono">PPI</Badge>
                        <Badge className="bg-zinc-800 border-zinc-700 font-mono">IIP</Badge>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-200">Quebra de Início</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Geralmente sinaliza o <span className="text-green-500 font-bold">Fim de uma Micro-Tendência</span>. Se o mercado vinha de uma sequência longa e apresenta uma quebra, pode ser o início de um novo ciclo de alternância ou de uma tendência oposta.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hardware-panel border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-100">Frequência Detalhada por Dígito (0-9)</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                  <div className="flex items-end justify-between h-full gap-1 pt-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                      const freq = (stats.digitFrequency as Record<number, number>)[i] || 0;
                      const allFreqs = Object.values(stats.digitFrequency as Record<number, number>);
                      const maxFreq = Math.max(...allFreqs, 1);
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                          <div className="relative w-full flex flex-col justify-end h-full">
                            <div 
                              className={cn(
                                "w-full rounded-t-sm border-t border-x transition-all duration-500",
                                i % 2 === 0 ? "bg-blue-500/40 border-blue-500/20" : "bg-red-500/40 border-red-500/20",
                                freq === maxFreq && "bg-opacity-80 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                              )} 
                              style={{ height: `${(freq / maxFreq) * 100}%` }} 
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 whitespace-nowrap">
                              {freq} ocorrências
                            </div>
                          </div>
                          <span className={cn(
                            "text-[10px] font-mono font-bold",
                            i % 2 === 0 ? "text-blue-400" : "text-red-400"
                          )}>{i}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TELA 3 — SINAL OPERACIONAL */}
            <TabsContent value="signals" className="space-y-6">
              <Card className="hardware-panel border-zinc-800 overflow-hidden">
                <div className={cn(
                  "h-2 w-full",
                  stats.autoPrediction.type === 'par' ? "bg-blue-600" : stats.autoPrediction.type === 'impar' ? "bg-red-600" : "bg-zinc-700"
                )} />
                <CardContent className="p-8 space-y-8">
                  <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-6 text-center md:text-left">
                      <div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">Auto-Palpite (IA Estatística)</p>
                        <div className="relative inline-block">
                          <AnimatePresence>
                            {stats.autoPrediction.type !== 'aguardar' && (
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ 
                                  scale: [1, 1.2, 1],
                                  opacity: [0.1, 0.3, 0.1]
                                }}
                                transition={{ 
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                                className={cn(
                                  "absolute -inset-4 rounded-full blur-3xl",
                                  stats.autoPrediction.type === 'par' ? "bg-blue-500" : "bg-red-500"
                                )}
                              />
                            )}
                          </AnimatePresence>
                          <h2 className={cn(
                            "relative text-6xl font-black tracking-tighter",
                            stats.autoPrediction.type === 'par' ? "text-blue-500" : stats.autoPrediction.type === 'impar' ? "text-red-500" : "text-zinc-400"
                          )}>
                            {stats.autoPrediction.type?.toUpperCase() || ''}
                          </h2>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Confiança</p>
                          <p className={cn(
                            "font-bold",
                            stats.autoPrediction.confidence > 80 ? "text-green-400" : stats.autoPrediction.confidence > 60 ? "text-yellow-400" : "text-zinc-400"
                          )}>
                            {stats.autoPrediction.confidence.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">Estratégia</p>
                          <p className="font-bold text-zinc-200">
                            {stats.autoPrediction.reason.includes('Exaustão') ? 'EXAUSTÃO' : stats.autoPrediction.reason.includes('Tendência') ? 'TENDÊNCIA' : 'PADRÃO'}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 flex gap-3">
                        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-zinc-400 leading-relaxed">
                          <span className="text-zinc-200 font-bold">Análise:</span> {stats.autoPrediction.reason}
                        </p>
                      </div>
                    </div>

                    <div className="w-full md:w-72 space-y-4">
                      <Button 
                        onClick={() => handleSimulateTrade('win')}
                        className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg font-bold shadow-[0_0_20px_rgba(22,163,74,0.3)]"
                      >
                        <CheckCircle2 className="mr-2" /> WIN
                      </Button>
                      <Button 
                        onClick={() => handleSimulateTrade('loss')}
                        variant="outline" 
                        className="w-full h-16 border-red-600/50 text-red-500 hover:bg-red-600/10 text-lg font-bold"
                      >
                        <XCircle className="mr-2" /> LOSS
                      </Button>
                      <p className="text-[10px] text-center text-zinc-500 uppercase font-medium">
                        Aperte para registrar o resultado na performance
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="md:col-span-1 space-y-4">
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Acertabilidade IA</p>
                        <p className="text-4xl font-black text-white">
                          {((autoPerformance.wins / (autoPerformance.wins + autoPerformance.losses || 1)) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-zinc-500 uppercase font-black">Wins</span>
                          <span className="text-lg font-bold text-green-500">{autoPerformance.wins}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-zinc-500 uppercase font-black">Losses</span>
                          <span className="text-lg font-bold text-red-500">{autoPerformance.losses}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-3">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Histórico Recente de Palpites</p>
                      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {autoPerformance.history.length === 0 ? (
                          <div className="w-full text-center py-4 border border-dashed border-zinc-800 rounded-lg">
                            <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Aguardando processamento de dados...</p>
                          </div>
                        ) : (
                          autoPerformance.history.map((h, i) => (
                            <div key={i} className="flex-shrink-0 w-24 p-2 bg-zinc-900/50 rounded border border-zinc-800/50 space-y-1">
                              <div className="flex justify-between items-center">
                                <Badge variant="outline" className={cn(
                                  "text-[7px] px-1 h-3 border-none bg-zinc-800",
                                  h.prediction === 'par' ? "text-blue-400" : "text-red-400"
                                )}>
                                  {h.prediction?.toUpperCase() || ''}
                                </Badge>
                                <span className={cn(
                                  "text-[8px] font-black",
                                  h.result === 'win' ? "text-green-500" : "text-red-500"
                                )}>
                                  {h.result === 'win' ? 'WIN' : 'LOSS'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px]">
                                <span className="text-zinc-600">Saiu:</span>
                                <span className={cn(
                                  "font-bold",
                                  h.actual === 'par' ? "text-blue-400" : "text-red-400"
                                )}>{h.actual?.toUpperCase() || ''}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-200/70 leading-relaxed">
                    <span className="font-bold text-blue-400">AVISO:</span> Esta ferramenta fornece análise estatística. Não garantimos lucros. Opere com responsabilidade.
                  </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-medium">Auto-Gale</span>
                  <Badge variant="outline" className="text-zinc-500">DESATIVADO</Badge>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-medium">Delay de Entrada</span>
                  <span className="font-mono text-blue-400">0.5s</span>
                </div>
              </div>
            </TabsContent>

            {/* TELA 4 — GESTÃO */}
            <TabsContent value="management" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hardware-panel border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-100">Configurações de Stake</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Stake Inicial ($)</label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setManagement(m => ({...m, stake: Math.max(0.35, m.stake - 1)}))}>-1</Button>
                        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center font-mono font-bold text-xl">
                          {management.stake.toFixed(2)}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setManagement(m => ({...m, stake: m.stake + 1}))}>+1</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Stop Win ($)</label>
                        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md font-mono font-bold text-green-400 text-center">
                          {management.stopWin.toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Stop Loss ($)</label>
                        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-md font-mono font-bold text-red-400 text-center">
                          {management.stopLoss.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hardware-panel border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-100">Controle de Martingale</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Nível Máximo de Gale</span>
                        <Badge className="bg-blue-600">G{management.galeLevel}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3].map(level => (
                          <Button 
                            key={level}
                            variant={management.galeLevel === level ? "default" : "outline"}
                            size="sm"
                            onClick={() => setManagement(m => ({...m, galeLevel: level}))}
                            className={management.galeLevel === level ? "bg-blue-600" : ""}
                          >
                            G{level}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-2 font-bold uppercase">Projeção de Recuperação</p>
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500">Próxima Entrada</p>
                          <p className="font-mono font-bold">$ {(management.stake * 2.1).toFixed(2)}</p>
                        </div>
                        <TrendingUp className="text-blue-500 w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TELA 5 — PERFORMANCE */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="hardware-panel border-zinc-800">
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Taxa de Acerto</p>
                    <p className="text-4xl font-black text-blue-500">{performance.winRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card className="hardware-panel border-zinc-800">
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Wins</p>
                    <p className="text-4xl font-black text-green-500">{performance.wins}</p>
                  </CardContent>
                </Card>
                <Card className="hardware-panel border-zinc-800">
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Losses</p>
                    <p className="text-4xl font-black text-red-500">{performance.losses}</p>
                  </CardContent>
                </Card>
                <Card className="hardware-panel border-zinc-800">
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Profit Total</p>
                    <p className={cn(
                      "text-4xl font-black",
                      performance.history.reduce((acc, h) => acc + h.profit, 0) >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      $ {performance.history.reduce((acc, h) => acc + h.profit, 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="hardware-panel border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-100">Histórico de Operações</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {performance.history.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600">
                          Nenhuma operação registrada nesta sessão.
                        </div>
                      ) : (
                        performance.history.map((h, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                h.result === 'win' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                              )}>
                                {h.result === 'win' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{h.result?.toUpperCase() || ''}</p>
                                <p className="text-[10px] text-zinc-500">{new Date(h.timestamp).toLocaleTimeString()}</p>
                              </div>
                            </div>
                            <p className={cn(
                              "font-mono font-bold",
                              h.profit >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {h.profit >= 0 ? '+' : ''}{h.profit.toFixed(2)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="pt-8 pb-12 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
          <p>© 2026 NO CORRE - DOLLAR — ESTRATÉGIA DE DÍGITOS</p>
          <div className="flex gap-6">
            <span className="hover:text-zinc-400 cursor-pointer transition-colors">Termos de Uso</span>
            <span className="hover:text-zinc-400 cursor-pointer transition-colors">Privacidade</span>
            <span className="text-blue-500/50">v1.0.0-stable</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
