import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, BookOpen, Star, Filter, Search, RotateCcw, Trophy, CheckCircle, LayoutGrid, Award, Info, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KanjiQuiz, QuizDifficulty } from './types';
import { defaultQuizzes } from './data/defaultQuizzes';
import { GRADE_KANJI_RAW, getGradeKanjiList, fallbackDecomposer } from './data/gradeKanji';
import gradeKanjiDict from './data/gradeKanjiDict.json';
import QuizCreator from './components/QuizCreator';
import PlayTable from './components/PlayTable';

const getSolvedKey = (kanji: string, parts: string[]) => {
  const sortedParts = [...parts].sort().join(',');
  return `${kanji}::${sortedParts}`;
};

export default function App() {
  const [quizzes, setQuizzes] = useState<KanjiQuiz[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'create' | 'play'>('list');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuizDifficulty | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'default' | 'user'>('all');
  const [preferredPartsCount, setPreferredPartsCount] = useState<number>(0); // 0 means auto/any

  // Stats / Solved
  const [solvedQuizIds, setSolvedQuizIds] = useState<string[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // On-demand Elementary school decomp states
  const [isGeneratingOnDemand, setIsGeneratingOnDemand] = useState(false);
  const [decomposingKanji, setDecomposingKanji] = useState('');

  // Shuffled grade kanjis state & utility
  const [shuffledGradeKanjis, setShuffledGradeKanjis] = useState<string[]>([]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  useEffect(() => {
    const isGrade = selectedDifficulty !== 'all' && selectedDifficulty !== 'other' && selectedDifficulty.startsWith('grade');
    if (isGrade) {
      const rawList = getGradeKanjiList(selectedDifficulty);
      setShuffledGradeKanjis(shuffleArray(rawList));

      // Automatically pre-create custom quiz templates for all grade kanjis in the state
      // so they display immediately with part counts (🧩) and start instantly when clicked
      setQuizzes((prev) => {
        const updated = [...prev];
        let hasNew = false;
        rawList.forEach((char) => {
          const match = updated.find((q) => q.kanji === char);
          if (!match) {
            const parts = fallbackDecomposer(char, preferredPartsCount);
            const entry = (gradeKanjiDict as Record<string, any>)[char];
            updated.push({
              id: `grade-prepopulated-${char}`,
              kanji: char,
              parts: parts,
              reading: entry?.reading || '音・訓読み各種',
              onyomi: entry?.onyomi || '',
              kunyomi: entry?.kunyomi || '',
              meaning: entry?.meaning || `${char}の漢字`,
              hint: entry?.hint || `「${parts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
              exampleWords: entry?.exampleWords || [],
              difficulty: selectedDifficulty as QuizDifficulty,
              creator: 'default',
              createdAt: Date.now(),
            });
            hasNew = true;
          }
        });
        return hasNew ? updated : prev;
      });
    } else {
      setShuffledGradeKanjis([]);
    }
  }, [selectedDifficulty, preferredPartsCount]);

  const handleReshuffleGradeKanjis = () => {
    const isGrade = selectedDifficulty !== 'all' && selectedDifficulty !== 'other' && selectedDifficulty.startsWith('grade');
    if (isGrade) {
      const rawList = getGradeKanjiList(selectedDifficulty);
      setShuffledGradeKanjis(shuffleArray(rawList));
    }
  };

  const handleSelectKanjiFromExplorer = async (kanjiChar: string, gradeKey: QuizDifficulty) => {
    // Find if quiz already exists in memory
    const existingQuiz = quizzes.find((q) => q.kanji === kanjiChar);
    if (existingQuiz) {
      setActiveQuizId(existingQuiz.id);
      setActiveView('play');
      return;
    }

    // Force instant client-side generation for elementary school kanjis (bypasses slow on-demand API)
    const isElementary = gradeKey && gradeKey.startsWith('grade');
    if (isElementary) {
      const parts = fallbackDecomposer(kanjiChar, preferredPartsCount);
      const entry = (gradeKanjiDict as Record<string, any>)[kanjiChar];
      const newQuiz: KanjiQuiz = {
        id: `grade-prepopulated-${kanjiChar}`,
        kanji: kanjiChar,
        parts: parts,
        reading: entry?.reading || '音・訓読み各種（パズル解答時に確認できます）',
        onyomi: entry?.onyomi || '',
        kunyomi: entry?.kunyomi || '',
        meaning: entry?.meaning || `${kanjiChar}の漢字`,
        hint: entry?.hint || `「${parts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
        exampleWords: entry?.exampleWords || [],
        difficulty: gradeKey,
        creator: 'default',
        createdAt: Date.now(),
      };
      setQuizzes((prev) => [newQuiz, ...prev]);
      setActiveQuizId(newQuiz.id);
      setActiveView('play');
      return;
    }

    // Standard AI on-demand generator for other queries or custom elements
    setIsGeneratingOnDemand(true);
    setDecomposingKanji(kanjiChar);

    // Let kids see a beautiful little loading sequence to build excitement
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const response = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanji: kanjiChar, preferredPartsCount }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.success) {
          const generatedParts = result.parts && result.parts.length > 0 ? result.parts : fallbackDecomposer(kanjiChar, preferredPartsCount);
          const newQuiz: KanjiQuiz = {
            id: `on-demand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            kanji: result.kanji || kanjiChar,
            parts: generatedParts,
            reading: result.reading || '音・訓読み各種',
            meaning: result.meaning || `${kanjiChar}の漢字`,
            hint: result.hint || '部品を組み立てて漢字を解読してください。',
            difficulty: gradeKey,
            creator: 'user',
            createdAt: Date.now(),
          };

          // Persist custom list
          const storedQuizzes = localStorage.getItem('kanji-barabara-custom');
          let customList: KanjiQuiz[] = [];
          if (storedQuizzes) {
            try { customList = JSON.parse(storedQuizzes); } catch (e) { console.error(e); }
          }
          const updatedCustom = [newQuiz, ...customList];
          localStorage.setItem('kanji-barabara-custom', JSON.stringify(updatedCustom));

          setQuizzes((prev) => [newQuiz, ...prev]);
          setActiveQuizId(newQuiz.id);
          setActiveView('play');
          setIsGeneratingOnDemand(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI decomposition failed, using client-side fallback:', err);
    }

    // Instant local fallback
    const fallbackParts = fallbackDecomposer(kanjiChar, preferredPartsCount);
    const newFallbackQuiz: KanjiQuiz = {
      id: `on-demand-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      kanji: kanjiChar,
      parts: fallbackParts,
      reading: '音・訓読み',
      meaning: `${kanjiChar}の漢字`,
      hint: `この漢字「${kanjiChar}」は、部首パーツに分かれています。構成された${fallbackParts.length}つの部品をつなぎ合わせましょう。`,
      difficulty: gradeKey,
      creator: 'user',
      createdAt: Date.now(),
    };

    const storedQuizzes = localStorage.getItem('kanji-barabara-custom');
    let customList: KanjiQuiz[] = [];
    if (storedQuizzes) {
      try { customList = JSON.parse(storedQuizzes); } catch (e) { console.error(e); }
    }
    const updatedCustom = [newFallbackQuiz, ...customList];
    localStorage.setItem('kanji-barabara-custom', JSON.stringify(updatedCustom));

    setQuizzes((prev) => [newFallbackQuiz, ...prev]);
    setActiveQuizId(newFallbackQuiz.id);
    setActiveView('play');
    setIsGeneratingOnDemand(false);
  };

  // Initialize tests
  useEffect(() => {
    // Load custom quizzes from localStorage
    const storedQuizzes = localStorage.getItem('kanji-barabara-custom');
    let parsedCustom: KanjiQuiz[] = [];
    if (storedQuizzes) {
      try {
        parsedCustom = JSON.parse(storedQuizzes);
      } catch (err) {
        console.error('Failed to parse custom quizzes:', err);
      }
    }

    // Sanitize and auto-recreate any custom or default quizzes that are damaged
    const sanitizedCustom = parsedCustom.map((q) => {
      const hasDamaged = q.parts.some((p) => !p || p.trim() === '');
      if (hasDamaged) {
        const correctParts = fallbackDecomposer(q.kanji);
        return {
          ...q,
          parts: correctParts,
          hint: q.hint.includes('」と「')
            ? `「${correctParts.join('」と「')}」を組み合わせると何の漢字になるかな？`
            : q.hint,
        };
      }
      return q;
    });

    const sanitizedDefault = defaultQuizzes.map((q) => {
      const hasDamaged = q.parts.some((p) => !p || p.trim() === '');
      if (hasDamaged) {
        const correctParts = fallbackDecomposer(q.kanji);
        return {
          ...q,
          parts: correctParts,
        };
      }
      return q;
    });

    const dictQuizzes: KanjiQuiz[] = Object.keys(gradeKanjiDict).map((char) => {
      const entry = (gradeKanjiDict as any)[char];
      const parts = fallbackDecomposer(char);
      
      // Find grade difficulty
      let diff: QuizDifficulty = 'other';
      for (const grade in GRADE_KANJI_RAW) {
        if (GRADE_KANJI_RAW[grade].includes(char)) {
          diff = grade as QuizDifficulty;
          break;
        }
      }

      return {
        id: `grade-dict-${char}`,
        kanji: char,
        parts: parts,
        reading: entry.reading || '音・訓読み各種',
        onyomi: entry.onyomi || '',
        kunyomi: entry.kunyomi || '',
        meaning: entry.meaning || `${char}の漢字`,
        hint: entry.hint || `「${parts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
        exampleWords: entry.exampleWords || [],
        difficulty: diff,
        creator: 'default',
        createdAt: Date.now(),
      };
    });

    // Merge sanitizedDefault and dictQuizzes, where defaultQuizzes override dict entries
    const mergedDefaultAndDict = [...sanitizedDefault];
    dictQuizzes.forEach((dq) => {
      const exists = mergedDefaultAndDict.some((q) => q.kanji === dq.kanji);
      if (!exists) {
        mergedDefaultAndDict.push(dq);
      }
    });

    setQuizzes([...mergedDefaultAndDict, ...sanitizedCustom]);

    // Load solved tracking
    const storedSolved = localStorage.getItem('kanji-barabara-solved');
    if (storedSolved) {
      try {
        setSolvedQuizIds(JSON.parse(storedSolved));
      } catch (e) {
        console.error(e);
      }
    }

    const storedStreak = localStorage.getItem('kanji-barabara-streak');
    if (storedStreak) {
      setCurrentStreak(parseInt(storedStreak, 10) || 0);
    }
  }, []);

  const handleSaveQuiz = (newQuiz: KanjiQuiz) => {
    // Save to local storage & memory
    const storedQuizzes = localStorage.getItem('kanji-barabara-custom');
    let customList: KanjiQuiz[] = [];
    if (storedQuizzes) {
      try {
        customList = JSON.parse(storedQuizzes);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedCustom = [newQuiz, ...customList];
    localStorage.setItem('kanji-barabara-custom', JSON.stringify(updatedCustom));
    setQuizzes([...defaultQuizzes, ...updatedCustom]);

    // Switch view back to list and auto-select the new quiz
    setActiveView('list');
    setActiveQuizId(newQuiz.id);
    setActiveView('play');
  };

  const handleQuizSuccess = (timeSpent: number) => {
    if (!activeQuizForPlay) return;
    
    const solvedKey = getSolvedKey(activeQuizForPlay.kanji, activeQuizForPlay.parts);
    let updatedSolved = [...solvedQuizIds];
    if (!solvedQuizIds.includes(solvedKey)) {
      updatedSolved.push(solvedKey);
      setSolvedQuizIds(updatedSolved);
      localStorage.setItem('kanji-barabara-solved', JSON.stringify(updatedSolved));

      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      localStorage.setItem('kanji-barabara-streak', newStreak.toString());
    }
  };

  const handleResetProgress = () => {
    if (confirm('クイズの解読進捗（クリア履歴とストリーク）をリセットしますか？')) {
      setSolvedQuizIds([]);
      setCurrentStreak(0);
      localStorage.removeItem('kanji-barabara-solved');
      localStorage.removeItem('kanji-barabara-streak');
    }
  };

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId);

  // Adapt activeQuiz to respect preferredPartsCount when loading the PlayTable
  const activeQuizForPlay = React.useMemo(() => {
    if (!activeQuiz) return null;
    if (preferredPartsCount > 0 && activeQuiz.parts.length !== preferredPartsCount) {
      const adaptedParts = fallbackDecomposer(activeQuiz.kanji, preferredPartsCount);
      return {
        ...activeQuiz,
        parts: adaptedParts,
        hint: `「${adaptedParts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
      };
    }
    return activeQuiz;
  }, [activeQuiz, preferredPartsCount]);

  // Filter quizzes based on user selections
  const filteredQuizzes = quizzes.filter((q) => {
    // If it's a giant preloaded dictionary quiz, only show it in the primary list if:
    // a) we are searching specifically
    // b) or we are filtering specifically for this grade
    // c) or the user has already solved it (they want to see their achievements)
    const isPrepopulatedDictQuiz = q.id.startsWith('grade-dict-');
    if (isPrepopulatedDictQuiz) {
      const isGradeFiltered = selectedDifficulty === q.difficulty;
      const isSearched = searchQuery.length > 0;
      let parts = q.parts;
      if (preferredPartsCount > 0 && q.parts.length !== preferredPartsCount) {
        parts = fallbackDecomposer(q.kanji, preferredPartsCount);
      }
      const solvedKey = getSolvedKey(q.kanji, parts);
      const isSolved = solvedQuizIds.includes(solvedKey) || solvedQuizIds.includes(q.id);
      if (!isGradeFiltered && !isSearched && !isSolved) {
        return false;
      }
    }

    const matchesSearch =
      q.kanji.includes(searchQuery) ||
      q.reading.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.parts.some((p) => p.includes(searchQuery));

    let matchesDifficulty = false;
    if (selectedDifficulty === 'all') {
      matchesDifficulty = true;
    } else if (q.difficulty === selectedDifficulty) {
      matchesDifficulty = true;
    } else {
      // 既存の easy/medium/hard との互換マッピング
      if (q.difficulty === 'easy' && (selectedDifficulty === 'grade1' || selectedDifficulty === 'grade2')) {
        matchesDifficulty = true;
      } else if (q.difficulty === 'medium' && (selectedDifficulty === 'grade3' || selectedDifficulty === 'grade4')) {
        matchesDifficulty = true;
      } else if (q.difficulty === 'hard' && (selectedDifficulty === 'grade5' || selectedDifficulty === 'grade6' || selectedDifficulty === 'other')) {
        matchesDifficulty = true;
      }
    }
    const matchesSource =
      selectedSource === 'all' ||
      (selectedSource === 'default' && q.creator === 'default') ||
      (selectedSource === 'user' && q.creator === 'user');

    return matchesSearch && matchesDifficulty && matchesSource;
  });

  // Hot components library from Geometric Balance
  const recentPartsList = ['言', '五', '口', '木', '心', '氵', '人', '重', '雨', '牛', '里', '門', '立', '鳥'];

  const isGradeSelected = selectedDifficulty !== 'all' && selectedDifficulty !== 'other' && selectedDifficulty.startsWith('grade');
  const allGradeKanjis = isGradeSelected ? getGradeKanjiList(selectedDifficulty) : [];
  const filteredExplorerKanjis = (shuffledGradeKanjis.length > 0 ? shuffledGradeKanjis : allGradeKanjis).filter(char => {
    if (!searchQuery) return true;
    return char.includes(searchQuery);
  });

  const selectNextQuiz = () => {
    if (!activeQuizId) return;

    // Helper to check if a specific kanji character is unsolved
    const isUnsolvedGradeKanji = (char: string) => {
      const matchingQuiz = quizzes.find((q) => q.kanji === char);
      let parts = matchingQuiz ? matchingQuiz.parts : fallbackDecomposer(char, preferredPartsCount);
      if (preferredPartsCount > 0 && matchingQuiz && matchingQuiz.parts.length !== preferredPartsCount) {
        parts = fallbackDecomposer(char, preferredPartsCount);
      }
      const solvedKey = getSolvedKey(char, parts);
      return !solvedQuizIds.includes(solvedKey) && (!matchingQuiz || !solvedQuizIds.includes(matchingQuiz.id));
    };

    // If grade is active, advance to the next unsolved grade kanji if available
    if (isGradeSelected && shuffledGradeKanjis.length > 0) {
      const currentQuiz = quizzes.find((q) => q.id === activeQuizId);
      if (currentQuiz) {
        const charIndex = shuffledGradeKanjis.indexOf(currentQuiz.kanji);
        if (charIndex !== -1) {
          const len = shuffledGradeKanjis.length;
          let foundKanji: string | null = null;

          // Search forward sequentially for an unsolved kanji
          for (let i = 1; i <= len; i++) {
            const checkIndex = (charIndex + i) % len;
            const checkKanji = shuffledGradeKanjis[checkIndex];
            if (isUnsolvedGradeKanji(checkKanji)) {
              foundKanji = checkKanji;
              break;
            }
          }

          // If found, select it; otherwise, default to the next physical one in sequence
          const targetKanji = foundKanji !== null ? foundKanji : shuffledGradeKanjis[(charIndex + 1) % len];
          handleSelectKanjiFromExplorer(targetKanji, selectedDifficulty as QuizDifficulty);
          return;
        }
      }
    }

    const currentIndex = quizzes.findIndex((q) => q.id === activeQuizId);
    if (currentIndex !== -1) {
      // Helper to check if a full quiz object is unsolved
      const isUnsolvedQuiz = (q: typeof quizzes[0]) => {
        let parts = q.parts;
        if (preferredPartsCount > 0 && q.parts.length !== preferredPartsCount) {
          parts = fallbackDecomposer(q.kanji, preferredPartsCount);
        }
        const solvedKey = getSolvedKey(q.kanji, parts);
        return !solvedQuizIds.includes(solvedKey) && !solvedQuizIds.includes(q.id);
      };

      const len = quizzes.length;
      let foundQuizId: string | null = null;

      // Search forward sequentially starting from the next item
      for (let i = 1; i <= len; i++) {
        const checkIndex = (currentIndex + i) % len;
        const checkQuiz = quizzes[checkIndex];
        if (isUnsolvedQuiz(checkQuiz)) {
          foundQuizId = checkQuiz.id;
          break;
        }
      }

      // If found, set it; otherwise, just move to the physical next quiz in sequence
      const targetQuizId = foundQuizId !== null ? foundQuizId : quizzes[(currentIndex + 1) % len].id;
      setActiveQuizId(targetQuizId);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans select-none" id="app-root-container">
      {/* Top Header Navigation - Geometric Balance Style */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:px-8 shrink-0 z-10 sticky top-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl font-serif shadow-sm">
            漢
          </div>
          <div>
            <h1 className="text-base md:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span>漢字バラバラ・メーカー</span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono border border-indigo-100 uppercase tracking-widest hidden sm:inline-block">V1.0.4</span>
            </h1>
            <p className="text-[9px] md:text-xs text-gray-500 uppercase tracking-widest font-mono">Geometric Balance System</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <nav className="flex gap-4 md:gap-6 text-xs md:text-sm font-semibold text-gray-600">
            <button
              onClick={() => { setActiveView('list'); setActiveQuizId(null); }}
              className={`pb-1 transition-all cursor-pointer ${
                activeView === 'list' || activeView === 'play'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                  : 'hover:text-indigo-600'
              }`}
            >
              クイズを解く
            </button>
            <button
              onClick={() => setActiveView('create')}
              className={`pb-1 transition-all cursor-pointer ${
                activeView === 'create'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                  : 'hover:text-indigo-600'
              }`}
            >
              作製・AI自動分解
            </button>
          </nav>
          
          <button
            onClick={() => setActiveView('create')}
            className="px-3.5 py-1.5 md:px-5 md:py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs md:text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">新しいクイズ</span>
          </button>
        </div>
      </header>

      {/* Main Body Layout Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* VIEW 1: CREATOR OR PLAYER */}
        {activeView === 'create' ? (
          <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
            <QuizCreator
              onSave={handleSaveQuiz}
              onCancel={() => setActiveView('list')}
            />
          </div>
        ) : activeView === 'play' && activeQuizForPlay ? (
          <div className="flex-1 overflow-y-auto bg-slate-50">
            <PlayTable
              key={activeQuizForPlay.id}
              quiz={activeQuizForPlay}
              onCorrect={handleQuizSuccess}
              onNext={selectNextQuiz}
              onBack={() => { setActiveView('list'); setActiveQuizId(null); }}
            />
          </div>
        ) : (
          /* VIEW 2: QUIZ LIST & FILTER DASHBOARD (List View) */
          <>
            {/* Left Sidebar: Filters & Stats Profile */}
            <aside className="w-full md:w-72 bg-white md:border-r border-b md:border-b-0 border-gray-200 flex flex-col shrink-0">
              {/* Score / Streak Progress Card */}
              <div className="p-5 border-b border-gray-100 bg-[#FAFBFD]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">進捗パズルステータス</h3>
                  <button
                    onClick={handleResetProgress}
                    title="進捗クリア"
                    className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-100 p-3 rounded-lg text-center shadow-2xs">
                    <div className="text-indigo-600 font-mono font-black text-xl flex items-center justify-center gap-1">
                      <Trophy size={16} className="text-amber-500 fill-amber-100" />
                      <span>{solvedQuizIds.length}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">解いた数</span>
                  </div>

                  <div className="bg-white border border-gray-100 p-3 rounded-lg text-center shadow-2xs">
                    <div className="text-emerald-600 font-mono font-black text-xl flex items-center justify-center gap-1">
                      <Star size={16} className="text-emerald-500 fill-emerald-100" />
                      <span>{currentStreak}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">ストリーク</span>
                  </div>
                </div>

                {quizzes.length > 0 && (() => {
                  const solvedCountInCurrentQuizzes = quizzes.filter((q) => {
                    let parts = q.parts;
                    if (preferredPartsCount > 0 && q.parts.length !== preferredPartsCount) {
                      parts = fallbackDecomposer(q.kanji, preferredPartsCount);
                    }
                    const solvedKey = getSolvedKey(q.kanji, parts);
                    return solvedQuizIds.includes(solvedKey) || solvedQuizIds.includes(q.id);
                  }).length;
                  return (
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-medium">
                        <span>解読達成率</span>
                        <span>{Math.round((solvedCountInCurrentQuizzes / quizzes.length) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${(solvedCountInCurrentQuizzes / quizzes.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Advanced Search & Filtering Controls */}
              <div className="p-5 border-b border-gray-100 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-2 tracking-wider font-mono">漢字・キーワードを検索</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="漢字、パーツ、意味..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 font-serif"
                    />
                    <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#4f46e5] uppercase mb-1.5 tracking-wider font-mono flex items-center gap-1">
                    <Sparkles size={11} className="fill-indigo-100 text-indigo-600 animate-pulse" />
                    <span>希望の分割パーツ 数を指定</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-md text-[10px] font-bold">
                    {[
                      { value: 0, label: '自動' },
                      { value: 2, label: '2個' },
                      { value: 3, label: '3個' },
                      { value: 4, label: '4個' },
                      { value: 5, label: '5個' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setPreferredPartsCount(item.value)}
                        className={`py-1 rounded-sm transition-all cursor-pointer text-center ${
                          preferredPartsCount === item.value 
                            ? 'bg-indigo-600 text-white shadow-2xs font-extrabold' 
                            : 'text-gray-500 hover:text-indigo-600 hover:bg-white/40'
                        }`}
                        title={item.value === 0 ? '推奨数で自動分割します' : `${item.value}個の構成パーツに調整します`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                    {preferredPartsCount === 0 
                      ? '※漢字にあわせた最適なパーツ数で自動仕分けします。' 
                      : `※選択した漢字を【${preferredPartsCount}個】の部品に細かく仕分けてパズルを開始します。`}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-2 tracking-wider font-mono">小学生の学年で仕分ける</label>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-md">
                    {[
                      { key: 'all', label: 'すべて' },
                      { key: 'grade1', label: '小学1年' },
                      { key: 'grade2', label: '小学2年' },
                      { key: 'grade3', label: '小学3年' },
                      { key: 'grade4', label: '小学4年' },
                      { key: 'grade5', label: '小学5年' },
                      { key: 'grade6', label: '小学6年' },
                      { key: 'other', label: '一般・その他' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setSelectedDifficulty(item.key as any)}
                        className={`py-1 text-[11px] font-bold rounded-sm transition-all cursor-pointer ${
                          selectedDifficulty === item.key ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-indigo-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-2 tracking-wider font-mono">作成ソース</label>
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-md text-[10px] font-bold">
                    <button
                      onClick={() => setSelectedSource('all')}
                      className={`py-1 rounded-sm transition-all cursor-pointer ${
                        selectedSource === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      すべて
                    </button>
                    <button
                      onClick={() => setSelectedSource('default')}
                      className={`py-1 rounded-sm transition-all cursor-pointer ${
                        selectedSource === 'default' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      既定
                    </button>
                    <button
                      onClick={() => setSelectedSource('user')}
                      className={`py-1 rounded-sm transition-all cursor-pointer ${
                        selectedSource === 'user' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500'
                      }`}
                    >
                      自作
                    </button>
                  </div>
                </div>
              </div>

              {/* Geometric Balance static sidebar list of common radicals & parts library */}
              <div className="flex-1 p-5 overflow-y-auto hidden md:block">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest font-mono">部品ショートカット</h3>
                <p className="text-[10px] text-gray-400 mb-3">パーツを選択すると、該当パーツで分解された漢字を絞り込み検索します。</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {recentPartsList.map((partChar) => (
                    <button
                      key={partChar}
                      onClick={() => {
                        setSearchQuery(partChar === searchQuery ? '' : partChar);
                      }}
                      className={`aspect-square border rounded-md flex items-center justify-center text-lg font-serif transition-all duration-200 cursor-pointer ${
                        searchQuery === partChar
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105 font-bold'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-white hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {partChar}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Right Side: Bento Grid composition space */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
              <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Hero / Information panel in pure Geometric style */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-5 pointer-events-none select-none font-serif text-9xl font-black mr-[-20px] mt-[-30px]">
                    漢
                  </div>
                  <div className="space-y-2 max-w-xl z-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest font-mono">Geometric Balance Mode</span>
                    <h2 className="text-2xl font-serif text-gray-900 font-bold leading-tight">漢文パズルの「箱庭」へようこそ。</h2>
                    <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                      このアプリは、漢字をいくつもの「部品」に細かく分解し、散らばったピースから元の漢字を推理するクイズプラットフォームです。AIを駆使してお好きな漢字からあなた独自の「漢字バラバラクイズ」を自動製造することも可能です。
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveView('create')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={14} className="fill-indigo-100" />
                      <span>AIで漢字を分解する</span>
                    </button>
                  </div>
                </div>

                {/* ELEMENTARY SCHOOL KANJI ROADMAP EXPLORER */}
                {isGradeSelected && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="font-serif text-lg font-extrabold text-indigo-900 flex items-center gap-2">
                          <Award className="text-indigo-600 w-5 h-5" />
                          <span>
                            {selectedDifficulty === 'grade1' && '小学1年生の漢字'}
                            {selectedDifficulty === 'grade2' && '小学2年生の漢字'}
                            {selectedDifficulty === 'grade3' && '小学3年生の漢字'}
                            {selectedDifficulty === 'grade4' && '小学4年生の漢字'}
                            {selectedDifficulty === 'grade5' && '小学5年生の漢字'}
                            {selectedDifficulty === 'grade6' && '小学6年生の漢字'}
                            一覧（全 {allGradeKanjis.length} 字・1画除く）
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          任意の漢字パネルを押すと、パーツに自動分解して直ちにパズルゲームを生成・開始します！
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleReshuffleGradeKanjis}
                          className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-150 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-3xs cursor-pointer transition-colors"
                          id="btn-reshuffle-explorer"
                        >
                          <RotateCcw size={12} className="text-indigo-600 animate-pulse-once" />
                          <span>一覧シャッフル</span>
                        </button>

                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3.5 py-1.5 flex items-center gap-4 text-xs font-bold text-indigo-800">
                          <div className="text-center sm:text-right">
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">クリア状況</span>
                            <span className="font-mono text-sm leading-none">
                              {allGradeKanjis.filter(char => {
                                const matchingQuiz = quizzes.find(q => q.kanji === char);
                                if (!matchingQuiz) return false;
                                
                                let parts = matchingQuiz.parts;
                                if (preferredPartsCount > 0 && matchingQuiz.parts.length !== preferredPartsCount) {
                                  parts = fallbackDecomposer(char, preferredPartsCount);
                                }
                                const solvedKey = getSolvedKey(char, parts);
                                return solvedQuizIds.includes(solvedKey) || solvedQuizIds.includes(matchingQuiz.id);
                              }).length} / {allGradeKanjis.length} 問
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {filteredExplorerKanjis.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        「{searchQuery}」に一致する小学生習得漢字はありません。
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-2.5">
                        {filteredExplorerKanjis.map((char) => {
                          const matchingQuiz = quizzes.find(q => q.kanji === char);
                          let isSolved = false;
                          if (matchingQuiz) {
                            let parts = matchingQuiz.parts;
                            if (preferredPartsCount > 0 && matchingQuiz.parts.length !== preferredPartsCount) {
                              parts = fallbackDecomposer(char, preferredPartsCount);
                            }
                            const solvedKey = getSolvedKey(char, parts);
                            isSolved = solvedQuizIds.includes(solvedKey) || solvedQuizIds.includes(matchingQuiz.id);
                          }
                          
                          return (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileActive={{ scale: 0.95 }}
                              key={char}
                              onClick={() => {
                                const matchedDiff = selectedDifficulty === 'all' || selectedDifficulty === 'other' ? 'grade1' : selectedDifficulty;
                                handleSelectKanjiFromExplorer(char, matchedDiff);
                              }}
                              className={`aspect-square p-2 rounded-xl border flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer shadow-3xs group ${
                                isSolved
                                  ? 'bg-emerald-50/30 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/10 shadow-inner'
                                  : matchingQuiz
                                  ? 'bg-indigo-50/20 border-indigo-300 text-indigo-900'
                                  : 'bg-gray-50 border-gray-150 text-gray-800 hover:bg-white hover:border-indigo-400 hover:shadow-2xs'
                              }`}
                            >
                              <span className="font-serif text-xl sm:text-2xl font-black tracking-normal leading-none group-hover:text-indigo-600 transition-colors">
                                {char}
                              </span>

                              <div className="absolute top-1 right-1">
                                {isSolved ? (
                                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold shadow-3xs">✓</span>
                                ) : matchingQuiz ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="クイズ作成済み"></span>
                                ) : (
                                  <Sparkles size={8} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                )}
                              </div>
                              
                              <span className="text-[8px] text-indigo-500 font-mono font-bold mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                {preferredPartsCount > 0 
                                  ? `🧩 ${preferredPartsCount}個` 
                                  : matchingQuiz 
                                  ? `🧩 ${matchingQuiz.parts.length}個` 
                                  : 'AI未分解'}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Grid header states */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span>{isGradeSelected ? '分解済みの登録カード (即解読可能)' : '問題目録'}</span>
                      <span className="text-xs font-mono font-bold bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                        {filteredQuizzes.length} 問
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400">
                      {isGradeSelected 
                        ? 'すでにAIで切り分けられた登録済みの問題詳細カード一欄です。' 
                        : '解答したいカードを選んでゲームを開始します。'}
                    </p>
                  </div>

                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setSelectedDifficulty('all'); setSelectedSource('all'); }}
                      className="text-xs font-semibold text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-center"
                    >
                      フィルターを解除
                    </button>
                  )}
                </div>

                {/* Cards Container Grid */}
                {filteredQuizzes.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 py-12 px-4 text-center">
                    <Info className="mx-auto text-gray-300 mb-3" size={32} />
                    <h4 className="font-medium text-gray-800 text-sm">該当する詳細カードがありません。</h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      上記の「漢字一覧エクスプローラー」から漢字を選択、または「AIで漢字を分解する」機能を使って新しいクイズをつくりましょう。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredQuizzes.map((quiz) => {
                      const displayedParts = preferredPartsCount > 0 
                        ? fallbackDecomposer(quiz.kanji, preferredPartsCount)
                        : quiz.parts;
                      const solvedKey = getSolvedKey(quiz.kanji, displayedParts);
                      const isCleared = solvedQuizIds.includes(solvedKey) || solvedQuizIds.includes(quiz.id);
                      
                      return (
                        <motion.div
                          key={quiz.id}
                          layoutId={`quiz-card-${quiz.id}`}
                          whileHover={{ y: -4, shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}
                          onClick={() => {
                            setActiveQuizId(quiz.id);
                            setActiveView('play');
                          }}
                          className={`bg-white rounded-xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer group ${
                            isCleared 
                              ? 'border-emerald-200 hover:border-emerald-400 shadow-2xs' 
                              : 'border-gray-200 hover:border-indigo-400 hover:shadow-xs'
                          }`}
                        >
                          <div className="p-5 space-y-4">
                            {/* Card Header stats */}
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                  (quiz.difficulty === 'easy' || quiz.difficulty === 'grade1' || quiz.difficulty === 'grade2')
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : (quiz.difficulty === 'medium' || quiz.difficulty === 'grade3' || quiz.difficulty === 'grade4')
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : 'bg-red-50 text-red-700 border border-red-100'
                                }`}
                              >
                                {quiz.difficulty === 'grade1' && '小学1年'}
                                {quiz.difficulty === 'grade2' && '小学2年'}
                                {quiz.difficulty === 'grade3' && '小学3年'}
                                {quiz.difficulty === 'grade4' && '小学4年'}
                                {quiz.difficulty === 'grade5' && '小学5年'}
                                {quiz.difficulty === 'grade6' && '小学6年'}
                                {quiz.difficulty === 'other' && '一般'}
                                {quiz.difficulty === 'easy' && '初級'}
                                {quiz.difficulty === 'medium' && '中級'}
                                {quiz.difficulty === 'hard' && '上級'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {isCleared ? (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-100">
                                    <CheckCircle size={10} className="fill-emerald-100" />
                                    <span>解読完了</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider font-mono">UNSOLVED</span>
                                )}
                              </div>
                            </div>

                            {/* Center Parts Tray Preview inside Dashboard */}
                            <div className="bg-[#FAFBFD] relative py-5 px-3 rounded-lg border border-dashed border-gray-200 group-hover:border-indigo-200 group-hover:bg-indigo-50-once transition-colors h-24 overflow-hidden flex items-center justify-center gap-2">
                              {/* Grid representation */}
                              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                              
                              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full z-1">
                                {displayedParts.slice(0, 5).map((p, index) => (
                                  <span
                                    key={index}
                                    className="w-8 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center font-serif text-sm font-semibold text-gray-700 shadow-3xs group-hover:border-indigo-300 transition-colors"
                                  >
                                    {p}
                                  </span>
                                ))}
                                {displayedParts.length > 5 && (
                                  <span className="text-gray-400 text-xs font-bold leading-none px-1">+{displayedParts.length - 5}</span>
                                )}
                              </div>
                            </div>

                            {/* Text / Question Metadata */}
                            <div>
                              <div className="flex items-center justify-between">
                                <h4 className="text-gray-800 text-xs font-bold uppercase tracking-wider font-mono">
                                  🧩 部首ピース数: {displayedParts.length}個
                                </h4>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                                意味: {quiz.meaning || 'ヒントを参照できます'}
                              </p>
                            </div>
                          </div>

                          {/* Footer Action Strip */}
                          <div className={`px-5 py-3 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                            isCleared ? 'bg-emerald-50/20 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-600 group-hover:text-indigo-600 group-hover:bg-indigo-50/10'
                          }`}>
                            <span className="font-semibold">{isCleared ? 'もう一度解く' : '解読を開始する'}</span>
                            <ChevronRight size={14} className="transform group-hover:translate-x-1 duration-200" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Dynamic background-decomposition loader overlay */}
      <AnimatePresence>
        {isGeneratingOnDemand && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin absolute" />
                <div className="font-serif font-black text-2xl text-indigo-950">
                  {decomposingKanji}
                </div>
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-gray-900">AI漢字分解中...</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  漢字「<span className="font-serif font-bold text-indigo-600">{decomposingKanji}</span>」を構成パーツに細かく仕分けしています。読み・意味・解読用の知育ヒントをただいま考案中...
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] text-gray-400 font-mono">
                COMPOSITING SYSTEM GEN-3
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Status footer - Geometric Balance Mode specifications */}
      <footer className="h-8 bg-indigo-900 border-t border-indigo-950 text-white flex items-center px-6 justify-between text-[10px] uppercase tracking-[0.2em] font-medium shrink-0 font-mono">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>SYSTEM READY</span>
          </span>
          <span className="hidden sm:inline text-indigo-300">MODE: GEOMETRIC BALANCE</span>
          <span className="hidden md:inline text-indigo-400">TOTAL: {quizzes.length} PUZZLES</span>
        </div>
        <div className="text-indigo-300 select-none">
          © 2026 KANJI BARABARA EDITOR
        </div>
      </footer>
    </div>
  );
}
