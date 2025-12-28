
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData, QuizQuestion, QuizMode, ChatMessage, RoadmapData } from './types';

/**
 * Utility to safely transform strings to uppercase.
 * Prevents "Cannot read properties of undefined (reading 'toUpperCase')" errors.
 */
const safeUpper = (val: any): string => {
  if (typeof val !== 'string') return '';
  return val.toUpperCase();
};

// Simple formatter for markdown-like text (**bold**, * bullet)
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
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

// Define assessment style modes
const modes: { id: QuizMode; label: string; icon: string }[] = [
  { id: 'mixed', label: 'Mixed', icon: '🌀' },
  { id: 'mcq', label: 'MCQs', icon: '📝' },
  { id: 'short', label: 'Short Ans', icon: '⌨️' },
  { id: 'blank', label: 'Fill Blanks', icon: '🕳️' },
];

const App: React.FC = () => {
  // Navigation & Step Management
  const [currentStep, setCurrentStep] = useState<'form' | 'quiz' | 'result' | 'roadmap'>('form');

  // Form State
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<QuizMode>('mixed');
  const [examDate, setExamDate] = useState('');

  // App State
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Quiz Interaction State
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  // AI Tutor State
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<ChatMessage[]>([
    { 
      role: 'model', 
      text: "Hi there! I'm your Kakani academic tutor. \n\nI specialize in **CBSE 10th Boards**. Whether you need a quick **quiz** to test your knowledge or a complete **roadmap planner** for your upcoming exam, I'm here to guide you to success! \n\nWhat subject are we mastering today?" 
    }
  ]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorTyping, setIsTutorTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages]);

  const handleGenerateQuiz = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a subject first.");
      return;
    }

    setLoading(true);
    setError(null);
    setQuiz(null);
    setRoadmap(null);
    setIsReviewMode(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modeInstruction = mode === 'mixed' 
        ? "Mix these types: 'mcq', 'short', and 'blank'."
        : `Strictly generate ONLY '${mode}' type questions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a CBSE Class 10 ${mode} quiz about "${topic}". Difficulty: ${difficulty}. Total questions: ${count}. ${modeInstruction}`,
        config: {
          systemInstruction: "You are a professional CBSE Board Examiner. Focus on NCERT curriculum patterns. Return JSON only. For MCQs, provide 4 options. correctAnswer is the index (0-3).",
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

      const textOutput = response.text;
      if (!textOutput) throw new Error("AI returned empty content");
      const data: QuizData = JSON.parse(textOutput);
      
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid response format from AI.");
      }

      setQuiz(data);
      setUserAnswers(new Array(data.questions.length).fill(''));
      setCurrentStep('quiz');
    } catch (err: any) {
      setError('Error generating quiz. Please check your subject and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!topic.trim()) {
      setError("Please enter a subject name first.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setRoadmap(null);
    setQuiz(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const now = new Date();
      const exam = examDate ? new Date(examDate) : new Date(now.getTime() + (48 * 60 * 60 * 1000));
      const diffMs = exam.getTime() - now.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

      const timeContext = diffHours <= 24 
        ? `the exam is TOMORROW (approx ${diffHours} hours left)` 
        : `the exam is in ${diffDays} days`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Create a comprehensive CBSE Class 10 Board study roadmap for: "${topic}". Context: ${timeContext}. Plan for ${diffHours <= 24 ? 'hours' : 'days'}. Include priorities and study methods.`,
        config: {
          systemInstruction: "You are a master CBSE 10th Board strategist. You know the exact NCERT syllabus and high-weightage topics. Plan effectively. Priority can be 'High', 'Medium', or 'Low'. Method should explain HOW to study (e.g., 'Solve NCERT Exemplar', 'Active Recall diagrams'). Return JSON.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              planType: { type: Type.STRING, enum: ["Days", "Hours"] },
              timeRemaining: { type: Type.STRING },
              entries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    focusTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                    method: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
                  },
                  required: ["title", "duration", "focusTopics", "method", "priority"]
                }
              },
              expertTips: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["subject", "planType", "entries"]
          }
        }
      });

      const textOutput = response.text;
      if (!textOutput) throw new Error("AI returned empty content");
      const data: RoadmapData = JSON.parse(textOutput);

      if (!data.subject || !data.entries) {
        throw new Error("AI response missing critical roadmap data");
      }

      setRoadmap(data);
      setCurrentStep('roadmap');
    } catch (err: any) {
      setError("Could not generate roadmap. Please try a more specific subject name.");
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
    const target = (question.correctAnswer || '').toLowerCase().trim();
    const actual = (userAns || '').toLowerCase().trim();
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
        : (topic ? `We are studying CBSE Class 10 "${topic}".` : "The student is exploring their preparation options.");

      const chatResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...tutorMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: `${context}\n\nUser Question: ${query}` }] }
        ],
        config: {
          systemInstruction: "You are a friendly, expert CBSE 10th tutor. Use simple language. Encourage the student. Use **bold** for key terms."
        }
      });

      setTutorMessages(prev => [...prev, { role: 'model', text: chatResponse.text || "Let's keep going!" }]);
    } catch (err) {
      setTutorMessages(prev => [...prev, { role: 'model', text: "My brain is taking a quick break. Can you repeat that?" }]);
    } finally {
      setIsTutorTyping(false);
    }
  };

  const resetApp = () => {
    setCurrentStep('form');
    setQuiz(null);
    setRoadmap(null);
    setUserAnswers([]);
    setTopic('');
    setError(null);
    setIsTutorOpen(false);
  };

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
              <h2 className="font-black text-slate-900 text-lg md:text-xl tracking-tight leading-none mb-1">Kakani Tutor</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest text-slate-400">CBSE BOARD EXPERT</p>
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
              <div className={`max-w-[92%] p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm text-sm md:text-base leading-relaxed ${
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
              placeholder="Ask me anything..."
              className="w-full pl-6 pr-14 py-4 md:py-5 bg-slate-50 rounded-2xl md:rounded-3xl border-2 border-transparent focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold text-slate-700 text-sm md:text-base"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
            />
            <button 
              disabled={!tutorInput.trim() || isTutorTyping}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
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
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">Strategic CBSE Class 10th Guidance</p>
        </header>

        {currentStep === 'form' && (
          <div className="space-y-6 md:space-y-8 animate-in zoom-in-95 duration-500">
            <div className="bg-white p-6 md:p-14 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl shadow-slate-200/40 border border-slate-50">
              <form onSubmit={handleGenerateQuiz} className="space-y-8 md:space-y-12">
                {/* Subject & Roadmap Button */}
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Subject</label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Science, Maths, SST..."
                      className="flex-1 px-6 py-5 rounded-2xl md:rounded-[2.5rem] border-2 border-slate-50 focus:border-indigo-500 focus:bg-white bg-slate-50/50 outline-none transition-all text-xl md:text-2xl font-bold placeholder:text-slate-200"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateRoadmap}
                      disabled={loading || !topic.trim()}
                      className="px-8 py-5 bg-indigo-600 text-white rounded-2xl md:rounded-[2.5rem] font-black uppercase text-[10px] tracking-[0.1em] shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      ⚡ Plan Roadmap
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Exam Date (Optional for roadmap)</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 rounded-xl md:rounded-2xl border-2 border-slate-50 focus:border-indigo-500 bg-slate-50/50 outline-none font-bold text-slate-700"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Practice Style</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all ${
                          mode === m.id 
                            ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50 shadow-sm' 
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
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Question Count: {count}</label>
                    <div className="pt-2">
                      <input
                        type="range" min="3" max="15" step="1"
                        className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                        value={count}
                        onChange={(e) => setCount(parseInt(e.target.value))}
                      />
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
                      Assembling Prep...
                    </div>
                  ) : "Generate Practice Quiz"}
                </button>
              </form>
            </div>
            
            <button 
              onClick={() => setIsTutorOpen(true)}
              className="w-full p-6 md:p-10 bg-gradient-to-br from-[#4F46E5] to-[#312E81] rounded-[2rem] md:rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(79,70,229,0.3)] flex items-center gap-5 md:gap-8 hover:scale-[1.01] transition-all group overflow-hidden relative"
            >
               <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] select-none pointer-events-none transform -translate-x-12 translate-y-4">
                 <span className="text-[10rem] md:text-[14rem] font-black tracking-tighter text-white uppercase">Tutor</span>
               </div>
               <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl shadow-xl flex items-center justify-center text-4xl md:text-5xl group-hover:rotate-6 transition-transform relative z-10 shrink-0">
                 🎓
               </div>
               <div className="text-left relative z-10 flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                    <h3 className="text-xl md:text-2xl font-black text-white leading-none">CBSE 10th Specialist</h3>
                    <div className="inline-flex flex-col items-center justify-center px-4 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl md:ml-4">
                      <span className="text-[7px] md:text-[8px] font-black text-white tracking-[0.2em] uppercase">AI Help</span>
                      <span className="text-[7px] md:text-[8px] font-black text-white/50 tracking-[0.2em] uppercase leading-none mt-0.5">Online</span>
                    </div>
                  </div>
                  <p className="text-indigo-100/80 text-xs md:text-base font-medium leading-relaxed max-w-sm">
                    Access expert Board Exam strategies, concept deep-dives, and NCERT curriculum guidance.
                  </p>
               </div>
               <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0 relative z-10 group-hover:bg-white group-hover:text-indigo-700 transition-all border border-white/10">
                 <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
               </div>
            </button>
          </div>
        )}

        {currentStep === 'roadmap' && roadmap && (
          <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-10 duration-700 pb-24 px-2 md:px-0">
            {/* Roadmap Hero Header */}
            <div className="bg-white p-8 md:p-14 rounded-[2.5rem] md:rounded-[4rem] border border-slate-100 shadow-xl text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 text-slate-50 font-black text-9xl pointer-events-none select-none -translate-y-12 translate-x-12">CBSE</div>
               <div className="relative z-10">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-4 py-1.5 bg-indigo-50 rounded-full mb-6 inline-block">
                    {safeUpper(roadmap?.planType)} PLANNER
                  </span>
                  <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4">{roadmap?.subject || 'Board'} Strategy</h2>
                  <p className="text-slate-400 font-bold text-sm md:text-lg">Targeted Roadmap for Board Exam Readiness</p>
               </div>
            </div>

            {/* Vertical Timeline View */}
            <div className="relative space-y-6 md:space-y-8">
               <div className="absolute left-[31px] md:left-[39px] top-8 bottom-8 w-1 bg-indigo-100 rounded-full" />

               {roadmap?.entries?.map((entry, idx) => (
                 <div key={idx} className="relative pl-16 md:pl-24 group">
                    <div className={`absolute left-0 top-6 w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] border-8 border-[#F8FAFC] shadow-xl flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${
                      entry.priority === 'High' ? 'bg-rose-500' : entry.priority === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}>
                      <span className="text-white font-black text-[10px] md:text-xs uppercase tracking-tighter leading-none text-center">
                        {entry.priority || '...'}<br/>Priority
                      </span>
                    </div>

                    <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 border-slate-50 shadow-sm hover:shadow-md transition-all">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                          <div>
                             <h4 className="text-xl md:text-2xl font-black text-slate-900">{entry.title}</h4>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{entry.duration}</span>
                          </div>
                          <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                            entry.priority === 'High' ? 'bg-rose-50 text-rose-600' : entry.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            NCERT WEIGHTAGE
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div>
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Priority Topics</p>
                             <div className="flex flex-wrap gap-2">
                                {(entry.focusTopics || []).map((tag, tIdx) => (
                                  <span key={tIdx} className="px-4 py-2 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                                    {tag}
                                  </span>
                                ))}
                             </div>
                          </div>
                          <div className="p-5 md:p-7 bg-indigo-50/50 rounded-2xl md:rounded-[2rem] border border-indigo-100">
                             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Study Methodology</p>
                             <p className="text-indigo-900 font-bold text-sm md:text-lg leading-relaxed">{entry.method}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               ))}
            </div>

            {/* Expert Tips */}
            <div className="bg-slate-900 p-8 md:p-14 rounded-[2.5rem] md:rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 text-white/5 font-black text-9xl pointer-events-none select-none">TIPS</div>
               <h3 className="text-2xl md:text-4xl font-black mb-8 relative z-10">Board Mastery Checklist</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  {(roadmap?.expertTips || []).map((tip, idx) => (
                    <div key={idx} className="p-6 bg-white/5 rounded-2xl border border-white/10 flex gap-4">
                       <span className="text-2xl shrink-0">💡</span>
                       <p className="text-sm md:text-base font-medium opacity-90 leading-relaxed">{tip}</p>
                    </div>
                  ))}
               </div>
            </div>

            <button onClick={resetApp} className="w-full py-6 md:py-8 bg-indigo-600 text-white rounded-2xl md:rounded-[2.5rem] font-black text-xl shadow-xl transition-all hover:bg-indigo-700 active:scale-95">
               New Subject Planning
            </button>
          </div>
        )}

        {currentStep === 'quiz' && quiz && (
          <div className="space-y-6 md:space-y-12 animate-in slide-in-from-bottom-6 duration-700 pb-24 px-2 md:px-0">
            <div className="sticky top-4 z-50 bg-white/80 backdrop-blur-xl border border-white shadow-lg p-5 md:p-8 rounded-2xl md:rounded-[3rem] flex justify-between items-center mx-2 md:mx-0">
               <div className="flex flex-col overflow-hidden">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Active Prep</span>
                  <span className="font-black text-slate-900 text-base md:text-xl truncate">{safeUpper(topic) || 'SESSION'}</span>
               </div>
               <div className="flex items-center gap-4 md:gap-8">
                  <button onClick={() => setIsTutorOpen(true)} className="flex flex-col items-center">
                    <span className="text-[8px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">Advice</span>
                    <span className="text-xl md:text-2xl">💡</span>
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

            <div className="space-y-6 md:space-y-10">
              {quiz.questions.map((q, idx) => {
                const userAns = userAnswers[idx];
                const correct = isCorrect(q, userAns);

                return (
                  <div key={idx} className={`bg-white p-6 md:p-14 rounded-[2rem] md:rounded-[3.5rem] border transition-all ${isReviewMode ? (correct ? 'border-emerald-100 bg-emerald-50/5' : 'border-rose-100 bg-rose-50/5') : 'border-slate-50 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-6 md:mb-10">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest">Q{idx + 1} • {safeUpper(q?.type)}</span>
                      <button 
                        onClick={() => askTutor(`Can you explain the logic behind this question: "${q.question}"?`, q)}
                        className="text-[9px] md:text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        Help <span className="text-lg">🎓</span>
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
                            if (isOptionCorrect) style = "border-emerald-500 bg-emerald-500 text-white shadow-emerald-100";
                            else if (isOptionUserChoice && !isOptionCorrect) style = "border-rose-500 bg-rose-500 text-white shadow-rose-100";
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
                          placeholder="Type answer here..."
                          className={`w-full px-6 py-4 md:px-10 md:py-8 rounded-xl md:rounded-[2rem] border-2 transition-all text-base md:text-2xl font-bold outline-none ${
                            isReviewMode 
                              ? (correct ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-emerald-50' : 'border-rose-500 bg-rose-50 text-rose-900 shadow-rose-50') 
                              : (userAns ? 'border-indigo-600' : 'border-slate-50 bg-slate-50/50 focus:bg-white focus:border-indigo-500')
                          }`}
                          value={userAns || ''}
                          onChange={(e) => handleAnswerChange(idx, e.target.value)}
                        />
                        {isReviewMode && !correct && (
                          <div className="p-5 bg-emerald-50/50 text-emerald-800 rounded-xl md:rounded-[2rem] text-sm md:text-lg font-bold border-2 border-dashed border-emerald-200">
                             Correct Solution: {q.correctAnswer}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isReviewMode && q.explanation && (
                      <div className="mt-8 pt-8 border-t border-slate-50 text-[13px] md:text-[15px] text-slate-500 font-medium italic leading-relaxed">
                        <span className="font-black text-slate-900 not-italic uppercase text-[9px] md:text-[10px] tracking-widest mr-3 py-1 px-3 bg-slate-100 rounded-lg">NCERT Rationale</span>
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
                  {isReviewMode ? "Finish Review" : "Finish Practice Session"}
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
               
               <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-4 tracking-tight">Board Ready?</h2>
               <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[12px] mb-8 md:mb-16">Results for <span className="text-indigo-600">"{safeUpper(topic) || 'SESSION'}"</span></p>

               <div className="grid grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
                  <div className="bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100/50">
                    <div className="text-2xl md:text-5xl font-black text-indigo-600 mb-1">{score}/{quiz.questions.length}</div>
                    <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</div>
                  </div>
                  <div className="bg-slate-50 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100/50">
                    <div className="text-2xl md:text-5xl font-black text-indigo-600 mb-1">{Math.round((score/quiz.questions.length)*100)}%</div>
                    <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Board Accuracy</div>
                  </div>
               </div>

               <div className="space-y-4 max-w-sm mx-auto">
                  <button
                    onClick={() => { setIsTutorOpen(true); askTutor("Let's review my weak points together."); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
                  >
                    Analyze Errors 🎓
                  </button>
                  <button
                    onClick={() => { setIsReviewMode(true); setCurrentStep('quiz'); }}
                    className="w-full bg-slate-900 text-white py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl transition-all"
                  >
                    Detailed Review
                  </button>
                  <button
                    onClick={resetApp}
                    className="w-full bg-white border-2 border-slate-100 text-slate-400 py-5 md:py-7 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl transition-all"
                  >
                    Start New Goal
                  </button>
               </div>
            </div>
          </div>
        )}

        <footer className="mt-16 md:mt-24 text-center pb-8 md:pb-0">
           <p className="text-slate-300 font-black text-[8px] md:text-[10px] uppercase tracking-[0.6em] animate-pulse">Kakani Ecosystem</p>
        </footer>
      </div>

      {/* Floating Tutor FAB */}
      <button 
        onClick={() => setIsTutorOpen(!isTutorOpen)}
        className={`fixed bottom-6 right-6 md:bottom-10 md:right-10 w-16 h-16 md:w-20 md:h-20 bg-indigo-600 text-white rounded-2xl md:rounded-[2rem] shadow-2xl z-[55] transition-all flex items-center justify-center text-3xl hover:scale-110 active:scale-90 ${isTutorOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <span className="animate-bounce-slow">🎓</span>
      </button>
    </div>
  );
};

export default App;
