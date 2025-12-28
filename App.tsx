
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData, QuizQuestion, QuizMode, ChatMessage } from './types';

// Simple formatter for markdown-like text (**bold**, * bullet)
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*.*?\*\*|\n)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part === '\n') return <br key={i} />;
        if (part.trim().startsWith('* ')) {
          return (
            <div key={i} className="pl-4 relative">
              <span className="absolute left-0 text-indigo-400">•</span>
              {part.trim().slice(2)}
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

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
    { 
      role: 'model', 
      text: "Hi there! It is so wonderful to meet you. I’m your academic tutor, and I’m here to help make learning feel like a fun adventure rather than a chore. \n\nSince we are just starting out, is there a specific subject you’ve been curious about lately? If you aren't sure yet, that is totally okay! We can brainstorm together. \n\nTo get your brain moving, here are a few **trending** topics we could explore:\n* **Psychology** (The path of the mind)\n* **Quantum Physics** (The universe at its smallest)\n* **Medieval History** (Knights and legends)" 
    }
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
    
    setTutorMessages(prev => [
      ...prev,
      { role: 'model', text: `Got it! I'm crafting a specialized **${difficulty}** level quiz on **"${topic}"**. While I work on that, feel free to ask me any preliminary questions!` }
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
      text: `Great job! You scored **${currentScore}/${quiz.questions.length}**. I'm so proud of your progress. Would you like to review any specific questions?` 
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
        : (topic ? `We are studying "${topic}" at ${difficulty} level.` : "The student is currently on the landing page.");

      const chatResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...tutorMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: `${context}\n\nUser Question: ${query}` }] }
        ],
        config: {
          systemInstruction: "You are a friendly, encouraging academic tutor. Help the student understand concepts. Use simple analogies. Always be warm and positive. Use **bold** for emphasis and * for bullet points when providing lists."
        }
      });

      const reply = chatResponse.text || "I'm sorry, I'm having trouble connecting. Let's try again!";
      setTutorMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setTutorMessages(prev => [...prev, { role: 'model', text: "Oops! My brain froze. Let's try once more?" }]);
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
    setTutorMessages(prev => [...prev, { role: 'model', text: "Ready for something new? I'm here to help!" }]);
    setIsTutorOpen(false);
  };

  const modes: { id: QuizMode; label: string; icon: string }[] = [
    { id: 'mixed', label: 'Mixed', icon: '🎭' },
    { id: 'mcq', label: 'MCQs', icon: '🔘' },
    { id: 'blank', label: 'Blanks', icon: '✍️' },
    { id: 'short', label: 'Short Ans', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-4 px-4 md:py-12 selection:bg-indigo-100 relative overflow-x-hidden">
      
      {/* AI Tutor Sidebar Overlay */}
      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] transition-opacity duration-300 ${isTutorOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsTutorOpen(false)} />
      
      {/* AI Tutor Sidebar */}
      <aside className={`fixed right-0 top-0 h-full w-full max-w-full sm:max-w-md bg-white shadow-2xl z-[70] transform transition-transform duration-500 ease-out flex flex-col ${isTutorOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl shadow-lg shadow-indigo-100">
              🎓
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg md:text-xl tracking-tight leading-none mb-1">Academic Tutor</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-slate-400">Personalized Support</p>
              </div>
            </div>
          </div>
          <button onClick={() => setIsTutorOpen(false)} className="p-2 md:p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 bg-slate-50/30">
          {tutorMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
              <div className={`max-w-[92%] p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm leading-relaxed text-[14px] md:text-[15px] ${
                msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none font-medium' 
                : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none font-normal'
              }`}>
                <FormattedText text={msg.text} />
              </div>
            </div>
          ))}
          {isTutorTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl rounded-tl-none flex gap-1.5 shadow-sm">
                <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-100 pb-safe">
          <form 
            onSubmit={(e) => { e.preventDefault(); askTutor(tutorInput); }}
            className="relative flex items-center gap-2"
          >
            <input 
              type="text"
              placeholder="Type your question..."
              className="w-full pl-6 pr-14 py-4 md:py-5 bg-slate-50 rounded-2xl md:rounded-3xl border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold text-slate-700 text-sm md:text-base"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
            />
            <button 
              disabled={!tutorInput.trim() || isTutorTyping}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-indigo-100"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center justify-center p-3 md:p-4 bg-white rounded-2xl md:rounded-[2rem] shadow-xl border border-slate-50 mb-6 cursor-pointer hover:scale-110 transition-transform" onClick={resetApp}>
             <svg className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-2 leading-none">
            Kakani's <span className="text-indigo-600">Exam Prep</span>
          </h1>
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">The Future of Academic Prep</p>
        </header>

        {currentStep === 'form' && (
          <div className="space-y-6 md:space-y-8">
            <div className="bg-white p-6 md:p-14 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl shadow-slate-200/40 border border-slate-50 animate-in zoom-in-95 duration-700">
              <form onSubmit={handleGenerate} className="space-y-8 md:space-y-12">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cognitive Psychology..."
                    className="w-full px-6 py-5 md:px-10 md:py-7 rounded-2xl md:rounded-[2.5rem] border-2 border-slate-50 focus:border-indigo-500 focus:bg-white bg-slate-50/50 outline-none transition-all text-lg md:text-2xl font-bold placeholder:text-slate-200"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assessment Style</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all ${
                          mode === m.id 
                            ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50' 
                            : 'border-slate-50 bg-slate-50/50 hover:bg-white hover:border-slate-100'
                        }`}
                      >
                        <span className="text-xl md:text-3xl mb-1 md:mb-2">{m.icon}</span>
                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tight ${mode === m.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Difficulty</label>
                    <div className="flex p-1.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                      {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDifficulty(d)}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-wider transition-all ${
                            difficulty === d ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Questions: {count}</label>
                    <div className="pt-2">
                      <input
                        type="range" min="3" max="15" step="1"
                        className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value))}
                      />
                      <div className="flex justify-between text-[8px] md:text-[9px] font-black text-slate-300 mt-2 px-1">
                        <span>3 MIN</span>
                        <span>15 MAX</span>
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="p-4 bg-rose-50 text-rose-600 text-[12px] font-bold rounded-2xl border border-rose-100">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] font-black text-xl md:text-2xl shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-4"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                      Assembling...
                    </div>
                  ) : "Build Assessment"}
                </button>
              </form>
            </div>
            
            {/* STUCK ON A TOPIC CARD */}
            <button 
              onClick={() => setIsTutorOpen(true)}
              className="w-full p-6 md:p-10 bg-gradient-to-br from-[#4F46E5] to-[#312E81] rounded-[2rem] md:rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(79,70,229,0.3)] flex items-center gap-5 md:gap-8 hover:scale-[1.01] transition-all group overflow-hidden relative"
            >
               <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] select-none pointer-events-none transform -translate-x-12 translate-y-4">
                 <span className="text-[10rem] md:text-[14rem] font-black tracking-tighter text-white">TUTOR</span>
               </div>
               <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl shadow-xl flex items-center justify-center text-4xl md:text-5xl group-hover:rotate-6 transition-transform relative z-10 shrink-0">
                 🎓
               </div>
               <div className="text-left relative z-10 flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h3 className="text-xl md:text-2xl font-black text-white leading-none">Stuck on a Topic?</h3>
                    <div className="inline-flex flex-col items-center justify-center px-4 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl md:ml-4">
                      <span className="text-[7px] md:text-[8px] font-black text-white tracking-[0.2em] uppercase">AI TUTOR</span>
                      <span className="text-[7px] md:text-[8px] font-black text-white/50 tracking-[0.2em] uppercase leading-none mt-0.5">ACTIVE</span>
                    </div>
                  </div>
                  <p className="text-indigo-100/80 text-xs md:text-base font-medium leading-relaxed max-w-sm">
                    Unlock personalized study guides, deep-dive explanations, and expert curriculum suggestions. Let's build your path to mastery.
                  </p>
               </div>
               <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0 relative z-10 group-hover:bg-white group-hover:text-indigo-700 transition-all border border-white/10">
                 <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
               </div>
            </button>
          </div>
        )}

        {currentStep === 'quiz' && quiz && (
          <div className="space-y-6 md:space-y-12 animate-in slide-in-from-bottom-6 duration-700 pb-24">
            <div className="sticky top-4 z-50 bg-white/80 backdrop-blur-xl border border-white shadow-lg p-5 md:p-8 rounded-2xl md:rounded-[3rem] flex justify-between items-center mx-2 md:mx-0">
               <div className="flex flex-col overflow-hidden">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Studying</span>
                  <span className="font-black text-slate-900 text-base md:text-xl truncate">{topic}</span>
               </div>
               <div className="flex items-center gap-4 md:gap-8">
                  <button onClick={() => setIsTutorOpen(true)} className="flex flex-col items-center">
                    <span className="text-[8px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">Help</span>
                    <span className="text-xl md:text-2xl">🎓</span>
                  </button>
                  <div className="h-8 md:h-10 w-px bg-slate-100"></div>
                  <div className="text-right">
                    <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Progress</span>
                    <div className="font-black text-indigo-600 text-base md:text-xl">
                      {userAnswers.filter(a => a !== '').length} / {quiz.questions.length}
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-6 md:space-y-10 px-2 md:px-0">
              {quiz.questions.map((q, idx) => {
                const userAns = userAnswers[idx];
                const correct = isCorrect(q, userAns);

                return (
                  <div key={idx} className={`bg-white p-6 md:p-14 rounded-[2rem] md:rounded-[3.5rem] border transition-all ${isReviewMode ? (correct ? 'border-emerald-100 bg-emerald-50/5' : 'border-rose-100 bg-rose-50/5') : 'border-slate-50 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-6 md:mb-10">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest">Q{idx + 1} • {q.type.toUpperCase()}</span>
                      <button 
                        onClick={() => askTutor(`Explain this question: "${q.question}"`, q)}
                        className="text-[9px] md:text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        Help <span className="text-lg">💡</span>
                      </button>
                    </div>

                    <h3 className="text-xl md:text-3xl font-bold text-slate-900 mb-6 md:mb-10 leading-snug tracking-tight">{q.question}</h3>

                    {q.type === 'mcq' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
                        {q.options?.map((opt, oIdx) => {
                          const isOptionCorrect = q.correctAnswer === oIdx.toString();
                          const isOptionUserChoice = userAns === oIdx.toString();
                          
                          let style = "border-slate-50 bg-slate-50/50 text-slate-700";
                          if (isOptionUserChoice) style = "border-indigo-600 bg-indigo-600 text-white shadow-lg";
                          if (isReviewMode) {
                            if (isOptionCorrect) style = "border-emerald-500 bg-emerald-500 text-white";
                            else if (isOptionUserChoice && !isOptionCorrect) style = "border-rose-500 bg-rose-500 text-white";
                            else style = "opacity-40 border-slate-100 bg-slate-50 text-slate-300";
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={isReviewMode}
                              onClick={() => handleAnswerChange(idx, oIdx.toString())}
                              className={`w-full p-5 md:p-8 text-left rounded-xl md:rounded-[2rem] border-2 font-bold transition-all flex items-center gap-3 md:gap-5 ${style}`}
                            >
                              <span className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg bg-black/5 flex items-center justify-center text-[10px] font-black">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="text-sm md:text-lg leading-tight">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <input
                          type="text"
                          disabled={isReviewMode}
                          placeholder="Type answer..."
                          className={`w-full px-6 py-4 md:px-10 md:py-8 rounded-xl md:rounded-[2rem] border-2 transition-all text-base md:text-2xl font-bold outline-none ${
                            isReviewMode 
                              ? (correct ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-rose-500 bg-rose-50 text-rose-900') 
                              : (userAns ? 'border-indigo-600' : 'border-slate-50 bg-slate-50/50 focus:bg-white focus:border-indigo-500')
                          }`}
                          value={userAns}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                        />
                        {isReviewMode && !correct && (
                          <div className="p-5 bg-emerald-50/50 text-emerald-800 rounded-xl md:rounded-[2rem] text-sm md:text-lg font-bold border-2 border-dashed border-emerald-200">
                             Correct Answer: {q.correctAnswer}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isReviewMode && q.explanation && (
                      <div className="mt-8 pt-8 border-t border-slate-50 text-[13px] md:text-[15px] text-slate-500 font-medium italic leading-relaxed">
                        <span className="font-black text-slate-900 not-italic uppercase text-[9px] md:text-[10px] tracking-widest mr-3 py-1 px-3 bg-slate-100 rounded-lg">Rationale</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="max-w-md mx-auto pt-6 px-4">
               <button
                  onClick={isReviewMode ? resetApp : handleSubmitQuiz}
                  className={`w-full py-6 md:py-8 rounded-2xl md:rounded-[3rem] font-black text-lg md:text-2xl shadow-xl transition-all ${isReviewMode ? 'bg-indigo-600' : 'bg-slate-900'} text-white hover:scale-[1.02] active:scale-[0.97]`}
                >
                  {isReviewMode ? "Finish Review" : "Finish Assessment"}
               </button>
            </div>
          </div>
        )}

        {currentStep === 'result' && quiz && (
          <div className="bg-white p-8 md:p-24 rounded-[2rem] md:rounded-[5rem] shadow-2xl border border-slate-50 text-center animate-in zoom-in-95 duration-700 relative overflow-hidden mx-2 md:mx-0">
            <div className="absolute top-0 left-0 w-full h-2 md:h-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
            
            <div className="relative z-10 pt-4 md:pt-0">
               <div className="w-32 h-32 md:w-52 md:h-52 bg-slate-50/50 rounded-full flex items-center justify-center mx-auto mb-8 md:mb-12 border-4 md:border-[12px] border-white float-animation shadow-lg">
                  <span className="text-5xl md:text-8xl">🎓</span>
               </div>
               
               <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-4 tracking-tight">Mastery Unlocked</h2>
               <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[12px] mb-8 md:mb-16">Results for <span className="text-indigo-600">"{topic}"</span></p>

               <div className="grid grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
                  <div className="bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100/50">
                    <div className="text-2xl md:text-5xl font-black text-indigo-600 mb-1">{score}/{quiz.questions.length}</div>
                    <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</div>
                  </div>
                  <div className="bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100/50">
                    <div className="text-2xl md:text-5xl font-black text-indigo-600 mb-1">{Math.round((score/quiz.questions.length)*100)}%</div>
                    <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Accuracy</div>
                  </div>
               </div>

               <div className="space-y-4 max-w-sm mx-auto">
                  <button
                    onClick={() => { setIsTutorOpen(true); askTutor("Let's review my mistakes together."); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
                  >
                    Discuss Results 🎓
                  </button>
                  <button
                    onClick={enterReviewMode}
                    className="w-full bg-slate-900 text-white py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl transition-all"
                  >
                    Correction Mode
                  </button>
                  <button
                    onClick={resetApp}
                    className="w-full bg-white border-2 border-slate-100 text-slate-400 py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl transition-all"
                  >
                    Start New Quest
                  </button>
               </div>
            </div>
          </div>
        )}

        <footer className="mt-16 md:mt-24 text-center pb-8 md:pb-0">
           <p className="text-slate-300 font-black text-[8px] md:text-[10px] uppercase tracking-[0.6em] animate-pulse">Kakani Ecosystem</p>
        </footer>
      </div>

      {/* Floating Tutor FAB - Optimized for touch */}
      <button 
        onClick={() => setIsTutorOpen(!isTutorOpen)}
        className={`fixed bottom-6 right-6 md:bottom-10 md:right-10 w-16 h-16 md:w-20 md:h-20 bg-indigo-600 text-white rounded-2xl md:rounded-[2rem] shadow-2xl z-[55] transition-all flex items-center justify-center text-3xl hover:scale-110 active:scale-90 ${isTutorOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <span className="animate-bounce-slow">🎓</span>
        {tutorMessages.length <= 1 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-rose-500 rounded-full border-4 md:border-[5px] border-white animate-ping" />
        )}
      </button>
    </div>
  );
};

export default App;
