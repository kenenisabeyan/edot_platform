import React, { useState, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, Award, RefreshCcw } from 'lucide-react';
import ThemeDropdown from '../components/ThemeDropdown';
import api from '../utils/api';
import { recordQuizAttempt } from '../services/intelligenceApi.js';

export default function QuizViewer() {
  const isDarkMode = useThemeMode();
  const { id } = useParams(); // Should be courseId for Final Exam
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [passedScore, setPassedScore] = useState(false);
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const { data } = await api.get(`/courses/${id}`);
        setCourse(data.course);
      } catch {
        setError('Failed to load course details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [id]);

  const handleSelectOption = (optionIndex) => {
    if (showResults) return;
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: optionIndex });
  };

  const handleNext = () => {
    if (currentQuestion < (course?.finalExam?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateScorePercentage = () => {
    let score = 0;
    const questions = course?.finalExam || [];
    questions.forEach((q, index) => {
      const correct = q.correctAnswer !== undefined ? q.correctAnswer : q.correctOption;
      if (selectedAnswers[index] === correct) {
        score++;
      }
    });
    return questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const scoreVal = calculateScorePercentage();
    setFinalScore(scoreVal);
    
    // Log each question attempt to the Intelligence Core asynchronously
    const questions = course?.finalExam || [];
    questions.forEach((q, index) => {
      const correct = q.correctAnswer !== undefined ? q.correctAnswer : q.correctOption;
      const isCorrect = selectedAnswers[index] === correct;
      const selected = selectedAnswers[index] !== undefined ? String(selectedAnswers[index]) : '';
      const correctVal = correct !== undefined ? String(correct) : '';
      
      recordQuizAttempt({
        courseId: id,
        questionIndex: index,
        question: q.question || `Question ${index + 1}`,
        selectedAnswer: selected,
        correctAnswer: correctVal,
        isCorrect,
        topic: q.topic || course?.mainCategory || 'General',
        timeSpentSeconds: 0
      }).catch(() => {});
    });

    try {
      await api.post(`/student/courses/${id}/exam/complete`, { score: scoreVal });
      setPassedScore(true); // Since it didn't throw an error, it passed >= 75%
    } catch {
      setPassedScore(false);
    } finally {
      setSubmitting(false);
      setShowResults(true);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
  };


  if (loading) {
    return (
      <div className={`min-h-screen flex justify-center items-center ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}>
        <div className={`w-16 h-16 border-4 border-t-[#FFC107] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
      </div>
    );
  }

  if (error || !course || !course.finalExam || course.finalExam.length === 0) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center p-4 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`}>
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">No Final Exam Available</h2>
        <p className="opacity-70 mt-2 mb-6">This course does not have a final challenge assessment set up.</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-slate-700 rounded-lg">Go Back</button>
      </div>
    );
  }

  if (showResults) {
    const score = finalScore;
    const passed = passedScore;

    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}>
        <div className={`backdrop-blur-2xl rounded-3xl shadow-2xl border p-8 sm:p-12 max-w-lg w-full text-center animate-in zoom-in-95 duration-300 relative overflow-hidden ${isDarkMode ? 'bg-[#0B1120]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
          <div className={`absolute inset-0 opacity-10 pointer-events-none ${passed ? 'bg-[#00D4FF]' : 'bg-[#E30A17]'}`}></div>
          
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 relative z-10 ${passed ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#E30A17]/20 text-[#E30A17]'} ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            {passed ? <Award className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
          </div>
          
          <h2 className={`text-3xl font-display font-black mb-2 relative z-10 drop-shadow-md ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h2>
          <p className={`mb-8 font-medium relative z-10 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>You scored <span className={`font-black  ${passed ? 'text-[#00D4FF]' : 'text-[#E30A17]'}`}>{score}%</span> on the Final Challenge.</p>
          
          <div className="space-y-4 relative z-10">
            <div className={`flex justify-between items-center p-5 backdrop-blur-md rounded-2xl border ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Passing Requirement</span>
              <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>75%</span>
            </div>
            <div className={`flex justify-between items-center p-5 backdrop-blur-md rounded-2xl border mb-8 ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Your Score</span>
              <span className={`font-black text-xl shadow-sm ${passed ? 'text-[#00D4FF]' : 'text-[#E30A17]'}`}>{score}%</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-8 relative z-10">
            {!passed && (
              <button 
                onClick={handleRetake}
                className={`flex-1 px-6 py-4 border font-semibold rounded-full hover: transition-colors flex items-center justify-center gap-2 bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border-[#00D4FF] text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              >
                <RefreshCcw className="w-4 h-4" /> Try Again
              </button>
            )}
            <button 
              onClick={() => navigate(`/lesson/${course.id}?courseId=${course.id}`)}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-[#00D4FF] to-[#00D4FF] text-[#0B1120] font-black rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,215,0,0.3)] inline-flex items-center justify-center gap-2 text-sm group"
            >
              {passed ? 'Claim Certificate' : 'Go Back'}
              <span className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-900 ml-1.5 transition-colors">
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questions = course?.finalExam || [];
  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const isAnswered = selectedAnswers[currentQuestion] !== undefined;
  
  const allAnswered = questions.length === Object.keys(selectedAnswers).length;

  return (
    <div className={`min-h-screen flex flex-col items-center py-8 px-4 sm:px-6 relative overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-[#FAFAFA]'}`}>
      
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#00D4FF]/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Header */}
      <div className="w-full max-w-3xl mb-8 flex justify-between items-center relative z-10">
        <button 
          onClick={() => navigate(`/lesson/${course.id}?courseId=${course.id}`)}
          className={`flex items-center justify-center min-w-[140px] gap-2 font-bold transition-colors px-8 py-2.5 rounded-full border shadow-md text-white bg-[#1e48bc] hover:bg-[#295ce8] border-transparent`}
        >
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="flex items-center gap-4">
          <span className="font-bold text-[#00D4FF] bg-[#00D4FF]/10 px-4 py-2 rounded-lg border border-[#00D4FF]/20 shadow-[0_0_15px_rgba(255,215,0,0.1)] text-xs">
            {course?.title} - Final Challenge
          </span>
          <ThemeDropdown />
        </div>
      </div>

      <div className={`w-full max-w-3xl backdrop-blur-xl rounded-3xl shadow-2xl border overflow-hidden relative z-10 ${isDarkMode ? 'bg-[#0B1120]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
        
        {/* Progress Bar */}
        <div className={`p-6 md:px-12 border-b ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex justify-between text-xs font-bold mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span className="text-[#00D4FF]">{Math.round(progress)}% Complete</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden border ${isDarkMode ? 'bg-[#0B1120]/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <div 
              className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00D4FF] shadow-[0_0_10px_rgba(255,215,0,0.5)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question Area */}
        <div className="p-8 sm:p-12 relative">
          <div className="absolute inset-0 bg-[#00D4FF]/5 opacity-20 pointer-events-none blur-3xl"></div>
          
          <h2 className={`text-2xl sm:text-3xl font-display font-bold leading-snug mb-10 relative z-10 drop-shadow-md ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {question?.text || question?.question} {/* Handling both formats strictly */}
          </h2>
          
          <div className="space-y-4 relative z-10">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswers[currentQuestion] === index;
              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(index)}
                  className={`w-full text-left flex items-center p-5 rounded-xl border-2 transition-all ${
                    isSelected 
                      ? 'border-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_15px_rgba(255,215,0,0.15)]' 
                      : (isDarkMode ? 'border-white/5 hover:border-white/20 hover:bg-white/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100')
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'border-[#00D4FF]' : (isDarkMode ? 'border-white/20' : 'border-slate-300')
                  }`}>
                    {isSelected && <div className="w-3 h-3 rounded-full bg-[#00D4FF] shadow-[0_0_5px_rgba(255,215,0,0.8)]"></div>}
                  </div>
                  <span className={`text-lg font-bold ${isSelected ? 'text-[#00D4FF]' : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className={`p-6 md:px-12 border-t flex gap-4 justify-between items-center ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
          <button
            onClick={handlePrev}
            disabled={currentQuestion === 0}
            className={`px-6 py-3.5 font-medium text-sm hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-white/10 rounded-full ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}
          >
            Previous
          </button>
          
          {!isLastQuestion ? (
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className={`px-8 py-3.5 font-semibold rounded-full hover: transition-all flex items-center gap-2 border disabled:opacity-30 disabled:cursor-not-allowed bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border-[#00D4FF] text-sm group ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              Next
              <span className={`flex items-center justify-center w-6 h-6 rounded-full border ml-1.5 transition-colors ${isDarkMode ? 'border-white' : 'border-slate-900'}`}>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className={`px-8 py-3.5 ] font-semibold rounded-full hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              {submitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} 
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
        
      </div>
    </div>
  );
}
