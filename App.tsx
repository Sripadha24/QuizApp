
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData, QuizQuestion, QuizMode, ChatMessage } from './types';

const App: React.FC = () => {
  // Form State
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<QuizMode>('mixed');

  // App State
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'form' | 'quiz' | 'result'>('form');
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Quiz Interaction State
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  // AI Tutor State
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Hello! I'm your AI Tutor. What would you like to master today? You can start by typing a topic in the main form, or ask me anything right here!" }
  ]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorTyping, setIsTutorTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsReviewMode(false);
    
    // Update tutor context
    setTutorMessages(prev => [
      ...prev,
      { role: 'model', text: `Got it! I'm crafting a specialized ${difficulty} level quiz on "${topic}". While I work on that, feel free to ask me any preliminary questions!` }
    ]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const modeInstruction = mode === 'mixed' 
        ? "Mix these types: 'mcq', 'short', and 'blank'."
        : `Strictly generate ONLY '${mode}' type questions.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a ${mode} quiz about "${topic}". Difficulty: ${difficulty}. Total questions: ${count}. ${modeInstruction}`,
        config: {
          systemInstruction: "You are a versatile quiz creator. Return JSON only. 'correctAnswer' must be a string. For MCQs, index (0-3). For others, the exact word/phrase. Provide clear explanations.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
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
    setTutorMessages(prev => [...prev, { 
      role: 'model', 
      text: `Great job completing the quiz! You scored ${currentScore}/${quiz.questions.length}. Would you like me to explain any specific concepts from the questions you missed?` 
    }]);
  };

  const askTutor = async (query: string, questionContext?: QuizQuestion) => {
    if (!query.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', text: query };
    setTutorMessages(prev => [...prev, userMsg]);
    setTutorInput('');
    setIsTutorTyping(true);
    setIsTutorOpen(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = questionContext 
        ? `The student is asking about this question: "${questionContext.question}". The correct answer is "${questionContext.correctAnswer}".`
        : (topic ? `We are studying "${topic}" at ${difficulty} level.` : "The student is currently on the landing page, exploring what to study.");

      const chatResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...tutorMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: `${context}\n\nUser Question: ${query}` }] }
        ],
        config: {
          systemInstruction: "You are a friendly, encouraging academic tutor. Help the student understand concepts. Use simple analogies. If they haven't picked a topic yet, suggest trending academic subjects or help them brainstorm based on their interests."
        }
      });

      const reply = chatResponse.text || "I'm sorry, I'm having trouble connecting to my knowledge base. Let's try again!";
      setTutorMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setTutorMessages(prev => [...prev, { role: 'model', text: "Oops! My brain froze for a second. Can you ask that again?" }]);
    } finally {
      setIsTutorTyping(false);
    }
  };

  const enterReviewMode = () => {
    setIsReviewMode(true);
    setCurrentStep('quiz');
  };

  const resetApp = () => {
    setCurrentStep('form');
    setQuiz(null);
    setUserAnswers([]);
    setTopic('');
    setError(null);
    // Don't clear tutor messages entirely, just add a refresh
    setTutorMessages(prev => [...prev, { role: 'model', text: "Ready for a new adventure? What should we learn next?" }]);
    setIsTutorOpen(false);
  };

  const modes: { id: QuizMode; label: string; icon: string }[] = [
    { id: 'mixed', label: 'Mixed', icon: '🎭' },
    { id: 'mcq', label: 'MCQs', icon: '🔘' },
    { id: 'blank', label: 'Blanks', icon: '✍️' },
    { id: 'short', label: 'Short Ans', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 selection:bg-indigo-100 relative overflow-x-hidden">
      
      {/* AI Tutor Sidebar Overlay */}
      <div className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isTutorOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsTutorOpen(false)} />
      
      {/* AI Tutor Sidebar */}
      <aside className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] transform transition-transform duration-500 ease-out flex flex-col ${isTutorOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              🎓
            </div>
            <div>
              <h2 className="font-black text-lg">AI Learning Tutor</h2>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Ready to Brainstorm</p>
            </div>
          </div>
          <button onClick={() => setIsTutorOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {tutorMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm text-sm leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTutorTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <form 
            onSubmit={(e) => { e.preventDefault(); askTutor(tutorInput); }}
            className="relative flex items-center gap-2"
          >
            <input 
              type="text"
              placeholder="Ask your tutor anything..."
              className="w-full pl-6 pr-14 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-600 outline-none transition-all font-medium text-sm"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
            />
            <button 
              disabled={!tutorInput.trim() || isTutorTyping}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
          
        </div>
      </aside>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-3xl shadow-sm border border-slate-100 mb-6 cursor-pointer hover:scale-110 transition-transform" onClick={resetApp}>
             <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">
            Kakani's <span className="text-indigo-600">Exam Prep</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Your personal path to mastery</p>
        </header>

        {currentStep === 'form' && (
          <div className="space-y-6">
            <div className="bg-white p-8 md:p-14 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-50 animate-in zoom-in-95 duration-500">
              <form onSubmit={handleGenerate} className="space-y-12">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">What do you want to learn?</label>
                    <button 
                      type="button"
                      onClick={() => setIsTutorOpen(true)}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-indigo-100 animate-pulse hover:scale-105 transition-transform"
                    >
                      <span>Brainstorm with Tutor</span>
                      <span className="text-sm">💡</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Molecular Biology, French Renaissance, Quantum Physics..."
                    className="w-full px-8 py-6 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 focus:bg-white bg-slate-50/50 outline-none transition-all text-xl font-bold placeholder:text-slate-300"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Assessment Mode</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all group ${
                          mode === m.id 
                            ? 'border-indigo-600 bg-indigo-50/50' 
                            : 'border-slate-50 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{m.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-tight ${mode === m.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>
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
                      Crafting...
                    </div>
                  ) : (
                    <>
                      Launch Assessment
                      <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
            
            <button 
              onClick={() => setIsTutorOpen(true)}
              className="w-full p-10 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] border-4 border-white shadow-2xl shadow-indigo-200 flex items-center gap-8 hover:scale-[1.02] transition-all group overflow-hidden relative"
            >
               <div className="absolute top-0 right-0 p-4 text-white/5 text-9xl font-black select-none pointer-events-none group-hover:scale-110 transition-transform">TUTOR</div>
               <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-5xl group-hover:rotate-12 transition-transform relative z-10 shrink-0">🎓</div>
               <div className="text-left relative z-10">
                  <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                    Not sure what to pick?
                    <span className="px-3 py-1 bg-white/20 text-[10px] rounded-full uppercase tracking-widest backdrop-blur-md">Highly Recommended</span>
                  </h3>
                  <p className="text-indigo-100 text-lg font-medium leading-snug">Chat with your AI Tutor for specialized topic suggestions, study guides, or quick interactive lessons.</p>
               </div>
               <div className="ml-auto relative z-10">
                 <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-all text-white">
                   <svg className="w-8 h-8 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7" /></svg>
                 </div>
               </div>
            </button>
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
                  <button 
                    onClick={() => setIsTutorOpen(true)}
                    className="flex flex-col items-center group"
                  >
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:underline">Ask Tutor</span>
                    <span className="text-xl group-hover:scale-125 transition-transform">🎓</span>
                  </button>
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
                  <div key={idx} className={`bg-white p-8 md:p-10 rounded-[2.5rem] border shadow-sm transition-all relative ${isReviewMode ? (correct ? 'border-emerald-100 bg-emerald-50/10' : 'border-red-100 bg-red-50/10') : 'border-slate-100'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                      <div className="flex gap-2">
                        <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          Q{idx + 1} • {q.type.toUpperCase()}
                        </span>
                        {isReviewMode && (
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {correct ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => askTutor(`Can you explain this concept to me? Question: ${q.question}`, q)}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                      >
                        Explain to me <span className="text-lg">💡</span>
                      </button>
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
                          placeholder={q.type === 'blank' ? "Type missing word..." : "Type answer..."}
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
                  <span className="text-6xl">🎓</span>
               </div>
               
               <h2 className="text-4xl font-black text-slate-900 mb-2">Mastery Unlocked!</h2>
               <p className="text-slate-500 font-medium mb-12">Performance for <span className="text-indigo-600 font-bold">"{topic}"</span></p>

               <div className="grid grid-cols-2 gap-6 mb-12">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <div className="text-4xl font-black text-indigo-600">{score} / {quiz.questions.length}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Score</div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <div className="text-4xl font-black text-indigo-600">{Math.round((score/quiz.questions.length)*100)}%</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Proficiency</div>
                  </div>
               </div>

               <div className="space-y-4 max-w-sm mx-auto">
                  <button
                    onClick={() => { setIsTutorOpen(true); askTutor("Can we review my results? I want to understand my mistakes."); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black text-lg transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    Discuss with Tutor 🎓
                  </button>
                  <button
                    onClick={enterReviewMode}
                    className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-3xl font-black text-lg transition-all"
                  >
                    Self-Review
                  </button>
                  <button
                    onClick={resetApp}
                    className="w-full bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-400 py-6 rounded-3xl font-black text-lg transition-all"
                  >
                    Start New Challenge
                  </button>
               </div>
            </div>
          </div>
        )}

        <footer className="mt-20 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
           Powered by Kakani
        </footer>
      </div>

      {/* Floating Tutor FAB - Always visible now */}
      <button 
        onClick={() => setIsTutorOpen(!isTutorOpen)}
        className={`fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl z-[55] transition-all hover:scale-110 active:scale-95 flex items-center justify-center text-2xl group ${isTutorOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <span className="group-hover:animate-bounce">🎓</span>
        {tutorMessages.length <= 1 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-4 border-white animate-ping" />
        )}
      </button>
    </div>
  );
};

export default App;
