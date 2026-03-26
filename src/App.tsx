/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Brain, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Languages,
  GraduationCap,
  ArrowRightLeft,
  ArrowLeft,
  Home
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { HIRAGANA, KATAKANA } from './constants';
import kanjiData from './data/kanji.json';
import { getKanjiExplanation } from './services/geminiService';

type Mode = 'KANA' | 'KANJI';
type KanaSubMode = 'INPUT' | 'CHOICE_KANA_TO_ROMAJI' | 'CHOICE_ROMAJI_TO_KANA';
type KanaType = 'HIRAGANA' | 'KATAKANA' | 'BOTH';

export default function App() {
  const [activeMode, setActiveMode] = useState<Mode>('KANA');
  const [isKanaPlaying, setIsKanaPlaying] = useState(false);
  const [selectedKanji, setSelectedKanji] = useState<any>(null);

  const handleBack = () => {
    if (activeMode === 'KANA' && isKanaPlaying) {
      setIsKanaPlaying(false);
    } else if (activeMode === 'KANJI' && selectedKanji) {
      setSelectedKanji(null);
    }
  };

  const isSubView = (activeMode === 'KANA' && isKanaPlaying) || (activeMode === 'KANJI' && selectedKanji);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Navigation */}
      <nav className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => {
              setActiveMode('KANA');
              setIsKanaPlaying(false);
              setSelectedKanji(null);
            }}
            className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
          >
            <AnimatePresence mode="wait">
              {isSubView ? (
                <motion.button
                  key="back"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBack();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.div
                  key="logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold"
                >
                  京
                </motion.div>
              )}
            </AnimatePresence>
            <span className="font-semibold text-lg tracking-tight hidden sm:inline">Kyo-Japanese</span>
          </button>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveMode('KANA');
                setIsKanaPlaying(false);
                setSelectedKanji(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeMode === 'KANA' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Japanese
            </button>
            <button
              onClick={() => {
                setActiveMode('KANJI');
                setIsKanaPlaying(false);
                setSelectedKanji(null);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeMode === 'KANJI' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kanji
            </button>
          </div>

          <div className="flex-1 flex justify-end">
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeMode === 'KANA' ? (
            <KanaSection 
              key="kana" 
              isPlaying={isKanaPlaying} 
              setIsPlaying={setIsKanaPlaying} 
            />
          ) : (
            <KanjiSection 
              key="kanji" 
              selectedKanji={selectedKanji} 
              setSelectedKanji={setSelectedKanji} 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function KanaSection({ isPlaying, setIsPlaying }: { isPlaying: boolean; setIsPlaying: (v: boolean) => void; key?: string }) {
  const [kanaType, setKanaType] = useState<KanaType>('HIRAGANA');
  const [subMode, setSubMode] = useState<KanaSubMode>('INPUT');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [quizHistory, setQuizHistory] = useState<{ question: any; answer: string; isCorrect: boolean; type: string }[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryPage, setSummaryPage] = useState(0);
  const [lastRomaji, setLastRomaji] = useState<string | null>(null);

  const data = useMemo(() => {
    if (kanaType === 'BOTH') return [...HIRAGANA, ...KATAKANA];
    return kanaType === 'HIRAGANA' ? HIRAGANA : KATAKANA;
  }, [kanaType]);

  const generateQuestion = () => {
    const activeData = data;
    let correct;
    
    // Prevent consecutive questions with the same romaji
    do {
      correct = activeData[Math.floor(Math.random() * activeData.length)];
    } while (activeData.length > 1 && correct.romaji === lastRomaji);

    setCurrentQuestion(correct);
    setLastRomaji(correct.romaji);
    setFeedback(null);
    setUserInput('');

    if (subMode !== 'INPUT') {
      const wrongOptions = activeData
        .filter(item => item.romaji !== correct.romaji)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(item => subMode === 'CHOICE_KANA_TO_ROMAJI' ? item.romaji : item.kana);
      
      const allOptions = [...wrongOptions, subMode === 'CHOICE_KANA_TO_ROMAJI' ? correct.romaji : correct.kana]
        .sort(() => 0.5 - Math.random());
      setOptions(allOptions);
    }
  };

  const startQuiz = () => {
    setIsPlaying(true);
    setShowSummary(false);
    setQuizHistory([]);
    setScore({ correct: 0, total: 0 });
    generateQuestion();
  };

  const checkAnswer = (answer: string) => {
    if (feedback) return;

    const isCorrect = subMode === 'CHOICE_ROMAJI_TO_KANA' 
      ? answer === currentQuestion.kana 
      : answer.toLowerCase().trim() === currentQuestion.romaji;

    setQuizHistory(prev => [...prev, { 
      question: currentQuestion, 
      answer, 
      isCorrect,
      type: kanaType === 'BOTH' ? (HIRAGANA.some(h => h.kana === currentQuestion.kana) ? 'Hiragana' : 'Katakana') : kanaType.charAt(0) + kanaType.slice(1).toLowerCase()
    }]);

    if (isCorrect) {
      setFeedback('CORRECT');
      setScore(s => ({ ...s, correct: s.correct + 1, total: s.total + 1 }));
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399']
      });
      setTimeout(generateQuestion, 400);
    } else {
      setFeedback('WRONG');
      setScore(s => ({ ...s, total: s.total + 1 }));
    }
  };

  if (!isPlaying) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Japanese Master</h1>
          <p className="text-gray-500">Master the foundation of Japanese writing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                Writing Systems
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hiragana</div>
                  <div className="grid grid-cols-5 gap-1">
                    {HIRAGANA.slice(0, 10).map((k, i) => (
                      <div key={i} className="aspect-square flex items-center justify-center bg-gray-50 rounded text-sm font-medium text-gray-600">
                        {k.kana}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Katakana</div>
                  <div className="grid grid-cols-5 gap-1">
                    {KATAKANA.slice(0, 10).map((k, i) => (
                      <div key={i} className="aspect-square flex items-center justify-center bg-gray-50 rounded text-sm font-medium text-gray-600">
                        {k.kana}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {(['HIRAGANA', 'KATAKANA', 'BOTH'] as KanaType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setKanaType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      kanaType === t ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'BOTH' ? 'Both' : `Quiz ${t.charAt(0) + t.slice(1).toLowerCase()}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-600" />
                Quiz Mode
              </h3>
              <div className="space-y-2">
                {[
                  { id: 'INPUT', label: 'Type Romaji' },
                  { id: 'CHOICE_KANA_TO_ROMAJI', label: 'Kana → Romaji (Choice)' },
                  { id: 'CHOICE_ROMAJI_TO_KANA', label: 'Romaji → Kana (Choice)' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSubMode(m.id as KanaSubMode)}
                    className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      subMode === m.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-6">
            <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm text-emerald-600">
                <Languages className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-emerald-900">Ready to start?</h2>
                <p className="text-emerald-700/70 text-sm">Practice your writing systems through interactive quizzes.</p>
              </div>
              <button
                onClick={startQuiz}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                Start Learning <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (showSummary) {
    const pageSize = 25;
    const totalPages = Math.ceil(quizHistory.length / pageSize);
    const paginatedHistory = quizHistory.slice(summaryPage * pageSize, (summaryPage + 1) * pageSize);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl space-y-8">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">Quiz Summary</h2>
              <p className="text-gray-500 text-sm">You got {score.correct} out of {score.total} correct!</p>
            </div>
            <button 
              onClick={() => {
                setShowSummary(false);
                setIsPlaying(false);
              }}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Back to Menu
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Question</th>
                  <th className="px-6 py-4">Your Answer</th>
                  <th className="px-6 py-4">Correct Answer</th>
                  <th className="px-6 py-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedHistory.map((item, i) => (
                  <tr key={i} className="text-sm hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-500">{item.type}</td>
                    <td className="px-6 py-4 text-xl font-bold text-gray-900">{item.question.kana}</td>
                    <td className="px-6 py-4 font-mono">{item.answer}</td>
                    <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{item.question.romaji}</td>
                    <td className="px-6 py-4">
                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                          <XCircle className="w-4 h-4" /> Wrong
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button 
                disabled={summaryPage === 0}
                onClick={() => setSummaryPage(p => p - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm font-bold text-gray-500">
                Page {summaryPage + 1} of {totalPages}
              </span>
              <button 
                disabled={summaryPage === totalPages - 1}
                onClick={() => setSummaryPage(p => p + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto space-y-8"
    >
      <div className="flex justify-between items-center">
        <div className="bg-emerald-600 px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-lg shadow-emerald-200">
          {score.correct} / {score.total}
        </div>
        <button 
          onClick={() => {
            if (score.total > 0) {
              setShowSummary(true);
              setSummaryPage(0);
            } else {
              setIsPlaying(false);
            }
          }}
          className="px-4 py-1.5 bg-white rounded-full border border-black/5 text-rose-500 hover:bg-rose-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
        >
          <XCircle className="w-4 h-4" /> Stop Quiz
        </button>
      </div>

      <div className="bg-white p-12 rounded-3xl border border-black/5 shadow-xl text-center space-y-8 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion?.kana}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="text-8xl font-bold text-emerald-950">
              {subMode === 'CHOICE_ROMAJI_TO_KANA' ? currentQuestion?.romaji : currentQuestion?.kana}
            </div>
            <div className="text-sm text-gray-400 uppercase tracking-widest font-semibold">
              {subMode === 'CHOICE_ROMAJI_TO_KANA' ? 'Select the correct Kana' : 'What is the pronunciation?'}
            </div>
          </motion.div>
        </AnimatePresence>

        {subMode === 'INPUT' ? (
          <div className="max-w-xs mx-auto">
            <input
              autoFocus
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (feedback === 'WRONG') {
                    generateQuestion();
                  } else {
                    checkAnswer(userInput);
                  }
                }
              }}
              placeholder="Type romaji..."
              className="w-full text-center text-2xl py-3 border-b-2 border-gray-200 focus:border-emerald-500 outline-none transition-all font-mono"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => checkAnswer(opt)}
                className={`py-4 rounded-2xl text-xl font-bold border transition-all ${
                  feedback === 'CORRECT' && (subMode === 'CHOICE_ROMAJI_TO_KANA' ? opt === currentQuestion.kana : opt === currentQuestion.romaji)
                    ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
                    : feedback === 'WRONG' && (subMode === 'CHOICE_ROMAJI_TO_KANA' ? opt === currentQuestion.kana : opt === currentQuestion.romaji)
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-700 border-gray-100 hover:border-emerald-300 hover:bg-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-x-0 bottom-0 py-3 px-6 flex items-center justify-between font-bold ${
                feedback === 'CORRECT' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback === 'CORRECT' ? (
                  <><CheckCircle2 className="w-5 h-5" /> Correct!</>
                ) : (
                  <><XCircle className="w-5 h-5" /> Incorrect! It was {currentQuestion.romaji}</>
                )}
              </div>
              
              {feedback === 'WRONG' && (
                <button 
                  onClick={generateQuestion}
                  className="bg-white text-rose-600 px-4 py-1 rounded-lg text-sm flex items-center gap-1 hover:bg-rose-50 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function KanjiSection({ selectedKanji, setSelectedKanji }: { selectedKanji: any; setSelectedKanji: (v: any) => void; key?: string }) {
  const [level, setLevel] = useState<string>('N5');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKanjiClick = async (item: any) => {
    setSelectedKanji(item);
    setLoading(true);
    setExplanation('');
    const exp = await getKanjiExplanation(item.kanji, item.mandarin);
    setExplanation(exp);
    setLoading(false);
  };

  const levels = Object.keys(kanjiData);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Kanji Bridge</h1>
        <p className="text-gray-500">Leverage your Mandarin knowledge to master Kanji.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {levels.map(l => {
          const isComingSoon = ['N4', 'N3', 'N2', 'N1'].includes(l);
          return (
            <button
              key={l}
              disabled={isComingSoon}
              onClick={() => {
                setLevel(l);
                setSelectedKanji(null);
              }}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all relative group ${
                level === l 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : isComingSoon
                    ? 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-500 border border-black/5 hover:bg-gray-50'
              }`}
            >
              {l}
              {isComingSoon && (
                <span className="absolute -top-2 -right-2 bg-gray-400 text-[10px] text-white px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto p-2">
          {(kanjiData as any)[level].map((item: any, i: number) => (
            <button
              key={i}
              onClick={() => handleKanjiClick(item)}
              className={`p-6 rounded-2xl border transition-all text-center space-y-2 group ${
                selectedKanji?.kanji === item.kanji 
                ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20' 
                : 'bg-white border-black/5 hover:border-emerald-200 hover:shadow-md'
              }`}
            >
              <div className="text-4xl font-bold text-gray-900 group-hover:scale-110 transition-transform">
                {item.kanji}
              </div>
              <div className="text-sm font-bold text-emerald-700">
                {item.reading}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedKanji ? (
              <motion.div
                key={selectedKanji.kanji}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl sticky top-24 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                  <div className="text-center flex-1">
                    <div className="text-sm font-bold text-gray-400 mb-1">Japanese</div>
                    <div className="text-6xl font-bold text-emerald-950">{selectedKanji.kanji}</div>
                    <div className="text-xl font-medium text-emerald-600 mt-2">{selectedKanji.reading}</div>
                  </div>
                  <div className="px-4">
                    <ArrowRightLeft className="w-6 h-6 text-gray-300" />
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-sm font-bold text-gray-400 mb-1">Mandarin</div>
                    <div className="text-6xl font-bold text-emerald-600">{selectedKanji.mandarin}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <Languages className="w-4 h-4 text-emerald-600" />
                    AI Insights
                  </div>
                  {loading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-4 bg-gray-100 rounded w-full"></div>
                      <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-100 rounded w-4/6"></div>
                    </div>
                  ) : (
                    <p className={`leading-relaxed text-sm ${
                      explanation.includes("Rate limit") || 
                      explanation.includes("API Key") || 
                      explanation.includes("Failed to load")
                        ? "text-rose-600 font-medium not-italic bg-rose-50 p-3 rounded-xl border border-rose-100" 
                        : "text-gray-600 italic"
                    }`}>
                      {explanation}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                    <GraduationCap className="w-3 h-3" />
                    Level {level} Vocabulary
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-100/50 border-2 border-dashed border-gray-200 p-12 rounded-3xl text-center space-y-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <ChevronRight className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">Select a Kanji to explore its Mandarin connection</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
