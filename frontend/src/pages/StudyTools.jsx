import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import useThemeMode from '../hooks/useThemeMode';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'markdown-to-jsx';
import { 
  Sparkles, Calendar, BookOpen, Brain, Clock,
  Plus, Check, Trash, ArrowRight, RotateCw, 
  HelpCircle, ChevronRight, CheckCircle2, AlertTriangle, 
  Save, Download, Loader2, Sparkle, Target, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudyTools() {
  const isDarkMode = useThemeMode();
  const [activeTab, setActiveTab] = useState('planner');
  const [isLoading, setIsLoading] = useState(false);

  // Styling helpers based on Deep Academic Blue and Modern Gold accent
  const baseCardStyle = isDarkMode 
    ? 'bg-[#0F172A]/85 border-white/10 text-white shadow-xl shadow-black/30' 
    : 'bg-white border-slate-200 text-slate-800 shadow-lg shadow-slate-100/50';

  const goldText = isDarkMode ? 'text-amber-400' : 'text-amber-600';
  const goldBg = isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200';
  const goldBtn = 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20';

  // ==================== 1. PLANNER STATE & HANDLERS ====================
  const [subjects, setSubjects] = useState('');
  const [examDate, setExamDate] = useState('');
  const [dailyHours, setDailyHours] = useState('2');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);

  const { data: profileData } = useQuery({
    queryKey: ['studyToolsProfile'],
    queryFn: async () => {
      const { data } = await api.get('/learning-profile/me').catch(() => ({ data: { success: true, data: {} } }));
      return data.data || {};
    }
  });

  const profileStrengths = Array.isArray(profileData?.strengths) ? profileData.strengths.slice(0, 3) : [];
  const profileWeaknesses = Array.isArray(profileData?.weaknesses) ? profileData.weaknesses.slice(0, 3) : [];

  useEffect(() => {
    fetchSavedPlans();
  }, []);

  const fetchSavedPlans = async () => {
    try {
      const { data } = await api.get('/ai/study-planner');
      if (data.success) {
        setSavedPlans(data.data || []);
        if (data.data.length > 0 && !currentPlan) {
          setCurrentPlan(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!subjects.trim() || !examDate || !dailyHours) {
      toast.error('Please fill in all planner fields.');
      return;
    }

    setIsLoading(true);
    try {
      const subjectArray = subjects.split(',').map(s => s.trim()).filter(Boolean);
      const { data } = await api.post('/ai/study-planner', {
        subjects: subjectArray,
        examDate,
        dailyHours: parseFloat(dailyHours)
      });

      if (data.success) {
        setCurrentPlan(data.data);
        setSavedPlans(prev => [data.data, ...prev]);
        toast.success('AI Study Timetable created and saved!');
        setSubjects('');
      } else {
        toast.error('Failed to create plan.');
      }
    } catch (error) {
      console.error('Planner Error:', error);
      toast.error(error.response?.data?.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlan = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this plan permanently?')) return;
    try {
      await api.delete(`/ai/study-planner/${id}`);
      setSavedPlans(prev => prev.filter(p => p.id !== id));
      if (currentPlan?.id === id) {
        setCurrentPlan(savedPlans.find(p => p.id !== id) || null);
      }
      toast.success('Study plan deleted.');
    } catch (error) {
      toast.error('Delete failed.');
    }
  };

  // ==================== 2. FLASHCARD STATE & HANDLERS ====================
  const [cardDeckTitle, setCardDeckTitle] = useState('');
  const [cardNotes, setCardNotes] = useState('');
  const [currentDeck, setCurrentDeck] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [learnedCount, setLearnedCount] = useState(0);

  useEffect(() => {
    fetchSavedDecks();
  }, []);

  const fetchSavedDecks = async () => {
    try {
      const { data } = await api.get('/ai/flashcards');
      if (data.success) {
        setSavedDecks(data.data || []);
        if (data.data.length > 0 && !currentDeck) {
          setCurrentDeck(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching decks:', error);
    }
  };

  const handleCreateFlashcards = async (e) => {
    e.preventDefault();
    if (!cardNotes.trim()) {
      toast.error('Please enter notes or copy textbook material.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/flashcards', {
        title: cardDeckTitle.trim() || 'Custom Revision Deck',
        text: cardNotes
      });

      if (data.success) {
        setCurrentDeck(data.data);
        setSavedDecks(prev => [data.data, ...prev]);
        setActiveCardIndex(0);
        setIsFlipped(false);
        setLearnedCount(0);
        toast.success('AI Flashcard Deck generated successfully!');
        setCardNotes('');
        setCardDeckTitle('');
      } else {
        toast.error('Failed to create flashcards.');
      }
    } catch (error) {
      console.error('Flashcard error:', error);
      toast.error('Flashcard generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeck = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this flashcard deck permanently?')) return;
    try {
      await api.delete(`/ai/flashcards/${id}`);
      setSavedDecks(prev => prev.filter(d => d.id !== id));
      if (currentDeck?.id === id) {
        setCurrentDeck(savedDecks.find(d => d.id !== id) || null);
        setActiveCardIndex(0);
        setIsFlipped(false);
        setLearnedCount(0);
      }
      toast.success('Flashcard deck deleted.');
    } catch (error) {
      toast.error('Delete failed.');
    }
  };

  // ==================== 3. QUIZ STATE & HANDLERS ====================
  const [quizNotes, setQuizNotes] = useState('');
  const [quizDifficulty, setQuizDifficulty] = useState('Intermediate');
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizAnswersRecord, setQuizAnswersRecord] = useState([]); // tracks correct/incorrect choices
  const [shortAnswerText, setShortAnswerText] = useState('');

  const handleGenerateQuiz = async (e) => {
    e.preventDefault();
    if (!quizNotes.trim()) {
      toast.error('Please paste some text/notes to generate questions.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/quiz', {
        text: quizNotes,
        difficulty: quizDifficulty
      });

      if (data.success && Array.isArray(data.quiz)) {
        setGeneratedQuiz(data.quiz);
        setCurrentQuestionIdx(0);
        setSelectedQuizAnswer(null);
        setQuizScore(0);
        setQuizSubmitted(false);
        setQuizAnswersRecord([]);
        setShortAnswerText('');
        toast.success('Quiz ready! Let\'s test your memory.');
        setQuizNotes('');
      } else {
        toast.error('Invalid response format from AI.');
      }
    } catch (error) {
      console.error('Quiz Error:', error);
      toast.error('Failed to create quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizAnswerSubmit = (option) => {
    if (selectedQuizAnswer !== null) return; // Answer locked
    const currentQ = generatedQuiz[currentQuestionIdx];
    const isCorrect = currentQ.type === 'short_answer'
      ? (currentQ.acceptableAnswers || []).some((answer) => answer.toLowerCase() === String(option || '').trim().toLowerCase())
      : option === currentQ.correctAnswer;

    setSelectedQuizAnswer(option);
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
    setQuizAnswersRecord(prev => [...prev, {
      question: currentQ.question,
      selected: option,
      correct: currentQ.correctAnswer,
      isCorrect,
      explanation: currentQ.explanation,
      type: currentQ.type
    }]);
  };

  const handleShortAnswerSubmit = () => {
    if (!shortAnswerText.trim()) {
      toast.error('Please enter your answer before continuing.');
      return;
    }

    handleQuizAnswerSubmit(shortAnswerText.trim());
  };

  const handleNextQuizQuestion = () => {
    if (currentQuestionIdx + 1 < generatedQuiz.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedQuizAnswer(null);
      setShortAnswerText('');
    } else {
      setQuizSubmitted(true);
    }
  };

  // ==================== 4. SUMMARIZER STATE & HANDLERS ====================
  const [summarizeText, setSummarizeText] = useState('');
  const [summarizeFormat, setSummarizeFormat] = useState('bullet_points');
  const [generatedSummary, setGeneratedSummary] = useState('');

  const handleSummarize = async (e) => {
    e.preventDefault();
    if (!summarizeText.trim()) {
      toast.error('Please enter notes or text to summarize.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/summarize', {
        text: summarizeText,
        format: summarizeFormat
      });

      if (data.success) {
        setGeneratedSummary(data.summary);
        toast.success('Notes summary compiled!');
        setSummarizeText('');
      } else {
        toast.error('Failed to generate summary.');
      }
    } catch (error) {
      console.error('Summarize Error:', error);
      toast.error('Notes summarization failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSummary = () => {
    if (!generatedSummary) return;
    const blob = new Blob([generatedSummary], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Revision_Notes_Summary.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Summary exported as Markdown.');
  };

  // ==================== 5. ADAPTIVE WEAKNESS COACH ====================
  const [practiceTopic, setPracticeTopic] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [selectedPracticeAnswers, setSelectedPracticeAnswers] = useState({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);

  const handleGenerateAdaptivePractice = async (topicToPractice) => {
    const target = topicToPractice || practiceTopic || profileWeaknesses[0] || 'Core concepts';
    setIsLoading(true);
    setPracticeSubmitted(false);
    setSelectedPracticeAnswers({});
    setPracticeTopic(target);
    try {
      const { data } = await api.post('/v2/intelligence/mentor/practice', {
        topic: target,
        courseTitle: profileData?.currentFocus || 'General Learning'
      });
      if (data.success && data.data?.questions) {
        setPracticeQuestions(data.data.questions);
        toast.success(`Generated adaptive challenge on ${target}!`);
      } else {
        toast.error('Could not generate practice questions.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Adaptive practice coach error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPracticeAnswer = (qIndex, option) => {
    if (practiceSubmitted) return;
    setSelectedPracticeAnswers({ ...selectedPracticeAnswers, [qIndex]: option });
  };

  const handleSubmitPractice = () => {
    let correctCount = 0;
    practiceQuestions.forEach((q, idx) => {
      if (selectedPracticeAnswers[idx] === q.answer) {
        correctCount++;
      }
    });
    const pct = practiceQuestions.length > 0 ? Math.round((correctCount / practiceQuestions.length) * 100) : 0;
    setPracticeScore(pct);
    setPracticeSubmitted(true);
    toast.success(`Practice challenge completed: ${pct}%!`);
  };

  return (
    <div className="space-y-8 max-w-none w-full pb-10">
      
      {/* Header Banner */}
      <div className={`rounded-[2rem] p-8 md:p-10 relative overflow-hidden backdrop-blur-2xl border ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.35)]' : 'bg-white/60 border-slate-200 shadow-sm'}`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#00D4FF]/10 to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div>
            <h1 className={`text-3xl md:text-4xl font-black flex items-center gap-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Sparkles className={`w-8 h-8 ${goldText}`} />
              AI Study Tools Center
            </h1>
            <p className={`text-sm font-semibold mt-2 max-w-2xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Leverage custom AI models to plan timetables, generate active recall flashcards, simulate self-evaluation quizzes, and compress long lectures.
            </p>
            <div className={`mt-3 flex flex-wrap items-center gap-2 ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100'}`}>
                <Sparkle className="h-3.5 w-3.5" />
                Personalized for {profileData?.currentFocus || 'your current learning path'}
              </div>
              {profileStrengths.length > 0 && (
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Strengths: {profileStrengths.join(', ')}
                </div>
              )}
              {profileWeaknesses.length > 0 && (
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  Focus areas: {profileWeaknesses.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#00D4FF]/5 w-max max-w-full">
        {[
          { id: 'planner', label: 'Study Planner', icon: Calendar },
          { id: 'flashcards', label: 'Flashcard Gen', icon: Brain },
          { id: 'quiz', label: 'Quiz Builder', icon: HelpCircle },
          { id: 'summary', label: 'Summarizer', icon: BookOpen },
          { id: 'adaptive', label: 'Adaptive Coach', icon: Target }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setGeneratedQuiz(null); setGeneratedSummary(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab.id
                ? isDarkMode
                  ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                  : 'bg-amber-500 text-white font-black shadow-lg shadow-amber-500/20'
                : isDarkMode
                  ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                  : 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Input Forms (Colspan 3 or 4) */}
        <div className="xl:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* 1. STUDY PLANNER */}
            {activeTab === 'planner' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Calendar className={`w-5 h-5 ${goldText}`} /> Create AI Timetable
                </h3>
                
                <form onSubmit={handleCreatePlan} className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end mb-8">
                  <div className="md:col-span-2">
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Subjects / Topics (Comma Separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. JavaScript Closures, Database Joins, Calculus derivatives"
                      value={subjects}
                      onChange={(e) => setSubjects(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Exam Date</label>
                    <input 
                      type="date" 
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Daily Available Hours</label>
                    <select
                      value={dailyHours}
                      onChange={(e) => setDailyHours(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    >
                      <option value="1">1 hour / day</option>
                      <option value="2">2 hours / day</option>
                      <option value="3">3 hours / day</option>
                      <option value="4">4+ hours / day</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center justify-center gap-2`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Custom Timetable'}
                    </button>
                  </div>
                </form>

                {currentPlan && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-4 border-white/10">
                      <div>
                        <h4 className="text-base font-bold text-amber-500">Weekly Study Timetable</h4>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Exam Date: {new Date(currentPlan.examDate).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {Array.isArray(currentPlan.timetable) && currentPlan.timetable.map((dayPlan, idx) => (
                        <div 
                          key={idx} 
                          className={`p-5 rounded-3xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
                            isDarkMode ? 'bg-[#1E293B]/50 border-white/5' : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${goldBg} ${goldText}`}>{dayPlan.day}</span>
                            <h5 className="text-sm font-bold mt-1.5">{dayPlan.focus}</h5>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {dayPlan.activities.map((act, actIdx) => (
                                <span 
                                  key={actIdx} 
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${
                                    isDarkMode ? 'bg-slate-900 border-white/5 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {act}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span>{dayPlan.hours} Hours</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 2. FLASHCARD GENERATOR */}
            {activeTab === 'flashcards' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Brain className={`w-5 h-5 ${goldText}`} /> Generate Flashcards
                </h3>
                
                <form onSubmit={handleCreateFlashcards} className="space-y-4 mb-8">
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Deck Name (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. JavaScript Closures, TOEFL Idioms"
                      value={cardDeckTitle}
                      onChange={(e) => setCardDeckTitle(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lecture Notes / Concept Details</label>
                    <textarea 
                      rows={6}
                      placeholder="Paste your raw notes, chapter details, or lecture definitions here..."
                      value={cardNotes}
                      onChange={(e) => setCardNotes(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Revision Cards'}
                  </button>
                </form>

                {currentDeck && Array.isArray(currentDeck.cards) && currentDeck.cards.length > 0 && (
                  <div className="flex flex-col items-center gap-6 py-4">
                    <div className="flex justify-between items-center w-full max-w-md border-b pb-3 border-white/10 mb-4">
                      <h4 className="font-bold text-sm text-amber-500">{currentDeck.title}</h4>
                      <span className="text-xs font-semibold text-slate-400">{activeCardIndex + 1} / {currentDeck.cards.length} Cards</span>
                    </div>

                    {/* Flippable Card Container */}
                    <div 
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="w-full max-w-md h-64 cursor-pointer relative perspective"
                    >
                      <motion.div
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.4 }}
                        className={`w-full h-full rounded-[2rem] border p-6 flex flex-col justify-center items-center text-center relative preserve-3d shadow-xl ${
                          isDarkMode ? 'bg-[#121A2F] border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Front Side */}
                        <div className={`absolute inset-0 p-8 flex flex-col justify-center items-center backface-hidden ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider mb-4 ${goldText}`}>Question</span>
                          <p className="text-base font-bold leading-relaxed">{currentDeck.cards[activeCardIndex].question}</p>
                          <span className="text-[10px] text-slate-500 mt-6 flex items-center gap-1.5">
                            <RotateCw className="w-3.5 h-3.5 animate-pulse" /> Click card to flip
                          </span>
                        </div>

                        {/* Back Side */}
                        <div 
                          className={`absolute inset-0 p-8 flex flex-col justify-center items-center backface-hidden rotate-y-180 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-4">Correct Answer</span>
                          <p className="text-sm font-semibold leading-relaxed text-slate-300">{currentDeck.cards[activeCardIndex].answer}</p>
                          <span className="text-[10px] text-slate-500 mt-6 flex items-center gap-1.5">
                            <RotateCw className="w-3.5 h-3.5" /> Click card to flip back
                          </span>
                        </div>
                      </motion.div>
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4 items-center mt-4">
                      <button
                        onClick={() => {
                          setIsFlipped(false);
                          setActiveCardIndex(prev => Math.max(0, prev - 1));
                        }}
                        disabled={activeCardIndex === 0}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          activeCardIndex === 0 
                            ? 'opacity-40 cursor-not-allowed text-slate-500 border-white/5' 
                            : isDarkMode ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => {
                          setLearnedCount(prev => prev + 1);
                          toast.success('Marked as learned! 🎯');
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        Got It ✅
                      </button>
                      <button
                        onClick={() => {
                          setIsFlipped(false);
                          setActiveCardIndex(prev => Math.min(currentDeck.cards.length - 1, prev + 1));
                        }}
                        disabled={activeCardIndex + 1 === currentDeck.cards.length}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          activeCardIndex + 1 === currentDeck.cards.length
                            ? 'opacity-40 cursor-not-allowed text-slate-500 border-white/5'
                            : isDarkMode ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Next
                      </button>
                    </div>

                    <div className="text-xs text-slate-400 font-semibold mt-2">
                      Recall Accuracy: {Math.round((learnedCount / (activeCardIndex + 1)) * 100) || 0}% Accuracy ({learnedCount} cards memorized)
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. QUIZ GENERATOR */}
            {activeTab === 'quiz' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <HelpCircle className={`w-5 h-5 ${goldText}`} /> Generate Evaluation Quiz
                </h3>

                {!generatedQuiz ? (
                  <form onSubmit={handleGenerateQuiz} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Difficulty Level</label>
                        <select
                          value={quizDifficulty}
                          onChange={(e) => setQuizDifficulty(e.target.value)}
                          className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                        >
                          <option value="Beginner">Beginner Level</option>
                          <option value="Intermediate">Intermediate Level</option>
                          <option value="Advanced">Advanced Level</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Notes / Textbook Material</label>
                      <textarea 
                        rows={6}
                        placeholder="Paste lecture notes or paragraphs to build evaluation questions..."
                        value={quizNotes}
                        onChange={(e) => setQuizNotes(e.target.value)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Compile Custom Quiz'}
                    </button>
                  </form>
                ) : !quizSubmitted ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-4 border-white/10">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${goldBg} ${goldText}`}>
                        Question {currentQuestionIdx + 1} of {generatedQuiz.length}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">Score: {quizScore}</span>
                    </div>

                    <h4 className="text-base font-bold leading-relaxed">{generatedQuiz[currentQuestionIdx].question}</h4>

                    {generatedQuiz[currentQuestionIdx].type === 'short_answer' ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={shortAnswerText}
                          onChange={(e) => setShortAnswerText(e.target.value)}
                          placeholder="Type your answer here..."
                          disabled={selectedQuizAnswer !== null}
                          className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                        />
                        {!selectedQuizAnswer && (
                          <button
                            onClick={handleShortAnswerSubmit}
                            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${goldBtn}`}
                          >
                            Submit Answer
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 pt-2">
                        {generatedQuiz[currentQuestionIdx].options.map((option, idx) => {
                          const isSelected = selectedQuizAnswer === option;
                          const isCorrect = option === generatedQuiz[currentQuestionIdx].correctAnswer;
                          const hasAnswered = selectedQuizAnswer !== null;

                          let optionStyle = isDarkMode 
                            ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-slate-200' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700';

                          if (hasAnswered) {
                            if (isSelected) {
                              optionStyle = isCorrect 
                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                                : 'bg-rose-500/10 border-rose-500 text-rose-400';
                            } else if (isCorrect) {
                              optionStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-400';
                            } else {
                              optionStyle = 'opacity-50 cursor-not-allowed';
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => handleQuizAnswerSubmit(option)}
                              disabled={hasAnswered}
                              className={`w-full p-4 rounded-2xl border text-sm font-bold text-left transition-all ${optionStyle}`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedQuizAnswer !== null && (
                      <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 animate-in fade-in duration-200 ${
                        selectedQuizAnswer === generatedQuiz[currentQuestionIdx].correctAnswer
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5">
                          {(() => {
                            const currentQ = generatedQuiz[currentQuestionIdx];
                            const isCorrect = currentQ.type === 'short_answer'
                              ? (currentQ.acceptableAnswers || []).some((answer) => answer.toLowerCase() === String(selectedQuizAnswer || '').trim().toLowerCase())
                              : selectedQuizAnswer === currentQ.correctAnswer;
                            return isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;
                          })()}
                          {(() => {
                            const currentQ = generatedQuiz[currentQuestionIdx];
                            const isCorrect = currentQ.type === 'short_answer'
                              ? (currentQ.acceptableAnswers || []).some((answer) => answer.toLowerCase() === String(selectedQuizAnswer || '').trim().toLowerCase())
                              : selectedQuizAnswer === currentQ.correctAnswer;
                            return isCorrect ? 'Correct!' : 'Incorrect Answer.';
                          })()}
                        </div>
                        <p>{generatedQuiz[currentQuestionIdx].explanation}</p>
                      </div>
                    )}

                    {selectedQuizAnswer !== null && (
                      <button
                        onClick={handleNextQuizQuestion}
                        className={`mt-4 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md float-right ${goldBtn}`}
                      >
                        {currentQuestionIdx + 1 === generatedQuiz.length ? 'Submit Quiz' : 'Next Question'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-6">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>

                    <div>
                      <h4 className="text-xl font-bold">Quiz Completed!</h4>
                      <p className={`text-sm mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>You scored {quizScore} out of {generatedQuiz.length} questions correctly.</p>
                    </div>

                    <div className="text-3xl font-black text-amber-500">
                      {Math.round((quizScore / generatedQuiz.length) * 100)}%
                    </div>

                    {/* Answer Review Checklist */}
                    <div className="text-left max-w-lg mx-auto border-t border-white/10 pt-6 space-y-4">
                      <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Review Questions</h5>
                      {quizAnswersRecord.map((record, rIdx) => (
                        <div key={rIdx} className={`p-4 rounded-2xl border text-xs ${record.isCorrect ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
                          <p className="font-bold text-slate-200">{record.question}</p>
                          <div className="flex justify-between items-center mt-2 font-medium">
                            <span className={record.isCorrect ? 'text-emerald-400' : 'text-rose-450'}>Your choice: {record.selected}</span>
                            {!record.isCorrect && <span className="text-emerald-400">Correct: {record.correct}</span>}
                          </div>
                          <p className={`mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{record.explanation}</p>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setGeneratedQuiz(null)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${goldBtn}`}
                    >
                      Take Another Quiz
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* 4. SUMMARIZER */}
            {activeTab === 'summary' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <BookOpen className={`w-5 h-5 ${goldText}`} /> AI Notes Summarizer
                </h3>

                <form onSubmit={handleSummarize} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Summary Template Format</label>
                      <select
                        value={summarizeFormat}
                        onChange={(e) => setSummarizeFormat(e.target.value)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                      >
                        <option value="bullet_points">Bullet Point Takeaways</option>
                        <option value="study_guide">Comprehensive Study Guide</option>
                        <option value="mind_map">Hierarchical Mind Map Nodes</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lecture / Notes Details</label>
                    <textarea 
                      rows={6}
                      placeholder="Paste your long notes, transcripts, or textbook chapters here..."
                      value={summarizeText}
                      onChange={(e) => setSummarizeText(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Compile Notes Summary'}
                  </button>
                </form>

                {generatedSummary && (
                  <div className={`p-6 md:p-8 rounded-[2rem] border relative overflow-hidden ${
                    isDarkMode ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-100 shadow-inner'
                  }`}>
                    <div className="flex justify-between items-center border-b pb-3 border-white/10 mb-4">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1"><Sparkle className="w-4 h-4" /> Compiled Summary</span>
                      <button 
                        onClick={handleExportSummary}
                        className={`p-2 rounded-xl text-[10px] font-bold uppercase border transition-colors flex items-center gap-1.5 ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" /> Export Markdown
                      </button>
                    </div>
                    <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Markdown
                        options={{
                          overrides: {
                            h1: { component: 'h1', props: { className: 'text-xl font-bold my-4 text-amber-500' } },
                            h2: { component: 'h2', props: { className: 'text-base font-bold my-3 text-amber-500' } },
                            h3: { component: 'h3', props: { className: 'text-sm font-bold my-2 text-amber-500' } },
                            p: { component: 'p', props: { className: 'mb-3' } },
                            ul: { component: 'ul', props: { className: 'list-disc pl-5 mb-3 space-y-1' } },
                            li: { component: 'li', props: { className: 'my-0.5' } }
                          }
                        }}
                      >
                        {generatedSummary}
                      </Markdown>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 5. ADAPTIVE WEAKNESS COACH */}
            {activeTab === 'adaptive' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Target className={`w-5 h-5 ${goldText}`} /> AI Adaptive Weakness Coach
                    </h3>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Generate dynamic, high-yield practice challenges tailored directly to bridge your conceptual gaps.
                    </p>
                  </div>
                </div>

                {/* Focus Topic Quick Selector */}
                {profileWeaknesses.length > 0 && (
                  <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-2">
                      Detected Focus Areas from Your Profile:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {profileWeaknesses.map((w, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleGenerateAdaptivePractice(w)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 transition-all flex items-center gap-1.5"
                        >
                          <Zap className="w-3 h-3" /> Practice {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Topic Input */}
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <input
                    type="text"
                    placeholder="Or enter any concept (e.g. Asynchronous JavaScript, Bayes Theorem)..."
                    value={practiceTopic}
                    onChange={(e) => setPracticeTopic(e.target.value)}
                    className={`flex-1 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateAdaptivePractice()}
                    disabled={isLoading}
                    className={`px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center justify-center gap-2 shrink-0`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Challenge'}
                  </button>
                </div>

                {/* Practice Questions Container */}
                {practiceQuestions.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <span className="text-sm font-bold text-cyan-400">
                        Topic: {practiceTopic || 'Target Practice'} ({practiceQuestions.length} Questions)
                      </span>
                      {practiceSubmitted && (
                        <span className={`text-sm font-black px-3 py-1 rounded-full border ${practiceScore >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          Score: {practiceScore}%
                        </span>
                      )}
                    </div>

                    {practiceQuestions.map((q, qIndex) => {
                      const selected = selectedPracticeAnswers[qIndex];
                      const isCorrect = selected === q.answer;

                      return (
                        <div key={qIndex} className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="font-bold text-sm mb-4">
                            <span className="text-amber-400 mr-2">Q{qIndex + 1}.</span> {q.question}
                          </p>

                          <div className="space-y-2">
                            {(q.options || []).map((opt, optIndex) => {
                              const isOptionSelected = selected === opt;
                              let optStyle = isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-100';

                              if (practiceSubmitted) {
                                if (opt === q.answer) {
                                  optStyle = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-bold';
                                } else if (isOptionSelected && !isCorrect) {
                                  optStyle = 'bg-rose-500/20 border-rose-500/50 text-rose-400 font-bold';
                                }
                              } else if (isOptionSelected) {
                                optStyle = 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold';
                              }

                              return (
                                <button
                                  key={optIndex}
                                  type="button"
                                  disabled={practiceSubmitted}
                                  onClick={() => handleSelectPracticeAnswer(qIndex, opt)}
                                  className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${optStyle}`}
                                >
                                  <span>{opt}</span>
                                  {practiceSubmitted && opt === q.answer && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>

                          {practiceSubmitted && q.explanation && (
                            <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
                              <span className="font-bold">Explanation:</span> {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!practiceSubmitted ? (
                      <button
                        type="button"
                        onClick={handleSubmitPractice}
                        className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn}`}
                      >
                        Submit Practice Challenge
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateAdaptivePractice()}
                        className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all bg-cyan-500 hover:bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
                      >
                        Try Another Challenge Set
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Right Sidebar - Study Plans Directory */}
        <div className="space-y-6">
          
          {/* Saved Timetables */}
          {activeTab === 'planner' && (
            <div className={`p-6 rounded-[2rem] border ${baseCardStyle}`}>
              <h4 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-amber-500">
                <Calendar className="w-4 h-4" /> Saved Timetables
              </h4>
              <div className="space-y-3">
                {savedPlans.length === 0 ? (
                  <p className="text-xs italic text-slate-500">No study plans saved yet.</p>
                ) : (
                  savedPlans.map(plan => (
                    <div 
                      key={plan.id}
                      onClick={() => setCurrentPlan(plan)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        currentPlan?.id === plan.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : isDarkMode ? 'bg-slate-800/30 border-white/5 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold truncate">{plan.subjects.join(', ')}</span>
                        <button 
                          onClick={(e) => handleDeletePlan(plan.id, e)}
                          className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2 font-medium">Exam Date: {new Date(plan.examDate).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Saved Flashcard Decks */}
          {activeTab === 'flashcards' && (
            <div className={`p-6 rounded-[2rem] border ${baseCardStyle}`}>
              <h4 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-amber-500">
                <Brain className="w-4 h-4" /> Card Decks
              </h4>
              <div className="space-y-3">
                {savedDecks.length === 0 ? (
                  <p className="text-xs italic text-slate-500">No flashcards generated yet.</p>
                ) : (
                  savedDecks.map(deck => (
                    <div 
                      key={deck.id}
                      onClick={() => {
                        setCurrentDeck(deck);
                        setActiveCardIndex(0);
                        setIsFlipped(false);
                        setLearnedCount(0);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        currentDeck?.id === deck.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                          : isDarkMode ? 'bg-slate-800/30 border-white/5 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold truncate">{deck.title}</span>
                        <button 
                          onClick={(e) => handleDeleteDeck(deck.id, e)}
                          className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2 font-medium">{Array.isArray(deck.cards) ? deck.cards.length : 0} Cards</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Adaptive Weakness Remediation Sidebar */}
          {activeTab === 'adaptive' && (
            <div className={`p-6 rounded-[2rem] border ${baseCardStyle}`}>
              <h4 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-amber-500">
                <Target className="w-4 h-4" /> Focus Topologies
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                Click any topic below to dynamically trigger an AI practice challenge tailored to your skill gaps.
              </p>
              <div className="space-y-2">
                {(profileWeaknesses.length > 0 ? profileWeaknesses : ['Algorithm Complexity', 'State Management', 'Database Indexing']).map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleGenerateAdaptivePractice(topic)}
                    className="w-full text-left p-3 rounded-xl border text-xs font-bold transition-all bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400 flex items-center justify-between"
                  >
                    <span>{topic}</span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Recall Tip Card */}
          <div className={`p-6 rounded-[2rem] border relative overflow-hidden ${isDarkMode ? 'bg-[#1e293b]/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <h5 className="font-bold text-xs uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1">
              <Sparkle className="w-3.5 h-3.5" /> Active Recall Tip
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
              Research proves that testing yourself (quizzes/flashcards) works 3x better than just re-reading notes. Generate a quick quiz after every lesson to lock it in long-term memory!
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
