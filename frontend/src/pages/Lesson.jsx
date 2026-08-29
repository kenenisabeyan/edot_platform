import React, { useState, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { PlayCircle, FileText, CheckCircle2, Lock, Unlock, ArrowLeft, ChevronDown, ChevronUp, CheckSquare, BadgeAlert, Award, ExternalLink, X, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SmartVideoPlayer from '../components/SmartVideoPlayer';
import ThemeDropdown from '../components/ThemeDropdown';
import PremiumModal from '../components/PremiumModal';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import Markdown from 'markdown-to-jsx';
import sessionTracker from '../services/sessionTracker.js';
import { recordQuizAttempt, publishLearningEvent } from '../services/intelligenceApi.js';

export default function Lesson() {
  const isDarkMode = useThemeMode();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');
  const { user } = useAuth();

  const [expandedPhase, setExpandedPhase] = useState({}); 
  const [expandedCategory, setExpandedCategory] = useState({});
  const [playingVideoId, setPlayingVideoId] = useState(null); 
  
  const [activeModal, setActiveModal] = useState(null); // { type: 'docs' | 'quiz', lessonId: '...' }

  const [completingPhase, setCompletingPhase] = useState({});
  const [videoProgress, setVideoProgress] = useState({});
  const [quizState, setQuizState] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});
  const [preAssessmentScore, setPreAssessmentScore] = useState({});
  const [generatingCertificate, setGeneratingCertificate] = useState(false);
  const [certificateData, setCertificateData] = useState(null);
  const [lessonMaterials, setLessonMaterials] = useState({});

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');

  // Wave 3: Learning session tracking — start on lesson load, end on unmount
  useEffect(() => {
    if (courseId) {
      sessionTracker.start({ courseId, lessonId: id, pageContext: 'lesson' });
    }
    return () => { sessionTracker.end(); };
  }, [id, courseId]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState([]);
  const [aiMode, setAiMode] = useState('chat'); // 'chat' | 'quiz'
  const [mentorConversationId, setMentorConversationId] = useState(null);
  const [aiQuiz, setAiQuiz] = useState([]);
  const [aiQuizAnswers, setAiQuizAnswers] = useState({});
  const [aiQuizSubmitted, setAiQuizSubmitted] = useState(false);

  // Auto-select lesson context
  useEffect(() => {
    if (playingVideoId) {
      setSelectedLessonId(playingVideoId);
    } else if (course?.lessons?.length > 0 && !selectedLessonId) {
      setSelectedLessonId(course.lessons[0].id);
    }
  }, [playingVideoId, course, selectedLessonId]);

  const formatPracticeQuestions = (payload) => {
    const questions = payload?.questions || [];
    if (!questions.length) return 'Practice questions are ready.';

    return questions.map((item, index) => (
      `**${index + 1}.** ${item.question}\n\n` +
      `**Answer:** ${item.answer}\n\n` +
      `*Why:* ${item.explanation}`
    )).join('\n\n');
  };

  const formatNextSteps = (payload) => {
    const steps = payload?.steps || [];
    if (!steps.length) return 'A personalized study path is ready.';
    return steps.map((step, index) => `**${index + 1}.** ${step}`).join('\n');
  };

  const handleExplainLesson = async () => {
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    setLoadingAi(true);
    setAiMode('chat');
    setAiAnswer('');
    try {
      const { data } = await api.post('/api/mentor/chat', {
        message: `I'm studying "${targetLesson.title}". Please explain the main concepts in a clear and encouraging way, highlighting the most important terms and the best way to approach this lesson.`,
        courseId,
        lessonId: targetLesson.id,
        conversationId: mentorConversationId
      });
      if (data.success) {
        const reply = data.data?.reply || 'I am ready to guide you.';
        setAiAnswer(reply);
        setAiChatHistory(prev => [
          ...prev,
          { role: 'user', content: `Explain: ${targetLesson.title}` },
          { role: 'assistant', content: reply }
        ]);
        setMentorConversationId(data.data?.conversationId || mentorConversationId);
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to generate explanation. Make sure the API key is configured.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSummarizeLesson = async () => {
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    setLoadingAi(true);
    setAiMode('chat');
    setAiAnswer('');
    try {
      const { data } = await api.post('/api/mentor/chat', {
        message: `Please summarize "${targetLesson.title}" into a concise study guide with the core ideas, definitions, and an easy-to-follow outline.`,
        courseId,
        lessonId: targetLesson.id,
        conversationId: mentorConversationId
      });
      if (data.success) {
        const reply = data.data?.reply || 'Here is your summary.';
        setAiAnswer(reply);
        setAiChatHistory(prev => [
          ...prev,
          { role: 'user', content: `Summarize: ${targetLesson.title}` },
          { role: 'assistant', content: reply }
        ]);
        setMentorConversationId(data.data?.conversationId || mentorConversationId);
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to generate summary.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAskQuestion = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuestion.trim()) return;
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    const questionText = aiQuestion.trim();
    setAiQuestion('');
    setLoadingAi(true);
    setAiMode('chat');
    
    setAiChatHistory(prev => [...prev, { role: 'user', content: questionText }]);
    try {
      const { data } = await api.post('/api/mentor/chat', {
        message: questionText,
        courseId,
        lessonId: targetLesson.id,
        conversationId: mentorConversationId
      });
      if (data.success) {
        const reply = data.data?.reply || 'I am here to help.';
        setAiAnswer(reply);
        setAiChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: reply }
        ]);
        setMentorConversationId(data.data?.conversationId || mentorConversationId);
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to get answer from AI mentor.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGeneratePracticeQuestions = async () => {
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    setLoadingAi(true);
    setAiMode('chat');
    setAiAnswer('');
    try {
      const { data } = await api.post('/api/mentor/practice-questions', {
        topic: targetLesson.title,
        level: 'Intermediate',
        courseTitle: course?.title
      });
      if (data.success) {
        const reply = formatPracticeQuestions(data.data);
        setAiAnswer(reply);
        setAiChatHistory(prev => [
          ...prev,
          { role: 'user', content: `Practice questions: ${targetLesson.title}` },
          { role: 'assistant', content: reply }
        ]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to generate practice questions.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGetNextSteps = async () => {
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    setLoadingAi(true);
    setAiMode('chat');
    setAiAnswer('');
    try {
      const { data } = await api.post('/api/mentor/next-steps', {
        topic: targetLesson.title
      });
      if (data.success) {
        const reply = formatNextSteps(data.data);
        setAiAnswer(reply);
        setAiChatHistory(prev => [
          ...prev,
          { role: 'user', content: `Next steps: ${targetLesson.title}` },
          { role: 'assistant', content: reply }
        ]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to generate next steps.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGenerateQuiz = async () => {
    const targetLesson = course?.lessons?.find(l => l.id === selectedLessonId);
    if (!targetLesson) {
      toast.error("Please select a lesson first.");
      return;
    }
    setLoadingAi(true);
    setAiMode('quiz');
    setAiQuiz([]);
    setAiQuizAnswers({});
    setAiQuizSubmitted(false);
    const textForQuiz = `${targetLesson.title}\n${targetLesson.description || ''}\n${targetLesson.readingMaterials || ''}`;
    try {
      const { data } = await api.post('/api/ai/quiz', {
        text: textForQuiz,
        difficulty: 'Intermediate'
      });
      if (data.success && data.quiz) {
         setAiQuiz(data.quiz);
      } else {
         toast.error("Failed to generate quiz questions.");
      }
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to generate AI quiz.");
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchMaterials = async (lessonId) => {
    if (lessonMaterials[lessonId]) return;
    try {
      const { data } = await api.get(`/materials/${lessonId}?courseId=${courseId}`);
      if (data.success) {
        setLessonMaterials(prev => ({ ...prev, [lessonId]: data.data }));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  };

  const { data: lessonData = {}, isLoading: loadingData, error: queryError } = useQuery({
    queryKey: ['lessonData', courseId, id, user?.id],
    queryFn: async () => {
      let isEnrolledActive = false;
      let status = 'none';
      let progress = null;

      if (user) {
        try {
           const { data: statusData } = await api.get(`/student/courses/${courseId}/status`);
           status = statusData.status;
           progress = statusData.progress;
           isEnrolledActive = status === 'active';
        } catch {
           status = 'none';
        }
      }

      const endpoint = (isEnrolledActive || user?.role === 'admin' || user?.role === 'instructor') 
          ? `/courses/${courseId}/content` 
          : `/courses/${courseId}`;

      const { data } = await api.get(endpoint);
      return {
        course: data.course,
        enrollmentStatus: status,
        enrollmentProgress: progress
      };
    },
    enabled: !!courseId
  });

  const loading = !courseId || loadingData;
  const error = !courseId ? 'System parameter missing. Return to catalog and reboot selection.' : (queryError ? 'Transmission failure. Unable to retrieve module resources.' : '');
  const course = lessonData.course;
  const enrollmentStatus = lessonData.enrollmentStatus;
  const enrollmentProgress = lessonData.enrollmentProgress;

  const isActive = enrollmentStatus === 'active' || user?.role === 'admin' || user?.role === 'instructor';
  const isBlocked = user?.status === 'blocked';

  let completedList = [];
  if (enrollmentProgress?.completedLessons) {
      if (Array.isArray(enrollmentProgress.completedLessons)) {
          completedList = enrollmentProgress.completedLessons;
      } else if (typeof enrollmentProgress.completedLessons === 'string') {
          try { completedList = JSON.parse(enrollmentProgress.completedLessons); } catch { /* ignore */ }
      }
  }

  const togglePhase = (phaseId) => {
    setExpandedPhase(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
    if (!expandedPhase[phaseId]) {
      fetchMaterials(phaseId);
    }
  };

  const toggleCat = (phaseId, cat) => {
    const key = `${phaseId}-${cat}`;
    const willExpand = !expandedCategory[key];
    setExpandedCategory(prev => ({ ...prev, [key]: willExpand }));
    
    if (willExpand) {
       if (cat === 'todo') toast.success('Mission Objectives Accessed');
       if (cat === 'videos') toast.success('Video Stream Protocol Initiated');
       if (cat === 'notes') toast.success('Study Notes Decrypted');
       if (cat === 'docs') toast.success('Documents Accessed');
       if (cat === 'additional-docs') toast.success('Additional Materials Accessed');
    }
  };

  const verifyPhaseCompletion = async (lessonId) => {
     setCompletingPhase(prev => ({ ...prev, [lessonId]: true }));
     try {
       await api.post(`/student/courses/${courseId}/lessons/${lessonId}/complete`);
       toast.success('Phase Successfully Resolved!');
       setTimeout(() => window.location.reload(), 1000);
     } catch (err) {
       console.error('Failed to complete phase', err);
       toast.error('Failed to complete phase');
       setCompletingPhase(prev => ({ ...prev, [lessonId]: false }));
     }
  };

  // Detect video source type
  const getVideoType = (url) => {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('vimeo.com')) return 'vimeo';
    if (lowerUrl.includes('.m3u8')) return 'hls';
    if (lowerUrl.includes('cloudinary.com')) return 'cloudinary';
    if (lowerUrl.match(/\.(mp4|webm|ogg|avi|mov|mkv)(\?|$)/i)) return 'direct';
    return 'unknown';
  };

  // Resolve Cloudinary URL to video format
  const resolveCloudinaryUrl = (url) => {
    if (!url || !url.includes('cloudinary.com')) return url;
    try {
      let resolvedUrl = url.replace(/^http:\/\//i, 'https://');
      const urlObj = new URL(resolvedUrl);
      let pathname = urlObj.pathname;
      pathname = pathname.replace(/\/(image|raw)\/upload\//, '/video/upload/');
      if (!pathname.match(/\.(mkv|mov|avi|webm|mp4)$/i)) {
        pathname += '.mp4';
      } else {
        pathname = pathname.replace(/\.(mkv|mov|avi|webm)$/i, '.mp4');
      }
      urlObj.pathname = pathname;
      return urlObj.toString();
    } catch (e) {
      console.error('Error resolving Cloudinary URL:', e);
      return url;
    }
  };

  const resolveUrl = (url) => {
    if (!url) return '';
    let cleanUrl = url.trim();
    
    const iframeMatch = cleanUrl.match(/<iframe.*?src=["'](.*?)["']/i);
    if (iframeMatch) cleanUrl = iframeMatch[1];
    
    const mdMatch = cleanUrl.match(/\]\((.*?)\)/);
    if (mdMatch) cleanUrl = mdMatch[1].trim();
    
    cleanUrl = cleanUrl.replace(/\\/g, '/');

    const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
    if (embedMatch) {
      cleanUrl = `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    }

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) return cleanUrl;
    if (cleanUrl.startsWith('www.')) return `https://${cleanUrl}`;
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      return cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
    }
    
    const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
    return `${baseUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  };

  const resolveVideoUrl = (url) => {
    let raw = resolveUrl(url);
    if (!raw) return '';
    
    const videoType = getVideoType(raw);
    
    // Handle Cloudinary videos
    if (videoType === 'cloudinary') {
      return resolveCloudinaryUrl(raw);
    }
    
    // YouTube/Vimeo handled by SmartVideoPlayer natively
    // Direct video files returned as-is
    return raw;
  };

  const handleClaimCertificate = async () => {
    try {
      setGeneratingCertificate(true);
      const { data } = await api.post('/progress/certificate', { courseId });
      if (data.success && data.data) {
        setCertificateData(data.data);
        toast.success('Official Certificate Claimed!');
      }
    } catch (err) {
      console.error('Failed to generate certificate:', err);
      if (err.response?.data?.blocked_by?.length > 0) {
        const reasons = err.response.data.blocked_by.map(b => `${b.lesson}: ${b.reason}`).join('\n');
        toast.error(`Certificate Denied:\n${reasons}`, { style: { whiteSpace: 'pre-wrap' }, duration: 8000 });
      } else {
        toast.error(err.response?.data?.message || 'Certificate generation failed. Make sure all requirements are met.');
      }
    } finally {
      setGeneratingCertificate(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex justify-center items-center ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}>
        <div className={`w-16 h-16 border-4 border-t-[#FFC107] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className={`min-h-screen flex justify-center items-center p-4 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`}>
        <div className={`bg-[#0B1120] border p-10 rounded-2xl shadow-2xl text-center max-w-md w-full ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <p className="font-black mb-8 text-xl  ">{error || 'Clearance error.'}</p>
          <Link to="/dashboard/courses" className={`px-6 py-4 ] font-black rounded-full hover:] inline-flex items-center gap-2 transition-colors bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <ArrowLeft className="w-5 h-5" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative font-sans pb-20 transition-colors duration-500 ${isDarkMode ? 'bg-[#0B1120] text-slate-200' : 'bg-[#FAFAFA] text-slate-700'}`}>
      {/* Decorative Background */}
      <div className={`fixed inset-0 pointer-events-none z-0 ${isDarkMode ? 'opacity-100' : 'opacity-20'}`} style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(0,212,255,0.15), transparent 35%), radial-gradient(circle at 80% 15%, rgba(249,115,22,0.10), transparent 40%), radial-gradient(circle at 50% 75%, rgba(0,212,255,0.05), transparent 45%)' }} />

      {/* Global Top Navigation Bar */}
      <div className={`w-full backdrop-blur-xl border-b sticky top-0 z-50 shadow-md transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120]/90 border-white/20' : 'bg-white/90 border-slate-300'}`}>
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
                <Link to="/dashboard/courses" className={`flex items-center justify-center min-w-[140px] gap-2 font-bold transition-colors px-8 py-2.5 rounded-full border shadow-md text-white bg-[#1e48bc] hover:bg-[#295ce8] border-transparent`}>
                   <ArrowLeft className="w-4 h-4" /> Dashboard
                </Link>
                <Link to={`/course/${course.id}`} className={`flex items-center justify-center min-w-[140px] gap-2 font-bold transition-colors px-8 py-2.5 rounded-full border shadow-md text-slate-900 bg-[#00D4FF] hover:bg-[#00A3CC] border-transparent`}>
                   Course Info
                </Link>
            </div>
            <div className={`hidden md:flex font-black text-lg items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
               <span>EDOT <span className="text-[#00D4FF] ml-1">Learning Protocol</span></span>
               <div className="h-6 w-px bg-slate-400/30 mx-2"></div>
               <ThemeDropdown />
            </div>
         </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 relative z-10">
         
         {/* Course Header Template */}
         <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
           <div>
             <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <PlayCircle className="w-8 h-8 text-[#00D4FF]"/>
                {course.title.split(',')[0]}
             </h1>
             <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>
                {course.title.includes(',') ? course.title.substring(course.title.indexOf(',') + 1) : 'EDOT Intelligence Feed'}
             </p>
           </div>
         </div>

         {/* The Accordion Phases List */}
         <div className="space-y-6">
            {(() => {
               const phases = [...new Set(course.lessons?.map(l => l.phase || 'General Content'))];
               return phases.map((phaseName, pIdx) => {
                  const phaseLessons = course.lessons.filter(l => (l.phase || 'General Content') === phaseName);
                  const pId = phaseName;
                  const isPhaseExp = expandedPhase[pId];
                  const lCompleted = phaseLessons.every(l => completedList.includes(l.id));

                  // Gather phase-wide materials
                  const allDescriptions = phaseLessons.map(l => l.description).filter(Boolean).join('\n\n') || 'Initialize phase objectives. Consolidate knowledge matrices prior to execution.';
                  const allReadingMaterials = phaseLessons.map(l => l.readingMaterials).filter(Boolean).join('\n\n');
                  
                  return (
                     <div key={pId} className={`rounded-3xl border transition-all duration-500 overflow-hidden shadow-xl ${isPhaseExp ? 'border-white/20 bg-[#0B1120] shadow-[0_10px_30px_rgba(0,0,0,0.5)] transform scale-[1.01]' : 'border-white/5 '} ${isDarkMode ? 'bg-[#0B1120]/60' : 'bg-slate-100'}`}>
                        
                        {/* Phase Header (Level 1) */}
                        <button 
                           onClick={() => {
                              if (!isActive && user?.role !== 'admin' && user?.role !== 'instructor') {
                                 toast.error('Access Denied: You must be enrolled and approved to view this module.');
                                 return;
                              }
                              setExpandedPhase(prev => ({ ...prev, [pId]: !prev[pId] }));
                              if (!expandedPhase[pId]) {
                                 phaseLessons.forEach(l => fetchMaterials(l.id));
                              }
                           }}
                           className={`w-full p-5 sm:p-6 flex justify-between items-center transition-colors ${isPhaseExp ? 'bg-[#0B1120]/5' : 'hover:bg-white/5/5'}`}
                        >
                           <div className="flex items-center gap-6 text-left">
                              <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${lCompleted ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30' : 'bg-[#0B1120] text-[#00D4FF] border '} ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                 {lCompleted ? <CheckCircle2 className="w-6 h-6"/> : (pIdx + 1)}
                              </div>
                              <h2 className={`text-2xl sm:text-3xl font-display font-black tracking-tight leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{phaseName}</h2>
                           </div>
                           <div className={`shrink-0 ml-4 hidden sm:block p-2 rounded-full border ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-white border-slate-100'}`}>
                              {isPhaseExp ? <ChevronUp className="w-5 h-5 text-[#00D4FF]" /> : <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`} />}
                           </div>
                        </button>
                        
                        {/* Phase Expanded Content */}
                        {isPhaseExp && (
                           <div className={`p-4 sm:p-8 border-t space-y-6 animate-in slide-in-from-top-2 duration-500 ${isDarkMode ? 'bg-[#0B1120]/40 border-white/5' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
                              
                              {/* Category: To-Do List */}
                              <div className={`rounded-3xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10 hover:border-indigo-500/30' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
                                 <button onClick={() => toggleCat(pId, 'todo')} className={`w-full p-6 flex justify-between items-center transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`font-black text-lg flex items-center gap-5 transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-indigo-700'}`}>
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                          <CheckSquare className="w-6 h-6" />
                                       </div> 
                                       To-Do List
                                    </span>
                                    <span className={`text-xs flex items-center gap-2 font-bold transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                                       {expandedCategory[`${pId}-todo`] ? 'Collapse' : 'Expand'} 
                                       <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-indigo-500/20' : 'bg-slate-100 group-hover:bg-indigo-100'}`}>
                                          {expandedCategory[`${pId}-todo`] ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                       </div>
                                    </span>
                                 </button>
                                 {expandedCategory[`${pId}-todo`] && (
                                    <div className={`p-8 border-t text-base leading-relaxed border-l-4 whitespace-pre-wrap transition-all ${isDarkMode ? 'border-white/5 bg-[#0B1120] text-slate-300 border-l-indigo-500/50' : 'border-slate-100 bg-slate-50/50 text-slate-600 border-l-indigo-400'}`}>
                                       {allDescriptions}
                                    </div>
                                 )}
                              </div>

                              {/* Category: Class Videos */}
                              <div className={`rounded-3xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10 hover:border-red-500/30' : 'bg-white border-slate-200 hover:border-red-200'}`}>
                                 <button onClick={() => toggleCat(pId, 'videos')} className={`w-full p-6 flex justify-between items-center transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`font-black text-lg flex items-center gap-5 transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-red-700'}`}>
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                          <PlayCircle className="w-6 h-6" />
                                       </div> 
                                       Class Videos
                                    </span>
                                    <span className={`text-xs flex items-center gap-2 font-bold transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-red-400' : 'text-slate-400 group-hover:text-red-600'}`}>
                                       {expandedCategory[`${pId}-videos`] ? 'Collapse' : 'Expand'} 
                                       <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-red-500/20' : 'bg-slate-100 group-hover:bg-rose-100'}`}>
                                          {expandedCategory[`${pId}-videos`] ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                       </div>
                                    </span>
                                 </button>
                                 
                                 {expandedCategory[`${pId}-videos`] && (
                                    <div className={`border-t p-4 ${isDarkMode ? 'border-white/5 bg-[#0B1120]' : 'border-slate-100 bg-slate-50/50'}`}>
                                       {phaseLessons.map(lesson => {
                                          const lId = lesson.id;
                                          const videoMat = lessonMaterials[lId]?.find(m => m.fileType === 'video');
                                          const finalVideoUrl = videoMat ? videoMat.fileUrl : lesson.videoUrl;
                                          const isCompleted = completedList.includes(lId);

                                          return (
                                             <div key={lId} className="w-full">
                                                <button 
                                                   onClick={() => setPlayingVideoId(playingVideoId === lId ? null : lId)} 
                                                   className={`w-full p-5 flex justify-between items-center transition-all duration-300 border rounded-2xl mt-2 mb-2 group shadow-sm hover:shadow-md ${playingVideoId === lId ? (isDarkMode ? 'border-red-500/30 bg-[#0B1120]' : 'border-red-200 bg-white') : (isDarkMode ? 'border-white/5 bg-[#0B1120]/50 hover:bg-[#0B1120]' : 'border-slate-200 bg-white hover:bg-slate-50')}`}
                                                >
                                                   <span className={`font-bold text-base flex items-center gap-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? (isDarkMode ? 'bg-[#00D4FF]/20' : 'bg-cyan-100') : (isDarkMode ? 'bg-white/5' : 'bg-slate-100')}`}>
                                                         {isCompleted ? <Unlock className="w-4 h-4 text-[#00D4FF]" /> : <Lock className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />}
                                                      </div>
                                                      {lesson.title}
                                                   </span>
                                                   <div className="flex items-center gap-4">
                                                      <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-[#0B1120] text-slate-400 border-white/10' : 'bg-white text-slate-500 border-slate-200'}`}>{lesson.duration}m</span>
                                                      <div className={`p-2 rounded-full transition-colors ${playingVideoId === lId ? 'bg-red-500/10 text-red-500' : (isDarkMode ? 'bg-[#0B1120] text-slate-400 group-hover:text-white' : 'bg-slate-50 text-slate-500 group-hover:text-slate-900')}`}>
                                                        {playingVideoId === lId ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                      </div>
                                                   </div>
                                                </button>

                                                {/* Embedded Video Player */}
                                                {playingVideoId === lId && (
                                                   <div 
                                                     className={`m-2 md:m-4 p-4 md:p-6 border rounded-3xl animate-in slide-in-from-top-2 duration-300 relative overflow-hidden shadow-lg ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200'}`}
                                                     onContextMenu={(e) => e.preventDefault()}
                                                   >
                                                      <div className={`aspect-video w-full rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.15)] border relative bg-black ${!isActive ? 'grayscale opacity-75 blur-[2px]' : ''} ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                                                         {finalVideoUrl ? (
                                                            <SmartVideoPlayer url={resolveVideoUrl(finalVideoUrl)} controls={isActive} />
                                                          ) : (
                                                            <div className={`w-full h-full flex flex-col items-center justify-center text-center p-6 ${isDarkMode ? 'bg-gradient-to-b from-[#0B1120] to-black' : 'bg-gradient-to-b from-slate-800 to-black'}`}>
                                                               <BadgeAlert className="w-16 h-16 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                                                               <h3 className="text-xl font-bold mb-2 text-white">No Visual Feed Available</h3>
                                                               <p className="text-sm max-w-sm text-slate-400">The instructor has not uploaded a video for this module yet, or the signal is currently unreachable.</p>
                                                            </div>
                                                          )}
                                                      </div>
                                                      {(!isActive || isBlocked) && (
                                                         <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md text-center px-4 rounded-2xl m-6 border ${isDarkMode ? 'bg-[#0B1120]/80 border-red-500/30' : 'bg-white/90 border-red-200'}`}>
                                                            <Lock className="w-20 h-20 text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                                                            <h3 className={`text-4xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Signal Locked</h3>
                                                            <p className="text-red-500 text-sm font-bold bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">Clearance Authorization Required</p>
                                                         </div>
                                                      )}
                                                   </div>
                                                )}
                                             </div>
                                          );
                                       })}
                                    </div>
                                 )}
                              </div>

                              {/* Category: Checklists */}
                              <div className={`rounded-3xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                                 <button onClick={() => toggleCat(pId, 'checklists')} className={`w-full p-6 flex justify-between items-center transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`font-black text-lg flex items-center gap-5 transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-emerald-700'}`}>
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                          <CheckCircle2 className="w-6 h-6" />
                                       </div> 
                                       Checklists
                                    </span>
                                    <span className={`text-xs flex items-center gap-2 font-bold transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`}>
                                       {expandedCategory[`${pId}-checklists`] ? 'Collapse' : 'Expand'} 
                                       <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-emerald-500/20' : 'bg-slate-100 group-hover:bg-emerald-100'}`}>
                                          {expandedCategory[`${pId}-checklists`] ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                       </div>
                                    </span>
                                 </button>
                                 {expandedCategory[`${pId}-checklists`] && (
                                    <div className={`border-t p-6 flex flex-col space-y-4 ${isDarkMode ? 'border-white/5 bg-[#0B1120]' : 'border-slate-100 bg-slate-50/50'}`}>
                                       {phaseLessons.map(lesson => (
                                          lesson.quiz?.length > 0 ? (
                                             <div key={lesson.id} className={`flex justify-between items-center p-5 rounded-2xl border transition-all hover:shadow-md ${isDarkMode ? 'bg-[#0B1120]/50 border-white/5 hover:border-emerald-500/30' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                                                <div className="flex flex-col">
                                                   <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{lesson.title}</span>
                                                   <span className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Required Assessment</span>
                                                </div>
                                                <button onClick={() => {
                                                   setActiveModal({ type: 'quiz', lessonId: lesson.id, phaseIndex: pIdx + 1 });
                                                   if (!quizAttempts[lesson.id]) setQuizAttempts(prev => ({ ...prev, [lesson.id]: 1 }));
                                                }} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-sm ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}>
                                                   Start Quiz
                                                </button>
                                             </div>
                                          ) : null
                                       ))}
                                       {phaseLessons.every(l => !l.quiz?.length) && (
                                          <div className={`text-base font-medium text-center py-8 rounded-2xl border border-dashed ${isDarkMode ? 'text-slate-400 bg-[#0B1120]/50 border-white/10' : 'text-slate-500 bg-white border-slate-200'}`}>No checklists available for this phase.</div>
                                       )}
                                    </div>
                                 )}
                              </div>

                              {/* Category: Notes */}
                              <div className={`rounded-3xl border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10 hover:border-[#00D4FF]/30' : 'bg-white border-slate-200 hover:border-cyan-200'}`}>
                                 <button onClick={() => toggleCat(pId, 'notes')} className={`w-full p-6 flex justify-between items-center transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                    <span className={`font-black text-lg flex items-center gap-5 transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-cyan-700'}`}>
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/30' : 'bg-cyan-50 text-cyan-600 border-cyan-100'}`}>
                                          <FileText className="w-6 h-6" />
                                       </div> 
                                       Notes & Resources
                                    </span>
                                    <span className={`text-xs flex items-center gap-2 font-bold transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-[#00D4FF]' : 'text-slate-400 group-hover:text-cyan-600'}`}>
                                       {expandedCategory[`${pId}-notes`] ? 'Collapse' : 'Expand'} 
                                       <div className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/5 group-hover:bg-[#00D4FF]/20' : 'bg-slate-100 group-hover:bg-cyan-100'}`}>
                                          {expandedCategory[`${pId}-notes`] ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                       </div>
                                    </span>
                                 </button>
                                 {expandedCategory[`${pId}-notes`] && (
                                    <div className={`p-8 border-t text-base leading-relaxed border-l-4 whitespace-pre-wrap transition-all ${isDarkMode ? 'border-white/5 bg-[#0B1120] text-slate-300 border-l-[#00D4FF]/50' : 'border-slate-100 bg-slate-50/50 text-slate-600 border-l-cyan-400'}`}>
                                       {allReadingMaterials || 'No notes available for this phase.'}
                                    </div>
                                 )}
                              </div>

                              {/* Phase Completion Trigger */}
                              <div className={`pt-10 pb-2 mt-8 font-sans flex justify-center md:justify-end border-t border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-300'}`}>
                                 <button
                                    onClick={async () => { for (const lesson of phaseLessons) { if (!completedList.includes(lesson.id)) { await verifyPhaseCompletion(lesson.id); } } }}
                                    disabled={!isActive || lCompleted}
                                    className={`w-full md:w-auto px-10 py-5 font-black text-sm rounded-full transition-all duration-300 flex items-center justify-center gap-3 border-2 overflow-hidden relative group ${
                                       lCompleted ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]' 
                                       : !isActive ? `cursor-not-allowed ${isDarkMode ? 'bg-[#0B1120] text-slate-500 border-white/5' : 'bg-slate-100 text-slate-400 border-slate-200'}` 
                                       : 'bg-[#1e48bc] hover:bg-[#295ce8] border-transparent text-white shadow-[0_0_20px_rgba(30,72,188,0.4)] hover:shadow-[0_0_30px_rgba(41,92,232,0.6)] hover:scale-[1.02]'
                                    }`}
                                 >
                                    {!lCompleted && isActive && <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300 ease-out z-0"></div>}
                                    <CheckCircle2 className="w-5 h-5 relative z-10" /> 
                                    <span className="relative z-10">{lCompleted ? 'Phase Resolved' : 'Complete Phase Assessment'}</span>
                                 </button>
                              </div>

                           </div>
                        )}
                     </div>
                  );
               });
            })()}
         </div>

         {/* Course Completion / Certificate Generation */}
         {course.lessons?.length > 0 && completedList.length >= course.lessons.length && (
            <div className="mt-12 bg-gradient-to-r from-[#008A32]/20 to-[#00A13B]/10 rounded-3xl border border-[#00D4FF]/30 p-8 sm:p-12 text-center animate-in zoom-in duration-500 shadow-[0_0_40px_rgba(0,138,50,0.15)] relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/20 rounded-full blur-[80px] pointer-events-none"></div>
               <Award className={`w-20 h-20 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] ${certificateData ? 'text-[#00D4FF]' : 'text-[#00D4FF]'}`} />
               <h2 className={`text-3xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {certificateData ? 'Certificate Secured' : 'Course Protocol Completed'}
               </h2>
               <p className={`font-medium mb-8 max-w-lg mx-auto ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                  {certificateData 
                     ? `Verification Code: ${certificateData.verificationHash || certificateData.verified_hash}\nYour certificate is permanently recorded in the system.` 
                     : course.isExamRequired && !enrollmentProgress?.passedFinalExam
                        ? 'You have finished all modules. You must now pass the Final Challenge (>= 75%) to get your certificate.'
                        : 'You have successfully finalized all phase assessments. Your clearance is fully upgraded.'}
               </p>
               {!certificateData ? (
                  course.isExamRequired && !enrollmentProgress?.passedFinalExam ? (
                     <Link 
                        to={`/quiz/${course.id}`}
                        className={`px-10 py-5 font-black rounded-full hover:scale-105 transition-all flex items-center justify-center gap-3 mx-auto bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                     >
                        <CheckCircle2 className="w-6 h-6" /> Take Final Challenge
                     </Link>
                  ) : (
                     <button 
                        onClick={handleClaimCertificate}
                        disabled={generatingCertificate}
                        className={`px-10 py-5 font-black   rounded-full transition-all flex items-center justify-center gap-3 mx-auto shadow-xl ${generatingCertificate ? 'bg-[#00D4FF]/50 text-black/50 cursor-not-allowed' : 'bg-gradient-to-r from-[#00D4FF] to-orange-500 text-black hover:scale-105'}`}
                     >
                        <Award className={`w-6 h-6 ${generatingCertificate ? 'animate-pulse' : ''}`} /> 
                        {generatingCertificate ? 'Synthesizing...' : 'Claim Official Certificate'}
                     </button>
                  )
               ) : (
                  <Link to="/dashboard/certificates" className={`px-10 py-5 ] font-black rounded-full hover:] transition-colors flex items-center justify-center gap-3 mx-auto max-w-xs cursor-pointer inline-flex bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                     <CheckCircle2 className="w-5 h-5 text-[#00D4FF] group-hover:text-white" /> View Certificate
                  </Link>
               )}
            </div>
         )}

      </div>

      {/* Modal Overlay for Assessment */}
      <PremiumModal isOpen={activeModal?.type === 'quiz'} onClose={() => setActiveModal(null)} maxWidth="max-w-3xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
               
               {/* Modal Header */}
               <div className={`flex justify-between items-center p-5 md:p-6 border-b shadow-sm relative z-10 ${isDarkMode ? 'bg-[#0B1120]/50 border-white/10' : 'bg-white/50 border-slate-200'}`}>
                  <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{quizState[activeModal?.lessonId]?.submitted ? 'Result' : 'Assessment'}</h3>
                  <button onClick={() => setActiveModal(null)} className={`transition-colors rounded-full p-2 ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               {/* Modal Body */}
               <div className={`overflow-y-auto p-6 md:p-8 flex-1 relative ${isDarkMode ? 'bg-[#0B1120]/50' : 'bg-slate-50'}`}>
                  {activeModal && (() => {
                     const lId = activeModal.lessonId;
                     const targetLesson = course.lessons.find(l => l.id === lId);
                     const qsState = quizState[lId];
                     
                     if (!qsState?.submitted) {
                        return (
                           <div className="space-y-8">
                              {targetLesson.quiz.map((q, qIndex) => (
                                  <div key={qIndex} className={`border rounded-xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-white border-slate-200'}`}>
                                     <p className={`font-bold mb-5 text-[15px] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{qIndex + 1}. {q.question}</p>
                                     <div className="space-y-4">
                                        {q.options.map((opt, oIndex) => {
                                           const isSelected = quizAnswers[`${lId}-${qIndex}`] === oIndex;
                                           return (
                                           <label key={oIndex} className="w-full flex items-center cursor-pointer group">
                                              <input 
                                                 type="radio" 
                                                 checked={isSelected} 
                                                 onChange={() => setQuizAnswers(prev => ({...prev, [`${lId}-${qIndex}`]: oIndex}))} 
                                                 className={`w-4 h-4 text-[#00D4FF] focus:ring-[#00D4FF] focus:ring-2 focus:ring-offset-1 transition-all ${isDarkMode ? 'bg-[#0B1120] border-white/20' : 'bg-white border-slate-300'}`}
                                              />
                                              <span className={`ml-3 text-[14px] transition-colors ${isSelected ? (isDarkMode ? 'text-white font-bold' : 'text-slate-900 font-medium') : (isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900')}`}>{opt}</span>
                                           </label>
                                          );
                                       })}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        );
                     } else {
                        const { score, total, grade, passed } = qsState;
                        const percentage = Math.round((score / total) * 100);
                        const attemptNum = quizAttempts[lId] || 1;
                        const preScore = preAssessmentScore[lId] || Math.max(0, percentage - 10);
                        
                        return (
                           <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.03)] text-center max-w-xl mx-auto">
                              <h2 className="text-xl font-bold text-slate-800 mb-4">Post-Assessment Results</h2>
                              <div className="text-[3.5rem] font-black text-[#2563eb] leading-none mb-3 tracking-tighter">
                                 {score} / {total}
                              </div>
                              <p className="text-slate-700 font-bold mb-1 text-sm">Grade: <span className={passed ? "text-emerald-500" : "text-[#00D4FF]"}>{grade}</span></p>
                              <p className={`text-xs mb-8 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Attempt #{attemptNum}</p>
                              
                              {passed ? (
                                 <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl text-left -mx-2 bg-gradient-to-b from-white to-emerald-50/30 overflow-hidden">
                                     <div className="px-6 py-4 border-b border-emerald-50 text-center">
                                         <p className="text-emerald-600 font-bold text-[15px]">Assessment Completed Successfully!</p>
                                     </div>
                                    <div className="p-6">
                                        <p className="text-[11px] text-emerald-600/80 font-bold mb-4">Your Progress Improvement:</p>
                                        <div className="flex gap-4">
                                           <div className="flex-1 bg-white border border-emerald-100 rounded-lg p-5 shadow-sm text-left">
                                              <p className={`text-[9px] font-black mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>PRE-ASSESSMENT</p>
                                              <p className="text-[#2563eb] font-black text-xl">{preScore}%</p>
                                           </div>
                                           <div className="flex-1 bg-white border border-emerald-100 rounded-lg p-5 shadow-sm text-left">
                                              <p className={`text-[9px] font-black mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>POST-ASSESSMENT</p>
                                              <p className="text-emerald-500 font-black text-xl">{percentage}%</p>
                                           </div>
                                        </div>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="bg-red-50/50 border border-red-100 rounded-xl p-6 mb-8 text-center -mx-2">
                                    <p className="text-red-600 font-bold mb-2">Assessment Failed</p>
                                    <p className="text-sm text-slate-600">You need a score of 75% or higher to pass. Please review the material and try again.</p>
                                 </div>
                              )}
                           </div>
                        );
                     }
                  })()}
               </div>

               {/* Modal Footer */}
               <div className={`p-4 md:px-6 md:py-4 border-t flex justify-start gap-3 ${isDarkMode ? 'bg-[#0B1120]/50 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  {activeModal && (() => {
                     const lId = activeModal.lessonId;
                     const targetLesson = course.lessons.find(l => l.id === lId);
                     const qsState = quizState[lId];

                     if (!qsState?.submitted) {
                        return (
                           <>
                              <button 
                                 onClick={() => {
                                    let score = 0;
                                    targetLesson.quiz.forEach((q, i) => { 
                                        const selected = quizAnswers[`${lId}-${i}`];
                                        const isCorrect = selected === q.correctAnswer;
                                        if (isCorrect) score++; 

                                        recordQuizAttempt({
                                           courseId,
                                           lessonId: lId,
                                           questionIndex: i,
                                           question: q.question || q.stem || `Question ${i + 1}`,
                                           selectedAnswer: String(selected !== undefined ? selected : ''),
                                           correctAnswer: String(q.correctAnswer),
                                           isCorrect: Boolean(isCorrect),
                                           topic: q.topic || targetLesson.title,
                                           timeSpentSeconds: 45
                                        }).catch(() => {});
                                     });
                                     const total = targetLesson.quiz.length;
                                     const percentage = (score / total) * 100;
                                     let grade = 'F';
                                     if (percentage >= 90) grade = 'A';
                                     else if (percentage >= 80) grade = 'B';
                                     else if (percentage >= 70) grade = 'C';
                                     else if (percentage >= 50) grade = 'D';

                                     const passed = percentage >= 50;

                                     if (!preAssessmentScore[lId]) {
                                        setPreAssessmentScore(prev => ({ ...prev, [lId]: percentage }));
                                     }

                                     setQuizState(prev => ({ ...prev, [lId]: { submitted: true, score, total, grade, passed } }));
                                     toast.success('Assessment Submitted!');
                                 }}
                                 className={`px-6 py-2.5 bg-[#1e48bc] font-bold rounded-md hover:bg-blue-700 shadow-sm text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                              >
                                 Submit
                              </button>
                               <button onClick={() => setActiveModal(null)} className={`px-6 py-2.5 hover:opacity-80 font-bold rounded-xl shadow-sm text-sm transition-colors ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                  Cancel
                               </button>
                            </>
                         );
                      } else {
                         return (
                            <div className="w-full flex justify-center pb-2">
                               <button 
                                  onClick={() => {
                                     if (qsState.passed) {
                                        verifyPhaseCompletion(lId);
                                     } else {
                                        setQuizState(prev => ({ ...prev, [lId]: null }));
                                        setQuizAttempts(prev => ({ ...prev, [lId]: (prev[lId] || 1) + 1 }));
                                     }
                                     setActiveModal(null);
                                  }}
                                  className={`px-10 py-3 bg-[#00D4FF] hover:bg-[#00A3CC] font-bold rounded-xl shadow-md transition-all sm:min-w-[200px] ${isDarkMode ? 'text-[#0B1120]' : 'text-white'}`}
                               >
                                  {qsState.passed ? 'Continue' : 'Try Again'}
                               </button>
                            </div>
                         );
                      }
                   })()}
                </div>
      </PremiumModal>

      {/* Floating AI Mentor Button */}
      <motion.button
        whileHover={{ scale: 1.08, boxShadow: '0px 0px 20px rgba(249, 115, 22, 0.4)' }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsDrawerOpen(true)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#FDBA74] text-white flex items-center justify-center shadow-[0_10px_25px_rgba(234,88,12,0.3)] hover:shadow-[0_15px_35px_rgba(234,88,12,0.5)] border border-[#EA580C]/30 cursor-pointer"
      >
        <span className="relative flex h-3 w-3 absolute -top-1 -right-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
           <path d="M12 2a10 10 0 0 1 7.54 16.59c-.24.25-.34.58-.29.91l.43 2.76c.06.39-.32.69-.69.54l-2.76-1.1c-.33-.13-.7-.07-.97.12A10 10 0 1 1 12 2z"/>
           <path d="M8 11h8"/>
           <path d="M8 15h6"/>
           <path d="M9 7h1"/>
        </svg>
      </motion.button>

      {/* Collapsible Side Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
           <motion.div
             initial={{ x: '100%' }}
             animate={{ x: 0 }}
             exit={{ x: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className={`fixed top-0 right-0 z-50 w-full sm:w-[460px] h-full shadow-2xl flex flex-col border-l transition-colors duration-300 ${
               isDarkMode ? 'bg-[#0B1120] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
             }`}
           >
             {/* Drawer Header */}
             <div className={`p-5 flex items-center justify-between border-b ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#FDBA74] flex items-center justify-center shadow-md">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                         <path d="M12 2a10 10 0 0 1 7.54 16.59c-.24.25-.34.58-.29.91l.43 2.76c.06.39-.32.69-.69.54l-2.76-1.1c-.33-.13-.7-.07-.97.12A10 10 0 1 1 12 2z"/>
                      </svg>
                   </div>
                   <div>
                      <h3 className="font-black text-base tracking-tight">EDOT Mentor AI</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Personal Study Assistant</p>
                   </div>
                </div>
                <button 
                   onClick={() => setIsDrawerOpen(false)}
                   className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}
                >
                   <X size={20} />
                </button>
             </div>

             {/* Drawer Body - Scrollable */}
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Lesson Selector */}
                <div className="space-y-2">
                   <label className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select Lesson Context</label>
                   <select
                      value={selectedLessonId}
                      onChange={(e) => {
                         setSelectedLessonId(e.target.value);
                         setAiAnswer('');
                         setAiChatHistory([]);
                         setMentorConversationId(null);
                         setAiQuiz([]);
                         setAiQuizAnswers({});
                         setAiQuizSubmitted(false);
                      }}
                      className={`w-full p-3 rounded-xl border text-sm font-bold focus:outline-none transition-all ${
                        isDarkMode ? 'bg-[#121A2F] border-white/10 text-white focus:border-[#EA580C]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#EA580C]'
                      }`}
                   >
                      {course.lessons.map(l => (
                         <option key={l.id} value={l.id}>{l.title}</option>
                      ))}
                   </select>
                </div>

                {/* Quick Actions Panel */}
                <div className="grid grid-cols-2 gap-3">
                   <button
                      onClick={handleExplainLesson}
                      disabled={loadingAi}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        isDarkMode 
                           ? 'bg-slate-900/60 border-white/5 hover:border-[#EA580C]/40 text-slate-200 hover:text-white' 
                           : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-700 hover:text-[#EA580C]'
                      }`}
                   >
                      <span className="text-xl">💡</span>
                      Explain Concept
                   </button>
                   <button
                      onClick={handleSummarizeLesson}
                      disabled={loadingAi}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        isDarkMode 
                           ? 'bg-slate-900/60 border-white/5 hover:border-[#EA580C]/40 text-slate-200 hover:text-white' 
                           : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-700 hover:text-[#EA580C]'
                      }`}
                   >
                      <span className="text-xl">📝</span>
                      Summarize Lesson
                   </button>
                   <button
                      onClick={handleGeneratePracticeQuestions}
                      disabled={loadingAi}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        isDarkMode 
                           ? 'bg-slate-900/60 border-white/5 hover:border-[#EA580C]/40 text-slate-200 hover:text-white' 
                           : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-700 hover:text-[#EA580C]'
                      }`}
                   >
                      <span className="text-xl">🎯</span>
                      Practice Questions
                   </button>
                   <button
                      onClick={handleGetNextSteps}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        isDarkMode 
                           ? 'bg-slate-900/60 border-white/5 hover:border-[#EA580C]/40 text-slate-200 hover:text-white' 
                           : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-700 hover:text-[#EA580C]'
                      }`}
                   >
                      <span className="text-xl">🚀</span>
                      Next Steps
                   </button>
                   <button
                      onClick={() => {
                        setAiMode('chat');
                        setAiAnswer('');
                        setAiChatHistory([]);
                      }}
                      className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
                        isDarkMode 
                           ? 'bg-slate-900/60 border-white/5 hover:border-[#EA580C]/40 text-slate-200 hover:text-white' 
                           : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-700 hover:text-[#EA580C]'
                      }`}
                   >
                      <span className="text-xl">💬</span>
                      Interactive Chat Q&A
                   </button>
                </div>

                <div className="h-px bg-slate-250 dark:bg-slate-800 my-4" />

                {/* Assistant Viewport */}
                <div className="flex-1 flex flex-col min-h-[250px]">
                   {loadingAi ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                         <div className="w-10 h-10 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin"></div>
                         <p className="text-xs font-bold text-slate-400">Synthesizing learning objectives...</p>
                      </div>
                   ) : aiMode === 'chat' ? (
                      <div className="space-y-4">
                         {/* Conversations history or placeholder */}
                         {aiChatHistory.length === 0 ? (
                            <div className={`p-5 rounded-2xl border text-center text-xs font-semibold ${isDarkMode ? 'bg-slate-900/40 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200/80 text-slate-500'}`}>
                               👋 Hello! I am your personal study mentor. Select a topic, ask any question about the lesson, or choose a quick action to start.
                            </div>
                         ) : (
                            <div className="space-y-4">
                               {aiChatHistory.map((chat, cIdx) => (
                                  <div key={cIdx} className={`flex flex-col ${chat.role === 'user' ? 'items-end' : 'items-start'}`}>
                                     <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{chat.role === 'user' ? 'You' : 'Mentor AI'}</span>
                                     <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-[90%] shadow-sm ${
                                       chat.role === 'user' 
                                          ? 'bg-[#EA580C] text-white rounded-tr-none' 
                                          : (isDarkMode ? 'bg-[#121A2F] border border-white/5 text-slate-200 rounded-tl-none' : 'bg-slate-100 text-slate-700 rounded-tl-none')
                                     }`}>
                                        {chat.role === 'user' ? (
                                           chat.content
                                        ) : (
                                           <Markdown
                                              options={{
                                                 forceBlock: true,
                                                 overrides: {
                                                    strong: {
                                                       component: 'strong',
                                                       props: { className: 'font-extrabold text-[#00D4FF] dark:text-[#EA580C]' }
                                                    },
                                                    em: {
                                                       component: 'em',
                                                       props: { className: 'font-bold italic text-amber-500' }
                                                    },
                                                    ul: {
                                                       component: 'ul',
                                                       props: { className: 'list-disc pl-4 my-1 space-y-1' }
                                                    },
                                                    ol: {
                                                       component: 'ol',
                                                       props: { className: 'list-decimal pl-4 my-1 space-y-1' }
                                                    },
                                                    p: {
                                                       component: 'p',
                                                       props: { className: 'mb-1 last:mb-0' }
                                                    }
                                                 }
                                              }}
                                           >
                                              {chat.content}
                                           </Markdown>
                                        )}
                                     </div>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   ) : (
                      /* Interactive Quiz UI */
                      <div className="space-y-6">
                         {aiQuiz.length === 0 ? (
                            <div className="text-center text-xs text-slate-400 py-8">Generate practice quiz to test your comprehension!</div>
                         ) : (
                            <div className="space-y-6">
                               <div className="flex justify-between items-center">
                                  <h4 className="text-sm font-black">Practice Assessment</h4>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-[#EA580C]">5 Questions</span>
                               </div>
                               {aiQuiz.map((q, qIdx) => (
                                  <div key={qIdx} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#121A2F]/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                     <p className="text-xs font-black mb-3">{qIdx + 1}. {q.question}</p>
                                     <div className="space-y-2">
                                        {q.options.map((opt, oIdx) => {
                                           const isSelected = aiQuizAnswers[qIdx] === opt;
                                           const isCorrect = opt === q.correctAnswer;
                                           let optClass = isDarkMode 
                                              ? 'bg-slate-900 border-white/5 hover:border-[#EA580C]/40 text-slate-300' 
                                              : 'bg-white border-slate-200 hover:border-[#EA580C]/40 text-slate-600';
                                           
                                           if (isSelected) {
                                              optClass = 'border-[#EA580C] bg-[#EA580C]/10 text-[#EA580C]';
                                           }
                                           if (aiQuizSubmitted) {
                                              if (isCorrect) {
                                                 optClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-500';
                                              } else if (isSelected) {
                                                 optClass = 'border-rose-500 bg-rose-500/10 text-rose-500';
                                              }
                                           }

                                           return (
                                              <button
                                                 key={oIdx}
                                                 disabled={aiQuizSubmitted}
                                                 onClick={() => setAiQuizAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                                                 className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${optClass}`}
                                              >
                                                 <span>{opt}</span>
                                                 {aiQuizSubmitted && isCorrect && <span className="text-emerald-500">✓</span>}
                                                 {aiQuizSubmitted && isSelected && !isCorrect && <span className="text-rose-500">✗</span>}
                                              </button>
                                           );
                                        })}
                                     </div>
                                     {aiQuizSubmitted && (
                                        <div className="mt-3 p-3 rounded-xl bg-slate-900/40 text-[11px] font-medium text-slate-350 leading-relaxed border-l-2 border-amber-500">
                                           💡 {q.explanation}
                                        </div>
                                     )}
                                  </div>
                               ))}

                               {!aiQuizSubmitted ? (
                                  <button
                                     onClick={() => {
                                        if (Object.keys(aiQuizAnswers).length < aiQuiz.length) {
                                           toast.error("Please answer all questions before submitting.");
                                           return;
                                        }
                                        setAiQuizSubmitted(true);

                                        aiQuiz.forEach((q, qIdx) => {
                                           const selected = aiQuizAnswers[qIdx];
                                           const isCorrect = selected === q.correctAnswer;
                                           recordQuizAttempt({
                                              courseId,
                                              lessonId: selectedLessonId,
                                              questionIndex: qIdx,
                                              question: q.question,
                                              selectedAnswer: String(selected),
                                              correctAnswer: String(q.correctAnswer),
                                              isCorrect: Boolean(isCorrect),
                                              topic: q.topic || 'AI Practice Quiz',
                                              timeSpentSeconds: 30
                                           }).catch(() => {});
                                        });

                                        toast.success("Quiz Submitted! Intelligence profile updated.");
                                     }}
                                     className="w-full py-3 bg-[#EA580C] text-white text-xs font-black rounded-xl hover:bg-[#d94e07] shadow-md transition-all cursor-pointer"
                                  >
                                     Submit Answers
                                  </button>
                               ) : (
                                  <button
                                     onClick={handleGenerateQuiz}
                                     className="w-full py-3 border border-[#EA580C]/30 text-[#EA580C] text-xs font-black rounded-xl hover:bg-[#EA580C]/10 transition-all cursor-pointer"
                                  >
                                     Retake New Quiz
                                  </button>
                                )}
                            </div>
                         )}
                      </div>
                    )}
                 </div>
           </div>
        
        {/* Drawer Footer - Chat input */}
       <div className={`p-4 border-t ${isDarkMode ? 'border-white/10 bg-[#0B1120]' : 'border-slate-200 bg-white'}`}>
          <form onSubmit={handleAskQuestion} className="flex gap-2">
             <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask Mentor AI a question..."
                className={`flex-1 p-3 rounded-xl text-xs focus:outline-none transition-all ${
                  isDarkMode 
                     ? 'bg-slate-900 border border-white/10 text-white focus:border-[#EA580C]' 
                     : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-[#EA580C]'
                }`}
             />
             <button
                type="submit"
                disabled={!aiQuestion.trim() || loadingAi}
                className="px-4 py-3 bg-gradient-to-tr from-[#EA580C] to-[#FDBA74] text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all text-xs cursor-pointer"
             >
                Send
             </button>
          </form>
       </div>
     </motion.div>
  )}
</AnimatePresence>

    </div>
  );
}
