import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData, QuizQuestion } from './types';

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

  // Quiz Interaction State: store everything as strings to normalize MCQ indices and text input
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsReviewMode(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a mixed-format quiz about "${topic}". Difficulty: ${difficulty}. Total questions: ${count}. 
        Mix these types: 
        1. 'mcq' (Multiple Choice)
        2. 'short' (Short Answer - descriptive but concise)
        3. 'blank' (Fill in the blanks - use "____" in the question string).`,
        config: {
          systemInstruction: "You are a versatile quiz creator. For each quiz, generate a diverse mix of MCQs, Short Answers, and Fill-in-the-Blanks. Ensure high academic quality. Return JSON only. 'correctAnswer' must be a string. For MCQs, it must be the index (0-3). For others, it must be the exact correct answer.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { 
                      type: Type.STRING, 
                      description: "Question type: 'mcq', 'short', or 'blank'" 
                    },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Required only for type 'mcq'. Must have 4 items."
                    },
                    correctAnswer: { 
                      type: Type.STRING,
                      description: "The correct answer. String representation of index for MCQ (e.g. '0'), or the word for others."
                    },
                    explanation: { type: Type.STRING }
                  },
                  required: ["type", "question", "correctAnswer"]
                }
              }
            },
            required: ["questions"]
          }
        },
      });

      const text = response.text;
      if (!text) throw new Error('AI failed to produce content.');

      const data: QuizData = JSON.parse(text);
      setQuiz(data);
      setUserAnswers(new Array(data.questions.length).fill(''));
      setCurrentStep('quiz');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err.message || 'Error generating quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (index: number, val: string) => {
    if (isReviewMode) return;
    const newAnswers = [...userAnswers];
    newAnswers[index] = val;
    setUserAnswers(newAnswers);
  };

  const isCorrect = (question: QuizQuestion, userAns: string) => {
    const target = question.correctAnswer.toLowerCase().trim();
    const actual = userAns.toLowerCase().trim();
    // For MCQ, we expect exact index string match.
    // For others, we allow simple string equality.
    return target === actual;
  };

  const handleSubmitQuiz = () => {
    if (!quiz) return;
    let currentScore = 0;
    quiz.questions.forEach((q, idx) => {
      if (isCorrect(q, userAnswers[idx])) {
        currentScore++;
      }
    });
    setScore(currentScore);
    setCurrentStep('result');
  };

  const resetApp = () => {
    setCurrentStep('form');
    setQuiz(null);
    setUserAnswers([]);
    setTopic('');
    setError(null);
  };

  const enterReviewMode = () => {
    setIsReviewMode(true);
    setCurrentStep('quiz');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 selection:bg-indigo-100">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-3xl shadow-sm border border-slate-100 mb-6 cursor-pointer hover:scale-110 transition-transform" onClick={resetApp}>
             <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">
            AI Quiz <span className="text-indigo-600">Studio</span>
          </h1>
          <p className="text-slate-500 font-medium">Mixed-mode assessments powered by Gemini</p>
        </header>

        {currentStep === 'form' && (
          <div className="bg-white p-8 md:p-14 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-50 animate-in zoom-in-95 duration-500">
            <form onSubmit={handleGenerate} className="space-y-12">
              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">What do you want to learn?</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Molecular Biology, French Renaissance, Quantum Physics..."
                  className="w-full px-8 py-6 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white bg-slate-50/50 outline-none transition-all text-xl font-bold placeholder:text-slate-300"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Complexity</label>
                  <div className="flex p-2 bg-slate-50 rounded-2xl border border-slate-100">
                    {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-tight transition-all ${
                          difficulty === d 
                            ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Length: {count} questions</label>
                  <div className="pt-2">
                    <input
                      type="range" min="3" max="15" step="1"
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-[10px] font-black text-slate-300 px-1 mt-2">
                      <span>QUICK</span>
                      <span>COMPREHENSIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-100">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white py-7 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 group"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    Curating Content...
                  </div>
                ) : (
                  <>
                    Generate Masterpiece
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {currentStep === 'quiz' && quiz && (
          <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700 pb-24">
            <div className="sticky top-4 z-50 bg-white/80 backdrop-blur-xl border border-slate-100 p-6 rounded-[2rem] shadow-lg flex justify-between items-center">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Topic</span>
                  <span className="font-black text-slate-800 truncate max-w-[200px]">{topic}</span>
               </div>
               <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                    <div className="flex gap-1 mt-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-100"></div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isReviewMode ? 'Score' : 'Progress'}</span>
                    <div className="font-black text-indigo-600">
                      {isReviewMode ? `${score}/${quiz.questions.length}` : `${userAnswers.filter(a => a !== '').length}/${quiz.questions.length}`}
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
              {quiz.questions.map((q, idx) => {
                const userAns = userAnswers[idx];
                const correct = isCorrect(q, userAns);

                return (
                  <div key={idx} className={`bg-white p-8 md:p-10 rounded-[2.5rem] border shadow-sm transition-all ${isReviewMode ? (correct ? 'border-emerald-100 bg-emerald-50/10' : 'border-red-100 bg-red-50/10') : 'border-slate-100'}`}>
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Q{idx + 1} • {q.type === 'mcq' ? 'Choice' : q.type === 'blank' ? 'Fill' : 'Direct'}
                      </span>
                      {isReviewMode && (
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {correct ? 'Correct' : 'Incorrect'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-8 leading-tight">{q.question}</h3>

                    {q.type === 'mcq' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options?.map((opt, oIdx) => {
                          const isOptionCorrect = q.correctAnswer === oIdx.toString();
                          const isOptionUserChoice = userAns === oIdx.toString();
                          
                          let style = "border-slate-100 bg-slate-50/50 hover:bg-slate-100 text-slate-700";
                          if (isOptionUserChoice) style = "border-indigo-600 bg-indigo-600 text-white shadow-lg";
                          if (isReviewMode) {
                            if (isOptionCorrect) style = "border-emerald-500 bg-emerald-500 text-white";
                            else if (isOptionUserChoice && !isOptionCorrect) style = "border-red-500 bg-red-500 text-white";
                            else style = "opacity-40 border-slate-100 bg-slate-50 text-slate-400";
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={isReviewMode}
                              onClick={() => handleAnswerChange(idx, oIdx.toString())}
                              className={`w-full p-6 text-left rounded-2xl border-2 font-bold transition-all flex items-center gap-4 ${style}`}
                            >
                              <span className="shrink-0 w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-xs">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <input
                          type="text"
                          disabled={isReviewMode}
                          placeholder={q.type === 'blank' ? "Type the missing word..." : "Type your answer here..."}
                          className={`w-full px-8 py-6 rounded-2xl border-2 transition-all text-xl font-bold outline-none ${
                            isReviewMode 
                              ? (correct ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') 
                              : (userAns ? 'border-indigo-600 bg-white' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500')
                          }`}
                          value={userAns}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                        />
                        {isReviewMode && !correct && (
                          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-100 animate-in slide-in-from-top-2">
                             Correct Answer: {q.correctAnswer}
                          </div>
                        )}
                      </div>
                    )}

                    {isReviewMode && q.explanation && (
                      <div className="mt-8 pt-6 border-t border-slate-100 text-sm text-slate-500 font-medium italic">
                        <span className="font-black text-slate-800 not-italic uppercase text-[10px] mr-2">Why?</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
               {!isReviewMode ? (
                  <button
                    onClick={handleSubmitQuiz}
                    className="w-full bg-slate-900 hover:bg-black text-white py-7 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-[0.98]"
                  >
                    Calculate Results
                  </button>
               ) : (
                  <button
                    onClick={resetApp}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-7 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-[0.98]"
                  >
                    Explore New Topic
                  </button>
               )}
            </div>
          </div>
        )}

        {currentStep === 'result' && quiz && (
          <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-2xl border border-slate-50 text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="relative z-10">
               <div className="w-40 h-40 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-10 border-8 border-slate-100 float-animation shadow-inner">
                  <span className="text-6xl">✨</span>
               </div>
               
               <h2 className="text-4xl font-black text-slate-900 mb-2">Knowledge Checked!</h2>
               <p className="text-slate-500 font-medium mb-12">Session finished for <span className="text-indigo-600 font-bold">"{topic}"</span></p>

               <div className="grid grid-cols-2 gap-6 mb-12">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <div className="text-4xl font-black text-indigo-600">{score} / {quiz.questions.length}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Correct Answers</div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <div className="text-4xl font-black text-indigo-600">{Math.round((score/quiz.questions.length)*100)}%</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Proficiency</div>
                  </div>
               </div>

               <div className="space-y-4 max-w-sm mx-auto">
                  <button
                    onClick={resetApp}
                    className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-3xl font-black text-lg transition-all shadow-xl active:scale-[0.98]"
                  >
                    Start New Challenge
                  </button>
                  <button
                    onClick={enterReviewMode}
                    className="w-full bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-600 py-6 rounded-3xl font-black text-lg transition-all"
                  >
                    Review Performance
                  </button>
               </div>
            </div>
          </div>
        )}

        <footer className="mt-20 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
           Powered by Gemini Pro • Production Build
        </footer>
      </div>
    </div>
  );
};

export default App;
