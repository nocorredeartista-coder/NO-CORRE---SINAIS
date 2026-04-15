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
