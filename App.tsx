
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, QuizData } from './types';

// Standard React Function Component for AI Quiz Pro
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

  // handleGenerate triggers the Gemini API call to create quiz content
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setIsReviewMode(false);

    try {
      // Use process.env.API_KEY directly as per the coding guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
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

  const allQuestionsAnswered = userAnswers.every(ans => ans !== -1);

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-100">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-block mb-4 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:scale-105 transition-transform" onClick={resetApp}>
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
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Question Count</label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="1"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 px-1">
                    <span>3 QUESTIONS</span>
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{count}</span>
                    <span>10 QUESTIONS</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Create My Quiz'
                )}
              </button>
            </form>
          </div>
        )}

        {currentStep === 'quiz' && quiz && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            {quiz.questions.map((q, qIdx) => (
              <div key={qIdx} className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
                <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-wider rounded-full mb-6">
                  Question {qIdx + 1}
                </span>
                <h3 className="text-2xl font-bold text-gray-900 mb-8 leading-tight">{q.question}</h3>
                <div className="grid grid-cols-1 gap-4">
                  {q.options.map((opt, oIdx) => {
                    let btnStyle = "border-gray-100 bg-gray-50/50 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30";
                    if (userAnswers[qIdx] === oIdx) {
                      btnStyle = "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-100";
                    }
                    if (isReviewMode) {
                      if (oIdx === q.correctAnswer) {
                        btnStyle = "border-green-500 bg-green-500 text-white";
                      } else if (userAnswers[qIdx] === oIdx && oIdx !== q.correctAnswer) {
                        btnStyle = "border-red-500 bg-red-500 text-white";
                      } else {
                        btnStyle = "border-gray-100 bg-gray-50/50 text-gray-400 opacity-60";
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={isReviewMode}
                        onClick={() => handleAnswerSelect(qIdx, oIdx)}
                        className={`w-full p-6 text-left rounded-2xl border-2 font-semibold transition-all ${btnStyle}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-sm font-bold">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          {opt}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-4 pb-12">
              {!isReviewMode ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!allQuestionsAnswered}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
                >
                  Finish Quiz
                </button>
              ) : (
                <button
                  onClick={resetApp}
                  className="w-full bg-gray-900 hover:bg-black text-white py-6 rounded-3xl font-black text-xl shadow-xl transition-all active:scale-[0.98]"
                >
                  Try Another Topic
                </button>
              )}
              <button onClick={resetApp} className="text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors">
                Cancel and go back
              </button>
            </div>
          </div>
        )}

        {currentStep === 'result' && quiz && (
          <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 text-center animate-in zoom-in-95 duration-500">
            <div className="w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <span className="text-5xl">🏆</span>
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-2">Quiz Complete!</h2>
            <p className="text-gray-500 font-medium mb-10">You've finished the challenge for <span className="text-indigo-600 font-bold">{topic}</span></p>
            
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <div className="text-3xl font-black text-indigo-600">{score}/{quiz.questions.length}</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Total Score</div>
              </div>
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <div className="text-3xl font-black text-indigo-600">{Math.round((score/quiz.questions.length)*100)}%</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Accuracy</div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={resetApp}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
              >
                Play Again
              </button>
              <button
                onClick={enterReviewMode}
                className="w-full bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-900 py-6 rounded-3xl font-black text-xl transition-all active:scale-[0.98]"
              >
                Review Answers
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
