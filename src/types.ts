export type QuizDifficulty = 'grade1' | 'grade2' | 'grade3' | 'grade4' | 'grade5' | 'grade6' | 'other' | 'easy' | 'medium' | 'hard';

export interface KanjiQuiz {
  id: string;
  kanji: string;
  parts: string[];
  reading: string; // legacy combined reading format
  onyomi?: string; // 音読み (Katakana)
  kunyomi?: string; // 訓読み (Hiragana)
  exampleWords?: { word: string; reading: string; meaning?: string }[]; // Words restricted to current grade level or lower
  meaning: string;
  hint: string;
  difficulty: QuizDifficulty;
  creator: 'default' | 'user';
  createdAt: number;
}

export interface DecomposeResponse {
  kanji: string;
  parts: string[];
  reading: string;
  onyomi?: string;
  kunyomi?: string;
  exampleWords?: { word: string; reading: string; meaning?: string }[];
  meaning: string;
  hint: string;
  difficulty: QuizDifficulty;
  success: boolean;
  error?: string;
}
