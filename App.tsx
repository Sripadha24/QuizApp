
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData } from './types';

const App: React.FC = () => {
  // Form State
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [count, setCount] = useState(5);

  // App State
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'form' | 'quiz' | 'result'>('form');
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Quiz Interaction State
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsReviewMode(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a multiple choice quiz about "${topic}". Difficulty level: ${difficulty}. Number of questions: ${count}.`,
        config: {
          systemInstruction: "You are a professional quiz creator. Generate a high-quality, accurate multiple-choice quiz in JSON format. Each question must have exactly 4 options and one 'correctAnswer' index ranging from 0 to 3. Provide educational and engaging questions.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      minItems: 4,
                      maxItems: 4
                    },
                    correctAnswer: { 
                      type: Type.INTEGER,
                      description: "The zero-based index of the correct option (0-3)"
                    }
                  },
                  required: ["question", "options", "correctAnswer"]
                }
              }
            },
            required: ["questions"]
          }
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('AI failed to produce content. Please try a different topic.');
      }

      const data: QuizData = JSON.parse(text);
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions generated. Try being more specific with your topic.');
      }

      setQuiz(data);
      setUserAnswers(new Array(data.questions.length).fill(-1));
      setCurrentStep('quiz');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err.message || 'An error occurred while generating your quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (isReviewMode) return;
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };

  const handleSubmitQuiz = () => {
    if (!quiz) return;
    
    let currentScore = 0;
    quiz.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        currentScore++;
      }
    });

    setScore(currentScore);
    setCurrentStep('result');
    setIsReviewMode(false);
  };

  const resetApp = () => {
    setCurrentStep('form');
    setQuiz(null);
    setUserAnswers([]);
    setScore(0);
    setError(null);
    setTopic('');
    setIsReviewMode(false);
  };

  const enterReviewMode = () => {
    setIsReviewMode(true);
    setCurrentStep('quiz');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-block mb-4 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer" onClick={resetApp}>
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-3">
            AI Quiz <span className="text-indigo-600">Pro</span>
          </h1>
          <p className="text-lg text-gray-500 font-medium">Turn any topic into an instant challenge.</p>
        </header>

        {currentStep === 'form' && (
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-gray-100 animate-in zoom-in-95 duration-500">
            <form onSubmit={handleGenerate} className="space-y-10">
              <div className="space-y-3">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Quiz Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. World War II History, JavaScript Basics..."
                  className="w-full px-6 py-5 rounded-3xl border-2 border-gray-50 focus:border-indigo-600 focus:bg-white bg-gray-50/50 outline-none transition-all text-xl font-semibold placeholder:text-gray-300"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Difficulty</label>
                  <div className="flex p-1.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                    {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                          difficulty === d 
                          ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                          : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Questions: {count}</label>
                  <div className="px-1 pt-4">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-5 bg-red-50 border border-red-100 rounded-3xl text-red-600 text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2">
                  <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-red-100 rounded-full">!</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`group w-full py-6 rounded-[2rem] font-black text-white text-xl transition-all ${
                  loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] hover:shadow-2xl hover:shadow-indigo-200'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-4">
                    <svg className="animate-spin h-7 w-7 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Masterpiece...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    Start Learning
                    <svg className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        )}

        {currentStep === 'quiz' && quiz && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
            <div className="flex justify-between items-center bg-white/80 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-gray-200/50 sticky top-6 z-30">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isReviewMode ? 'Reviewing' : 'Topic'}</span>
                <span className="text-lg font-black text-gray-900 truncate max-w-[180px] md:max-w-xs">{topic}</span>
              </div>
              <div className="h-10 w-[2px] bg-gray-100 hidden md:block"></div>
              <div className="flex items-center gap-4">
                 <span className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border ${isReviewMode ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                   {isReviewMode ? 'Review Mode' : difficulty}
                 </span>
                 <div className="text-right hidden sm:block">
                   <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isReviewMode ? 'Final Score' : 'Progress'}</div>
                   <div className="text-sm font-black text-indigo-600">
                    {isReviewMode ? `${score} / ${quiz.questions.length}` : `${userAnswers.filter(a => a !== -1).length} / ${quiz.questions.length}`}
                   </div>
                 </div>
              </div>
            </div>

            <div className="space-y-8">
              {quiz.questions.map((q, qIdx) => (
                <div key={qIdx} className={`bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border transition-all hover:shadow-md ${isReviewMode && userAnswers[qIdx] !== q.correctAnswer ? 'border-red-100' : 'border-gray-100'}`}>
                  <div className="flex gap-5 mb-8">
                    <span className={`flex items-center justify-center w-12 h-12 shrink-0 text-white rounded-2xl font-black italic shadow-lg ${isReviewMode ? (userAnswers[qIdx] === q.correctAnswer ? 'bg-emerald-500 shadow-emerald-100' : 'bg-red-500 shadow-red-100') : 'bg-indigo-600 shadow-indigo-100'}`}>
                      {qIdx + 1}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight pt-1">
                      {q.question}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctAnswer;
                      const isUserChoice = userAnswers[qIdx] === oIdx;
                      
                      let optionStyles = 'border-gray-50 hover:border-indigo-100 bg-gray-50/30 hover:bg-white text-gray-700';
                      let labelStyles = 'bg-white text-gray-400 border border-gray-200 group-hover:border-indigo-200';

                      if (isReviewMode) {
                        if (isCorrect) {
                          optionStyles = 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm';
                          labelStyles = 'bg-emerald-500 text-white';
                        } else if (isUserChoice) {
                          optionStyles = 'border-red-500 bg-red-50 text-red-800 shadow-sm';
                          labelStyles = 'bg-red-500 text-white';
                        } else {
                          optionStyles = 'border-gray-50 bg-gray-50/10 text-gray-400 opacity-60';
                          labelStyles = 'bg-gray-100 text-gray-300 border-gray-100';
                        }
                      } else if (isUserChoice) {
                        optionStyles = 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm';
                        labelStyles = 'bg-indigo-600 text-white';
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={isReviewMode}
                          onClick={() => handleAnswerSelect(qIdx, oIdx)}
                          className={`group w-full text-left px-7 py-6 rounded-3xl border-2 transition-all duration-300 flex items-center gap-5 ${optionStyles}`}
                        >
                          <span className={`flex items-center justify-center w-10 h-10 rounded-xl text-sm font-black transition-all ${labelStyles}`}>
                            {isReviewMode && isCorrect ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            ) : isReviewMode && isUserChoice && !isCorrect ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="font-bold text-lg md:text-xl leading-snug">{opt}</span>
                          {isReviewMode && isCorrect && (
                            <span className="ml-auto text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">Correct</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-5">
              <button
                onClick={resetApp}
                className="order-2 md:order-1 flex-1 py-6 px-8 bg-white border-2 border-gray-100 text-gray-500 font-black rounded-3xl hover:bg-gray-50 transition-all uppercase tracking-widest text-sm"
              >
                {isReviewMode ? 'Main Menu' : 'Quit'}
              </button>
              <button
                onClick={isReviewMode ? () => setCurrentStep('result') : handleSubmitQuiz}
                disabled={!isReviewMode && userAnswers.includes(-1)}
                className={`order-1 md:order-2 flex-[2] py-6 px-8 rounded-3xl font-black text-xl text-white transition-all shadow-xl ${
                  !isReviewMode && userAnswers.includes(-1) 
                  ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-200'
                }`}
              >
                {isReviewMode ? 'Back to Results' : 'Complete Quiz'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'result' && quiz && (
          <div className="bg-white p-10 md:p-20 rounded-[3.5rem] shadow-2xl border border-gray-50 text-center animate-in zoom-in duration-500 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            
            <div className="mb-12 relative">
               <div className="relative inline-flex mb-10">
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl scale-150"></div>
                  <div className="relative inline-flex items-center justify-center w-48 h-48 bg-white rounded-full border-[12px] border-indigo-50 shadow-inner">
                    <div className="flex flex-col items-center">
                      <span className="text-6xl font-black text-indigo-600 tracking-tighter leading-none">
                        {Math.round((score / quiz.questions.length) * 100)}%
                      </span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Score</span>
                    </div>
                  </div>
               </div>
               <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Challenge Finished!</h2>
               <p className="text-xl text-gray-500 font-medium max-w-sm mx-auto">
                 You answered <span className="text-indigo-600 font-black">{score}</span> questions correctly out of <span className="text-gray-900 font-black">{quiz.questions.length}</span>.
               </p>
            </div>

            <div className="flex flex-col gap-4 max-w-sm mx-auto">
              <button
                onClick={resetApp}
                className="w-full py-6 px-10 bg-indigo-600 text-white font-black text-xl rounded-3xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-2xl shadow-indigo-100"
              >
                New Challenge
              </button>
              <button
                 onClick={enterReviewMode}
                 className="w-full py-5 px-10 text-indigo-600 font-black rounded-3xl hover:bg-indigo-50 transition-all uppercase tracking-widest text-xs"
              >
                Review My Answers
              </button>
            </div>
          </div>
        )}

        
      </div>
    </div>
  );
};

export default App;
