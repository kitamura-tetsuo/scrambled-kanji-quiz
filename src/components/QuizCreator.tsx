import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KanjiQuiz } from '../types';
import { fallbackDecomposer } from '../data/gradeKanji';

interface QuizCreatorProps {
  onSave: (quiz: KanjiQuiz) => void;
  onCancel: () => void;
}

export default function QuizCreator({ onSave, onCancel }: QuizCreatorProps) {
  const [inputKanji, setInputKanji] = useState('');
  const [preferredPartsCount, setPreferredPartsCount] = useState<number>(0); // 0 means auto/any
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const KANJI_AUTO_CANDIDATES = [
    '驚', '機', '話', '願', '鏡', '競', '議', '薬', '駅', '億', '憲', '関', '極', '養', '録', 
    '豊', '愛', '農', '路', '歌', '算', '語', '聞', '静', '操', '績', '繁', '曜', '簡',
    '講', '謝', '職', '難', '題', '館', '顔', '頭', '願', '類', '競', '驚', '機', '街', '激',
    '震', '箱', '筆', '談', '練', '熱', '標', '諸', '衛', '歓', '積', '誰', '歴', '興', '融'
  ];

  const handleRandomSelect = () => {
    const target = KANJI_AUTO_CANDIDATES[Math.floor(Math.random() * KANJI_AUTO_CANDIDATES.length)];
    setInputKanji(target);
  };

  const handleRandomInstantCreate = async () => {
    const targetKanji = KANJI_AUTO_CANDIDATES[Math.floor(Math.random() * KANJI_AUTO_CANDIDATES.length)];
    setInputKanji(targetKanji);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanji: targetKanji, preferredPartsCount }),
      });

      const data = await response.json();

      const verifiedParts = (response.ok && data.success && data.parts && data.parts.length > 0)
        ? data.parts
        : fallbackDecomposer(targetKanji, preferredPartsCount);

      const newQuiz: KanjiQuiz = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kanji: targetKanji,
        parts: verifiedParts,
        reading: data.reading || '音・訓読み各種',
        meaning: data.meaning || `${targetKanji}の漢字`,
        hint: data.hint || `この漢字は「${verifiedParts.join('」と「')}」に分かれています。`,
        difficulty: data.difficulty || 'medium',
        creator: 'user',
        createdAt: Date.now(),
      };

      onSave(newQuiz);
    } catch (err: any) {
      console.warn('AI decomposition failed, using client-side fallback:', err);
      const parts = fallbackDecomposer(targetKanji, preferredPartsCount);
      const newQuiz: KanjiQuiz = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kanji: targetKanji,
        parts: parts,
        reading: '音・訓読み各種',
        meaning: `${targetKanji}の漢字`,
        hint: `「${parts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
        difficulty: 'medium',
        creator: 'user',
        createdAt: Date.now(),
      };
      onSave(newQuiz);
    } finally {
      setIsLoading(false);
    }
  };

  // Japanese traditional loading phrases
  const loadingPhrases = [
    '漢字を細かに紐解いています...',
    '部首を一片ずつに仕分けています...',
    'パズルのピースに切り分けています...',
    '読み仮名とヒントを考案中...',
    '美しいクイズをお届けする準備をしています...'
  ];
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleDecompose = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKanji = inputKanji.trim();
    if (!targetKanji) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanji: targetKanji, preferredPartsCount }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '分解に失敗しました。');
      }

      const verifiedParts = data.parts && data.parts.length > 0
        ? data.parts
        : fallbackDecomposer(targetKanji, preferredPartsCount);

      const newQuiz: KanjiQuiz = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kanji: data.kanji || targetKanji,
        parts: verifiedParts,
        reading: data.reading || '音・訓読み各種',
        meaning: data.meaning || `${targetKanji}の漢字`,
        hint: data.hint || `この漢字は「${verifiedParts.join('」と「')}」に分かれています。`,
        difficulty: data.difficulty || 'medium',
        creator: 'user',
        createdAt: Date.now(),
      };

      onSave(newQuiz);
    } catch (err: any) {
      console.warn('AI decomposition failed, using client-side fallback:', err);
      const parts = fallbackDecomposer(targetKanji, preferredPartsCount);
      const newQuiz: KanjiQuiz = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kanji: targetKanji,
        parts: parts,
        reading: '音・訓読み各種',
        meaning: `${targetKanji}の漢字`,
        hint: `「${parts.join('」と「')}」を組み合わせると何の漢字になるかな？`,
        difficulty: 'medium',
        creator: 'user',
        createdAt: Date.now(),
      };
      onSave(newQuiz);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4" id="quiz-creator-container">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
          id="btn-creator-back"
        >
          <ArrowLeft size={16} />
          <span>戻る</span>
        </button>
        <h2 className="font-serif text-lg font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-indigo-600 fill-indigo-100" size={18} />
          <span>新しい漢字クイズを自動作成</span>
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center min-h-[300px]">
            <Loader2 className="animate-spin text-indigo-600 mb-6" size={44} />
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingPhraseIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="text-base font-bold text-gray-900 tracking-wider text-center"
              >
                {loadingPhrases[loadingPhraseIndex]}
              </motion.p>
            </AnimatePresence>
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mt-3 font-mono">PLEASE STAND BY... DECOMPOSING ON CLOUD CONTAINER</p>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-600 text-xs md:text-sm mb-6 leading-relaxed max-w-lg mx-auto">
              作成したい漢字（「驚」、「話」、「機」など、お好きな難しい漢字1文字）を入力してください。<br />
              AIまたはシステムがバラバラの部品に自動で分解し、即座に漢字クイズとして保存され、プレイを開始します！
            </p>

            <form onSubmit={handleDecompose} className="space-y-4 max-w-md mx-auto">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-400 text-left uppercase tracking-wider font-mono">答えとなる漢字</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleRandomSelect}
                      className="text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors px-2.5 py-1 font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <span>🎲 おまかせ漢字を決める</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomInstantCreate}
                      className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Sparkles size={11} />
                      <span>完全おまかせ即作成 🚀</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={1}
                    value={inputKanji}
                    onChange={(e) => setInputKanji(e.target.value)}
                    placeholder="例: 機"
                    required
                    className="flex-1 bg-gray-50 border border-gray-200 focus:border-indigo-600 focus:outline-none rounded-xl px-4 py-3 text-center text-xl font-bold text-gray-900 font-serif"
                    id="input-kanji-target"
                  />
                  <button
                    type="submit"
                    disabled={!inputKanji.trim()}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors px-6 font-semibold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer text-xs"
                    id="btn-decompose-fetch"
                  >
                    <Sparkles size={14} className="animate-pulse" />
                    <span>手動漢字を分解してプレイ</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 text-left border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider font-mono mb-2">希望のパーツ分割数</label>
                <div className="grid grid-cols-5 gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-150 max-w-sm">
                  {[
                    { value: 0, label: '自動' },
                    { value: 2, label: '2分割' },
                    { value: 3, label: '3分割' },
                    { value: 4, label: '4分割' },
                    { value: 5, label: '5分割' }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPreferredPartsCount(item.value)}
                      className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        preferredPartsCount === item.value 
                          ? 'bg-indigo-600 text-white shadow-2xs' 
                          : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-150/40'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                  {preferredPartsCount === 0 
                    ? 'AIまたはシステム推奨設定で、最適な部品数に自動分解します。' 
                    : `パーツ数を【約${preferredPartsCount}個】にグループ化・細分化を自動調節して分解します。`}
                </p>
              </div>

              {error && (
                <p className="text-red-650 text-xs mt-2 text-left bg-red-50 p-3 rounded-lg border border-red-100 font-medium">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
