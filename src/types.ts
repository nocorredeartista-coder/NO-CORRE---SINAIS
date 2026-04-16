export type Digit = {
  value: number;
  timestamp: number;
  type: 'par' | 'impar';
};

export type Signal = {
  type: 'par' | 'impar' | 'aguardar';
  confidence: 'baixa' | 'media' | 'alta';
  reason: string;
};

export type Intelligence = {
  interpretation: string[];
  score: {
    value: number; // 0-100
    level: 'favoravel' | 'neutro' | 'evitar';
    color: 'green' | 'yellow' | 'red';
  };
  insights: string[];
  riskAlerts: string[];
  bestMarketHint?: string;
};

export type UserSettings = {
  strategyFocus: 'sequencia' | 'percentual' | 'rompimento';
  analysisWindow: 10 | 20 | 50;
  voiceEnbaled: boolean;
};

export type MarketStatus = {
  symbol: string;
  name: string;
  evenPercentage: number;
  oddPercentage: number;
  score: number;
  status: 'favoravel' | 'neutro' | 'evitar';
};

export type Stats = {
  evenCount: number;
  oddCount: number;
  evenPercentage: number;
  oddPercentage: number;
  currentStreak: {
    type: 'par' | 'impar' | null;
    count: number;
  };
  breakProbability: number;
  digitFrequency: Record<number, number>;
  digitGaps: Record<number, number>;
  expectedNext: number[];
  patternAnalysis: {
    alternationRate: number;
    repetitionRate: number;
    commonPatterns: { pattern: string; count: number }[];
  };
  autoPrediction: {
    type: 'par' | 'impar' | 'aguardar';
    confidence: number;
    reason: string;
  };
  intelligence?: Intelligence;
};

export type Management = {
  stake: number;
  stopLoss: number;
  stopWin: number;
  galeLevel: number;
};

export type Performance = {
  wins: number;
  losses: number;
  winRate: number;
  history: {
    result: 'win' | 'loss';
    profit: number;
    timestamp: number;
  }[];
};
