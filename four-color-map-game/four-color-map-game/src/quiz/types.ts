export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

export interface NumericQuestion {
  id: string;
  difficulty: QuizDifficulty;
  prompt: string;
  answer: number;
  explanation: string;
}

export interface QuizResult {
  answered: number;
  correct: number;
  wrong: number;
  longestCorrectStreak: number;
  failed: boolean;
}
