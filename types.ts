export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export type QuestionType = 'mcq' | 'short' | 'blank';

export type QuizMode = 'mcq' | 'short' | 'blank' | 'mixed';

export interface QuizQuestion {
  type: QuestionType;
  question: string;
  options?: string[]; // Only used for mcq
  correctAnswer: string; // For mcq this is the index (0-3), for others it is the word/phrase
  explanation?: string;
}

export interface QuizData {
  questions: QuizQuestion[];
}

export interface QuizRequest {
  topic: string;
  difficulty: Difficulty;
  count: number;
  mode: QuizMode;
}
