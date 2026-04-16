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
  Volume2,
  ShieldAlert,
  Target,
  Cpu,
  Layers,
  Eye,
  ArrowRight
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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Digit, Stats, Signal, Management, Performance, UserSettings, Intelligence, MarketStatus } from './types';
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
  const [userSettings, setUserSettings] = useState<UserSettings>({
    strategyFocus: 'sequencia',
    analysisWindow: 20,
    voiceEnbaled: false
  });
  const [marketMonitor, setMarketMonitor] = useState<MarketStatus[]>([]);
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
    const analysisWindow = userSettings.analysisWindow;
    const recent = digits.slice(0, analysisWindow);
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
    const evenPercentage = (evenCount / total) * 100;
    const oddPercentage = (oddCount / total) * 100;

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

    // Pattern Analysis
    let alternations = 0;
    let repetitions = 0;
    const patterns: Record<string, number> = {};
    
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i].type !== recent[i + 1].type) {
        alternations++;
      } else {
        repetitions++;
      }
      
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

    // --- Intelligence Layer ---
    const interpretation: string[] = [];
    const insights: string[] = [];
    const riskAlerts: string[] = [];
    let scoreValue = 50; // Base score

    // Parity Interpretation
    const dominantType = evenPercentage > oddPercentage ? 'PAR' : 'ÍMPAR';
    const dominantPct = Math.max(evenPercentage, oddPercentage);
    interpretation.push(`Predominância atual: ${dominantType} (${dominantPct.toFixed(0)}%)`);

    if (dominantPct > 60) {
      scoreValue += 15;
      insights.push(`Forte desequilíbrio para ${dominantType} detectado.`);
    } else if (dominantPct < 52) {
      interpretation.push("Mercado em equilíbrio quase perfeito.");
      scoreValue -= 5;
    }

    // Streak Interpretation
    if (currentStreakCount >= 3) {
      interpretation.push(`Sequência recente: ${currentStreakCount} dígitos ${currentStreakType === 'par' ? 'PARES' : 'ÍMPARES'}`);
      if (currentStreakCount >= 5) {
        scoreValue += 25;
        insights.push("Zona de exaustão extrema. Chance de reversão técnica.");
      }
    }

    // Alternation Interpretation
    if (alternationRate > 70) {
      interpretation.push("Alta alternância detectada (Mercado 'Picotado')");
      riskAlerts.push("Baixa previsibilidade de repetição.");
      scoreValue -= 10;
    } else if (alternationRate < 30) {
      interpretation.push("Baixa alternância — Tendência de fluxo direcional.");
      scoreValue += 10;
    }

    // Score Mapping
    let scoreLevel: 'favoravel' | 'neutro' | 'evitar' = 'neutro';
    let scoreColor: 'green' | 'yellow' | 'red' = 'yellow';

    if (scoreValue >= 70) {
      scoreLevel = 'favoravel';
      scoreColor = 'green';
    } else if (scoreValue < 40) {
      scoreLevel = 'evitar';
      scoreColor = 'red';
      riskAlerts.push("Zona de risco operacional — Padrões instáveis.");
    }

    // Auto Prediction Logic (Strategy Mapping)
    let prediction: 'par' | 'impar' | 'aguardar' = 'aguardar';
    let confidence = 0;
    let reason = "Aguardando padrões claros...";

    if (recent.length >= analysisWindow * 0.8) {
      // 1. Streak Exhaustion (Strongest)
      if (currentStreakCount >= 5) {
        prediction = currentStreakType === 'par' ? 'impar' : 'par';
        confidence = breakProbability;
        reason = `Exaustão de sequência (${currentStreakCount} ticks). Alta chance de reversão técnica.`;
      } 
      // 2. Percentual dominance
      else if (userSettings.strategyFocus === 'percentual' && dominantPct > 65) {
        prediction = dominantType === 'PAR' ? 'par' : 'impar';
        confidence = dominantPct;
        reason = `Forte predominância de ${dominantType}. Seguindo o fluxo estatístico.`;
      }
      // 3. Rompimento de alternância
      else if (userSettings.strategyFocus === 'rompimento' && alternationRate > 80 && currentStreakCount >= 2) {
        prediction = currentStreakType!; // Stay with the trend as it finally broke the alternation
        confidence = alternationRate;
        reason = `Rompimento de ciclo de alternância detectado.`;
      }
    }

    const intelligence: Intelligence = {
      interpretation,
      score: { value: Math.min(scoreValue, 100), level: scoreLevel, color: scoreColor },
      insights,
      riskAlerts
    };

    return {
      evenCount,
      oddCount,
      evenPercentage,
      oddPercentage,
      currentStreak: { type: currentStreakType, count: currentStreakCount },
      breakProbability,
      digitFrequency,
      digitGaps,
      expectedNext,
      patternAnalysis: { alternationRate, repetitionRate, commonPatterns },
      autoPrediction: { type: prediction, confidence: Math.min(confidence, 99), reason },
      intelligence
    };
  }, [digits, userSettings]);

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

  // Voice Suggestions Effect
  useEffect(() => {
    if (!voiceSuggestionsEnabled) return;

    const { autoPrediction, currentStreak, breakProbability, intelligence } = stats;
    const streakKey = `${currentStreak.type}-${currentStreak.count}`;

    // 4 Ticks Alert
    if (currentStreak.count === 4 && lastSpokenPredictionRef.current !== streakKey) {
      speak(`Atenção. ${breakProbability.toFixed(0)} por cento de probabilidade.`);
      lastSpokenPredictionRef.current = streakKey;
    } 
    // 5+ Ticks Entry or Strategy Hit
    else if (autoPrediction.type !== 'aguardar' && lastSpokenPredictionRef.current !== streakKey) {
      if (currentStreak.count >= 5 || autoPrediction.confidence >= 80) {
        const isMartingale = autoPerformance.history[0]?.result === 'loss';
        const msg = `${isMartingale ? 'Sugestão de Martingale.' : ''} ${autoPrediction.type === 'par' ? 'Par' : 'Ímpar'}. ${intelligence.score.value} por cento de acerto.`;
        speak(msg);
        lastSpokenPredictionRef.current = streakKey;
        pendingVoicePredictionRef.current = autoPrediction.type;
      }
    }
    
    if (currentStreak.count < 4 && autoPrediction.type === 'aguardar') {
      lastSpokenPredictionRef.current = null;
    }
  }, [stats, voiceSuggestionsEnabled, speak]);

  // Mock Multi-Market Monitor
  useEffect(() => {
    const markets = [
      { symbol: 'R_10', name: 'Volatility 10' },
      { symbol: 'R_25', name: 'Volatility 25' },
      { symbol: 'R_50', name: 'Volatility 50' },
      { symbol: 'R_75', name: 'Volatility 75' },
      { symbol: 'R_100', name: 'Volatility 100' },
      { symbol: '1HZ10V', name: 'Volatility 10 (1s)' },
      { symbol: '1HZ100V', name: 'Volatility 100 (1s)' }
    ];

    const interval = setInterval(() => {
      setMarketMonitor(markets.map(m => {
        const randomEven = 45 + Math.random() * 10;
        const randomScore = 30 + Math.random() * 60;
        let status: 'favoravel' | 'neutro' | 'evitar' = 'neutro';
        if (randomScore > 75) status = 'favoravel';
        if (randomScore < 45) status = 'evitar';

        return {
          ...m,
          evenPercentage: randomEven,
          oddPercentage: 100 - randomEven,
          score: Math.floor(randomScore),
          status
        };
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const signal = useMemo<Signal>(() => {
    const { autoPrediction } = stats;
    let confName: 'baixa' | 'media' | 'alta' = 'baixa';
    if (autoPrediction.confidence > 80) confName = 'alta';
    else if (autoPrediction.confidence > 60) confName = 'media';

    return {
      type: autoPrediction.type,
      confidence: confName,
      reason: autoPrediction.reason
    };
  }, [stats]);

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
            {/* Session Stats */}
            <div className="hidden lg:flex items-center gap-4 bg-zinc-900/80 border border-zinc-800 px-4 py-1.5 rounded-full shadow-lg">
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Acertos</span>
                <span className="text-sm font-black text-green-500">{performance.wins}</span>
              </div>
              <Separator orientation="vertical" className="h-4 bg-zinc-800" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Erros</span>
                <span className="text-sm font-black text-red-500">{performance.losses}</span>
              </div>
              <Separator orientation="vertical" className="h-4 bg-zinc-800" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Win Rate</span>
                <span className="text-sm font-black text-blue-500">{performance.winRate.toFixed(0)}%</span>
              </div>
            </div>

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
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-auto grid grid-cols-2 md:grid-cols-4 gap-1">
              <TabsTrigger value="flow" className="text-zinc-100 data-[state=active]:bg-zinc-800 py-2 opacity-100">
                <Activity className="w-4 h-4 mr-2" />
                Fluxo
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="text-zinc-100 data-[state=active]:bg-zinc-800 py-2 opacity-100">
                <Cpu className="w-4 h-4 mr-2" />
                Inteligência
              </TabsTrigger>
              <TabsTrigger value="monitor" className="text-zinc-100 data-[state=active]:bg-zinc-800 py-2 opacity-100">
                <Layers className="w-4 h-4 mr-2" />
                Monitor
              </TabsTrigger>
              <TabsTrigger value="performance" className="text-zinc-100 data-[state=active]:bg-zinc-800 py-2 opacity-100">
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
                    
                    <div className="pt-2 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">Próximos Prováveis</p>
                        <div className="flex gap-2">
                          {stats.expectedNext.map(num => (
                            <div key={num} className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm font-bold text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">Quebra de Padrão</p>
                        <div className="text-xl font-black text-zinc-200">
                          {stats.breakProbability.toFixed(1)}%
                        </div>
                      </div>
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

            {/* TELA 2 — INTELIGÊNCIA OPERACIONAL */}
            <TabsContent value="intelligence" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score de Entrada */}
                <Card className="hardware-panel border-zinc-800 bg-zinc-950/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      Score de Entrada
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">
                    <div className="relative">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-zinc-900" />
                        <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={364.4}
                          strokeDashoffset={364.4 - (364.4 * (stats.intelligence?.score.value || 0)) / 100}
                          className={cn("transition-all duration-1000",
                            stats.intelligence?.score.color === 'green' ? "text-green-500" : 
                            stats.intelligence?.score.color === 'red' ? "text-red-500" : "text-yellow-500"
                          )}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {stats.intelligence?.score.level === 'favoravel' && stats.autoPrediction.type !== 'aguardar' ? (
                          <>
                            <span className={cn(
                              "text-2xl font-black uppercase tracking-tighter leading-none mb-1",
                              stats.autoPrediction.type === 'par' ? "text-blue-500" : "text-red-500"
                            )}>
                              {stats.autoPrediction.type}
                            </span>
                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{stats.intelligence?.score.value} Pts</span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-black font-mono">{stats.intelligence?.score.value}</span>
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Pontos</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className={cn("px-4 py-1 text-xs uppercase font-black",
                      stats.intelligence?.score.color === 'green' ? "bg-green-500 text-black" : 
                      stats.intelligence?.score.color === 'red' ? "bg-red-500 text-white" : "bg-yellow-500 text-black"
                    )}>
                      {stats.intelligence?.score.level === 'favoravel' ? '🟢 Favorável' : 
                       stats.intelligence?.score.level === 'evitar' ? '🔴 Evitar' : '🟡 Neutro'}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Camada de Interpretação */}
                <Card className="md:col-span-2 hardware-panel border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-500" />
                      Interpretação Automática
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stats.intelligence?.interpretation.map((phrase, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{phrase}</span>
                        </div>
                      ))}
                    </div>
                    {stats.intelligence?.riskAlerts && stats.intelligence.riskAlerts.length > 0 && (
                      <div className="pt-2">
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-3 items-center">
                          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                          <div className="space-y-1">
                            {stats.intelligence.riskAlerts.map((risk, i) => (
                              <p key={i} className="text-xs text-red-400 font-medium">{risk}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sinal de Apoio */}
                <Card className="md:col-span-2 hardware-panel border-zinc-800 overflow-hidden">
                  <div className={cn("h-1 w-full",
                    stats.autoPrediction.type === 'par' ? "bg-blue-600" : stats.autoPrediction.type === 'impar' ? "bg-red-600" : "bg-zinc-700"
                  )} />
                  <CardContent className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                       <div className="flex-1 space-y-3">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sinal de Apoio Estatístico</p>
                          <div className="flex items-center gap-4">
                            <span className={cn("text-5xl font-black uppercase",
                               stats.autoPrediction.type === 'par' ? "text-blue-500" : stats.autoPrediction.type === 'impar' ? "text-red-500" : "text-zinc-700"
                            )}>
                              {stats.autoPrediction.type}
                            </span>
                            <Badge variant="outline" className="border-zinc-800 text-zinc-500 font-mono">
                               {stats.autoPrediction.confidence.toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed italic">"{stats.autoPrediction.reason}"</p>
                       </div>
                       <div className="w-full md:w-48 space-y-3">
                          <Button 
                            onClick={() => handleSimulateTrade('win')}
                            className="w-full bg-green-600 hover:bg-green-700 font-bold"
                          >
                            WIN
                          </Button>
                          <Button 
                            onClick={() => handleSimulateTrade('loss')}
                            variant="outline" 
                            className="w-full border-red-600/50 text-red-500 hover:bg-red-600/10 font-bold"
                          >
                            LOSS
                          </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Personalização */}
                <Card className="hardware-panel border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-zinc-300" />
                      Análise Personalizada
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-2">
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Foco do Algoritmo</Label>
                      <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        {(['sequencia', 'percentual', 'rompimento'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setUserSettings(prev => ({ ...prev, strategyFocus: s }))}
                            className={cn(
                              "flex-1 py-1 px-1 text-[9px] font-bold uppercase rounded transition-all",
                              userSettings.strategyFocus === s ? "bg-zinc-800 text-blue-400 shadow-md" : "text-zinc-600 hover:text-zinc-400"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">Janela Amostral</Label>
                        <span className="text-xs font-mono font-black text-blue-500">{userSettings.analysisWindow} Tks</span>
                      </div>
                      <Slider 
                        defaultValue={[userSettings.analysisWindow]} 
                        max={100} min={10} step={10} 
                        onValueChange={(vals) => setUserSettings(s => ({ ...s, analysisWindow: vals[0] as any }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TELA 3 — MONITOR MULTIMERCADO */}
            <TabsContent value="monitor" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketMonitor.map((market) => (
                  <Card 
                    key={market.symbol}
                    className={cn(
                      "hardware-panel border-zinc-800 cursor-pointer transition-all hover:border-blue-500/50",
                      market.symbol === symbol && "border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    )}
                    onClick={() => setSymbol(market.symbol)}
                  >
                    <CardHeader className="p-4 pb-2">
                       <div className="flex justify-between items-start">
                          <div className="space-y-1">
                             <h4 className="text-sm font-bold text-zinc-100">{market.name}</h4>
                             <p className="text-[10px] text-zinc-500 font-mono">{market.symbol}</p>
                          </div>
                          <Badge className={cn("text-[8px] uppercase",
                            market.status === 'favoravel' ? "bg-green-600" :
                            market.status === 'evitar' ? "bg-red-600" : "bg-zinc-800"
                          )}>
                            {market.status}
                          </Badge>
                       </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase text-zinc-600">Oportunidade</span>
                          <span className="text-lg font-black font-mono">{market.score}%</span>
                       </div>
                       <Progress value={market.score} className="h-1 bg-zinc-900" 
                          style={{ 
                            // @ts-ignore
                            "--progress-bg": market.status === 'favoravel' ? "var(--green-500)" : "var(--zinc-500)"
                          }} 
                        />
                       <div className="flex justify-between text-[9px] font-mono font-bold">
                          <span className="text-blue-400">PAR {market.evenPercentage.toFixed(0)}%</span>
                          <span className="text-red-400">IMP {market.oddPercentage.toFixed(0)}%</span>
                       </div>
                    </CardContent>
                  </Card>
                ))}
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
