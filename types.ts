
export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface QuizData {
  questions: QuizQuestion[];
}

export interface QuizRequest {
  topic: string;
  difficulty: Difficulty;
  count: number;
}
