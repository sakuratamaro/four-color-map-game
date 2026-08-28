import { QUIZ_CONFIG } from '@/config/quizConfig';
import type { QuizResult } from '../types';

export function calculateQuizDrawCount(result: QuizResult): number {
  if (result.failed || result.wrong >= QUIZ_CONFIG.failureWrongAnswerCount) return 0;
  if (result.answered === QUIZ_CONFIG.questionCount && result.correct === QUIZ_CONFIG.questionCount) {
    return QUIZ_CONFIG.perfectDrawCount;
  }
  if (result.longestCorrectStreak >= QUIZ_CONFIG.streakRewardThreshold) {
    return QUIZ_CONFIG.streakDrawCount;
  }
  if (result.answered === QUIZ_CONFIG.questionCount) return QUIZ_CONFIG.normalDrawCount;
  return 0;
}
