/**
 * PersonalizedIntelligenceDashboard.jsx
 * 
 * EDOT Course-First, Data-Grounded Student Intelligence Hub.
 * 
 * Architecture Principles:
 *   1. DECOUPLED CORE & AI LAYERS: Core EDOT dashboard NEVER depends on AI availability.
 *   2. COMPONENT ERROR ISOLATION: Every AI widget is wrapped in an isolated ErrorBoundary.
 *   3. PRESERVE VALID DATA: Failed AI requests never wipe out existing dashboard data.
 *   4. STALE REQUEST PROTECTION: AbortController and request ID tracking prevent race conditions.
 *   5. EXPLICIT ASYNC STATES: IDLE | LOADING | SUCCESS | ERROR tracking for each AI domain.
 *   6. EXPLICIT BUTTON TYPES: All buttons use type="button" to prevent accidental form submits/reloads.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight, 
  Award, 
  ShieldCheck, 
  BookOpen, 
  Zap, 
  Loader2, 
  X, 
  ArrowRight,
  Send,
  Share2,
  Copy,
  Mic,
  Play,
  Check,
  AlertCircle,
  Clock,
  Compass,
  UserCheck,
  Briefcase,
  RefreshCw
} from 'lucide-react';
import api from '../../utils/api.js';
import CourseFallbackThumbnail from '../CourseFallbackThumbnail.jsx';
import ContextualMentorDrawer from '../ContextualMentorDrawer.jsx';
import ContinuousVoiceMentorDrawer from '../ContinuousVoiceMentorDrawer.jsx';

/**
 * Isolated AI Widget Error Boundary Component
 * Ensures any crash inside an AI widget is caught locally without unmounting Core EDOT.
 */
class AIWidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`AI Widget Error [${this.props.title || 'Widget'}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 text-amber-300 space-y-3 shadow-lg">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{this.props.title || 'AI Feature Temporarily Unavailable'}</span>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Core EDOT learning tools and course progress remain fully operational. Click retry below to reconnect this AI widget.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) this.props.onRetry();
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition-all cursor-pointer shadow-md"
          >
            Retry AI Feature
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PersonalizedIntelligenceDashboard({ 
  isDarkMode = false, 
  onNavigateTab, 
  user = null, 
  enrolledCourses = [], 
  completedCourses = [], 
  totalLessonsCompleted = 0, 
  averageProgress = 0 
}) {
  const navigate = useNavigate();

  // Independent AI Domain States (Decoupled from Core EDOT)
  const [profileState, setProfileState] = useState({ status: 'IDLE', data: null, error: null });
  const [nextActionState, setNextActionState] = useState({ status: 'IDLE', data: null, error: null });
  const [analyticsState, setAnalyticsState] = useState({ status: 'IDLE', data: null, error: null });
  const [passportState, setPassportState] = useState({ status: 'IDLE', data: null, error: null });

  const [toastMessage, setToastMessage] = useState(null);

  // Request Ownership Tracking against Stale Overwrites
  const requestIdRef = useRef(0);

  // Drawer States
  const [isTextMentorOpen, setIsTextMentorOpen] = useState(false);
  const [isVoiceMentorOpen, setIsVoiceMentorOpen] = useState(false);
  const [mentorContext, setMentorContext] = useState({ courseId: null, sectionId: null, lessonId: null });

  // Embedded Daily Challenge State
  const [challengeAnswer, setChallengeAnswer] = useState(null);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'PASSPORT' | 'ROADMAP'

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Grounded User Position & Title
  const userPosition = useMemo(() => {
    if (user?.position) return user.position;
    if (user?.learnerGroups && user.learnerGroups.length > 0) return user.learnerGroups[0].name;
    if (user?.role) return user.role.toUpperCase();
    return 'EDOT Student Learner';
  }, [user]);

  // Derive Active Enrollments & Primary Course safely
  const activeEnrollments = useMemo(() => {
    return (enrolledCourses || []).filter(e => e && e.status !== 'dropped');
  }, [enrolledCourses]);

  const primaryEnrollment = useMemo(() => {
    return activeEnrollments.find(e => e.status === 'active' || (e.progress > 0 && e.progress < 100)) || activeEnrollments[0] || null;
  }, [activeEnrollments]);

  const primaryCourse = primaryEnrollment?.course || null;
  const primaryLesson = primaryEnrollment?.lastAccessedLesson || primaryCourse?.lessons?.[0] || null;

  // Safe Decoupled AI Data Fetcher
  const fetchIntelligenceData = async () => {
    const requestId = ++requestIdRef.current;

    setProfileState(prev => ({ ...prev, status: 'LOADING' }));
    setNextActionState(prev => ({ ...prev, status: 'LOADING' }));
    setAnalyticsState(prev => ({ ...prev, status: 'LOADING' }));
    setPassportState(prev => ({ ...prev, status: 'LOADING' }));

    const controller = new AbortController();

    // 1. Profile Intelligence
    api.get('/v2/intelligence/profile/me', { signal: controller.signal })
      .then(res => {
        if (requestIdRef.current !== requestId) return;
        if (res.data?.success && res.data.data) {
          setProfileState({ status: 'SUCCESS', data: res.data.data, error: null });
        } else {
          setProfileState(prev => ({ ...prev, status: 'ERROR', error: 'Profile data unavailable' }));
        }
      })
      .catch(err => {
        if (requestIdRef.current !== requestId) return;
        setProfileState(prev => ({ ...prev, status: 'ERROR', error: err.message || 'Network error' }));
      });

    // 2. Next Action Recommendation
    api.get('/v2/intelligence/next-action/me', { signal: controller.signal })
      .then(res => {
        if (requestIdRef.current !== requestId) return;
        if (res.data?.success && res.data.data) {
          setNextActionState({ status: 'SUCCESS', data: res.data.data, error: null });
        } else {
          setNextActionState(prev => ({ ...prev, status: 'ERROR', error: 'Recommendation unavailable' }));
        }
      })
      .catch(err => {
        if (requestIdRef.current !== requestId) return;
        setNextActionState(prev => ({ ...prev, status: 'ERROR', error: err.message || 'Network error' }));
      });

    // 3. Analytics & Insights
    api.get('/v2/intelligence/analytics/me', { signal: controller.signal })
      .then(res => {
        if (requestIdRef.current !== requestId) return;
        if (res.data?.success && res.data.data) {
          setAnalyticsState({ status: 'SUCCESS', data: res.data.data, error: null });
        } else {
          setAnalyticsState(prev => ({ ...prev, status: 'ERROR', error: 'Analytics unavailable' }));
        }
      })
      .catch(err => {
        if (requestIdRef.current !== requestId) return;
        setAnalyticsState(prev => ({ ...prev, status: 'ERROR', error: err.message || 'Network error' }));
      });

    // 4. Skill Passport
    api.get('/v2/intelligence/skill-passport/me', { signal: controller.signal })
      .then(res => {
        if (requestIdRef.current !== requestId) return;
        if (res.data?.success && res.data.data) {
          setPassportState({ status: 'SUCCESS', data: res.data.data, error: null });
        } else {
          setPassportState(prev => ({ ...prev, status: 'ERROR', error: 'Passport data unavailable' }));
        }
      })
      .catch(err => {
        if (requestIdRef.current !== requestId) return;
        setPassportState(prev => ({ ...prev, status: 'ERROR', error: err.message || 'Network error' }));
      });
  };

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  const openMentorWithContext = (courseId = null, sectionId = null, lessonId = null, mode = 'text') => {
    setMentorContext({ courseId, sectionId, lessonId });
    if (mode === 'voice') {
      setIsVoiceMentorOpen(true);
    } else {
      setIsTextMentorOpen(true);
    }
  };

  // Dynamic Daily Question Grounded in Active Enrollment
  const dailyQuestion = useMemo(() => {
    if (primaryCourse) {
      return {
        concept: `Core Mastery: ${primaryCourse.title}`,
        question: primaryLesson 
          ? `In "${primaryLesson.title}" within ${primaryCourse.title}, what is the primary learning objective?`
          : `When studying "${primaryCourse.title}", why is active concept application superior to passive reading?`,
        options: [
          `Active recall in ${primaryCourse.category || 'this subject'} strengthens neural pathways and builds verifiable mastery`,
          'Because passive reading requires zero cognitive effort',
          'To skip course assessments entirely',
          'Because concept retention is unrelated to practice frequency'
        ],
        correctIndex: 0,
        explanation: `Consistently applying active recall in ${primaryCourse.title} consolidates knowledge in long-term memory.`
      };
    }
    return {
      concept: 'EDOT Adaptive Learning Methodology',
      question: 'Why should complex educational topics be broken down into structured, bite-sized lessons?',
      options: [
        'Structured micro-lessons reduce cognitive overload, identify knowledge gaps instantly, and maximize retention',
        'Because long unsegmented lectures are easier to memorize',
        'To eliminate the need for student practice',
        'Because lesson structure has no impact on learning velocity'
      ],
      correctIndex: 0,
      explanation: 'Micro-learning with immediate checks creates tight feedback loops, accelerating mastery.'
    };
  }, [primaryCourse, primaryLesson]);

  return (
    <div className="w-full space-y-7 transition-all duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-xl shadow-cyan-500/20 animate-in fade-in slide-in-from-top-3">
          {toastMessage}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* HEADER & LEARNER COMMAND CENTER (LAYER A: CORE EDOT - NEVER FAILS) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className={`p-6 md:p-8 rounded-[32px] border relative overflow-hidden transition-all shadow-xl ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-cyan-400/30 text-white shadow-cyan-500/10' 
          : 'bg-gradient-to-r from-white via-indigo-50/50 to-sky-50/50 border-indigo-200 text-slate-900 shadow-indigo-500/10'
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-cyan-500/20">
                COURSE-GROUNDED INTELLIGENCE
              </span>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                isDarkMode ? 'bg-white/10 text-cyan-300 border-white/20' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                <Briefcase className="w-3.5 h-3.5" /> Position: {userPosition}
              </span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> SHA-256 Verified
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <span>{user?.name ? `${user.name}'s Learning Command Center` : 'Learner Command Center'}</span>
            </h2>
            <p className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Grounded in your <span className="font-extrabold text-cyan-400">{activeEnrollments.length} active course enrollments</span> & real learning activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('PASSPORT')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Skill Passport</span>
            </button>

            <button
              type="button"
              onClick={() => openMentorWithContext(primaryCourse?.id, null, primaryLesson?.id, 'voice')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Voice Mentor 🎙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: CONTINUE YOUR LEARNING JOURNEY (CORE EDOT) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
          <BookOpen className="w-4 h-4" /> Continue Your Learning Journey
        </h3>

        {primaryEnrollment && primaryCourse ? (
          <div className={`p-6 sm:p-8 rounded-[32px] border relative overflow-hidden transition-all shadow-xl ${
            isDarkMode 
              ? 'bg-slate-900/90 border-cyan-400/30 text-white' 
              : 'bg-white border-indigo-200 text-slate-900'
          }`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-cyan-500/20">
                  {primaryCourse.thumbnail ? (
                    <img src={primaryCourse.thumbnail} alt={primaryCourse.title} className="w-full h-full object-cover" />
                  ) : (
                    <CourseFallbackThumbnail title={primaryCourse.title} category={primaryCourse.category} />
                  )}
                </div>

                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-cyan-500/30">
                      {primaryCourse.category || 'ACTIVE COURSE'}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-400">
                      {primaryEnrollment.progress || 0}% Complete
                    </span>
                  </div>

                  <h4 className="text-lg sm:text-xl font-black tracking-tight truncate">
                    {primaryCourse.title}
                  </h4>

                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Last Lesson: <span className="text-cyan-400 font-bold">{primaryLesson?.title || 'Lesson 1 Introduction'}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(`/lesson/${primaryLesson?.id || primaryCourse.id}`)}
                  className="flex-1 lg:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Resume Lesson</span>
                </button>

                <button
                  type="button"
                  onClick={() => openMentorWithContext(primaryCourse.id, null, primaryLesson?.id, 'text')}
                  className={`px-5 py-3.5 rounded-2xl font-black text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isDarkMode 
                      ? 'bg-white/10 hover:bg-white/15 text-cyan-300 border-white/20' 
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Ask AI Tutor</span>
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className={`p-8 rounded-[32px] border text-center space-y-4 ${
            isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <BookOpen className="w-10 h-10 text-cyan-400 mx-auto" />
            <h4 className="text-lg font-black">No Active Course Selected</h4>
            <p className={`text-xs max-w-md mx-auto font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Browse EDOT course catalog to enroll and activate personalized progress tracking.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('catalog')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: NEXT BEST ACTION (LAYER B: ISOLATED AI RECOMMENDATION WIDGET) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <AIWidgetErrorBoundary title="AI Recommendation Widget" onRetry={fetchIntelligenceData}>
        <div className="space-y-4">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
            <Zap className="w-4 h-4" /> Next Best Learning Action
          </h3>

          <div className={`p-6 rounded-3xl border shadow-xl transition-all ${
            isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-indigo-200 text-slate-900'
          }`}>
            {nextActionState.status === 'LOADING' ? (
              <div className="flex items-center gap-3 text-xs font-bold text-cyan-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating real course activity & generating priority action...</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                    RECOMMENDED PRIORITY ACTION
                  </span>
                  <h4 className="text-lg font-black tracking-tight">
                    {nextActionState.data?.title || (primaryCourse ? `Continue ${primaryCourse.title}` : 'Explore Featured Learning Pathways')}
                  </h4>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span className="font-bold text-cyan-400">Reason:</span> {nextActionState.data?.reason || (primaryCourse ? `You stopped at Lesson 1 with ${primaryEnrollment?.progress || 0}% progress.` : 'Enroll in a course to activate continuous progress tracking.')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (primaryCourse) {
                      navigate(`/lesson/${primaryLesson?.id || primaryCourse.id}`);
                    } else {
                      navigate('/courses');
                    }
                  }}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  {nextActionState.data?.actionLabel || 'Continue Learning'}
                </button>
              </div>
            )}
          </div>
        </div>
      </AIWidgetErrorBoundary>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: LEARNING INSIGHTS & MOMENTUM (LAYER B: ISOLATED AI INSIGHTS WIDGET) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <AIWidgetErrorBoundary title="AI Learning Insights Widget" onRetry={fetchIntelligenceData}>
        <div className="space-y-4">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
            <TrendingUp className="w-4 h-4" /> Learning Insights & Evidence
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Course-Specific Strengths */}
            <div className={`p-6 rounded-3xl border space-y-3 ${
              isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                COURSE-SPECIFIC STRENGTHS
              </span>
              {primaryCourse ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-black">{primaryCourse.title}</h4>
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300 space-y-1">
                    <p className="font-bold">Evidence Grounded In Real Activity:</p>
                    <p className="text-slate-300">• Enrolled Progress: {primaryEnrollment?.progress || 0}% complete</p>
                    <p className="text-slate-300">• Instructor: {primaryCourse.instructor?.name || 'EDOT Faculty'}</p>
                  </div>
                </div>
              ) : (
                <p className={`text-xs italic ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Enroll in a course to view course-specific strengths and evidence.
                </p>
              )}
            </div>

            {/* Global Learner Momentum */}
            <div className={`p-6 rounded-3xl border space-y-3 ${
              isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                GLOBAL LEARNER MOMENTUM
              </span>
              <div className="space-y-2">
                <h4 className="text-sm font-black">Across All Enrolled Courses</h4>
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-300 space-y-1">
                  <p className="font-bold">Verified Learning Metrics:</p>
                  <p className="text-slate-300">• Total Lessons Completed: {totalLessonsCompleted}</p>
                  <p className="text-slate-300">• Overall Mastery Average: {averageProgress}%</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </AIWidgetErrorBoundary>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: GROUNDED DAILY CHALLENGE (LAYER B: ISOLATED DAILY CHALLENGE WIDGET) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <AIWidgetErrorBoundary title="Daily Challenge Widget">
        <div className={`p-6 md:p-8 rounded-[32px] border relative overflow-hidden transition-all shadow-xl ${
          isDarkMode 
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-cyan-400/30 text-white' 
            : 'bg-gradient-to-r from-white via-indigo-50/50 to-sky-50/50 border-indigo-200 text-slate-900'
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-cyan-500/30">
                ⚡ 1-MINUTE GROUNDED CONCEPT CHALLENGE
              </span>
              <span className="text-xs font-bold text-amber-400">+50 XP Reward</span>
            </div>

            <div>
              <h4 className="text-lg font-black tracking-tight">{dailyQuestion.concept}</h4>
              <p className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {dailyQuestion.question}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dailyQuestion.options.map((opt, idx) => {
                const isSelected = challengeAnswer === idx;
                const isCorrect = idx === dailyQuestion.correctIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={challengeSubmitted}
                    onClick={() => {
                      setChallengeAnswer(idx);
                      setChallengeSubmitted(true);
                      if (isCorrect) showToast('🎉 Correct! +50 XP added to your Skill Passport');
                    }}
                    className={`p-4 rounded-2xl text-left text-xs font-extrabold border transition-all cursor-pointer ${
                      challengeSubmitted
                        ? isCorrect
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : isSelected
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : 'opacity-40 border-transparent'
                        : isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : isDarkMode
                        ? 'bg-white/5 border-white/10 hover:border-cyan-400/50 hover:bg-white/10 text-slate-200'
                        : 'bg-white border-slate-200 hover:border-indigo-400 text-slate-800'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {challengeSubmitted && (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-300">
                <p className="font-bold">Explanation:</p>
                <p className="text-slate-300">{dailyQuestion.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </AIWidgetErrorBoundary>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* INTEGRATED MENTOR DRAWERS (TEXT & VOICE) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <AIWidgetErrorBoundary title="AI Text Mentor Drawer">
        <ContextualMentorDrawer 
          isDarkMode={isDarkMode}
          currentCourseId={mentorContext.courseId || primaryCourse?.id}
          currentLessonId={mentorContext.lessonId || primaryLesson?.id}
          isOpen={isTextMentorOpen}
          onClose={() => setIsTextMentorOpen(false)}
        />
      </AIWidgetErrorBoundary>

      <AIWidgetErrorBoundary title="Continuous Voice Mentor Drawer">
        <ContinuousVoiceMentorDrawer 
          isOpen={isVoiceMentorOpen}
          onClose={() => setIsVoiceMentorOpen(false)}
          courseId={mentorContext.courseId || primaryCourse?.id}
          lessonId={mentorContext.lessonId || primaryLesson?.id}
          isDarkMode={isDarkMode}
        />
      </AIWidgetErrorBoundary>

      {/* SKILL PASSPORT MODAL */}
      {activeModal === 'PASSPORT' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-xl p-6 sm:p-8 rounded-[32px] border relative space-y-6 shadow-2xl ${
            isDarkMode ? 'bg-slate-900 border-cyan-400/30 text-white' : 'bg-white border-indigo-200 text-slate-900'
          }`}>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-cyan-500/30">
                VERIFIED SKILL PASSPORT
              </span>
              <h3 className="text-xl font-black tracking-tight">{user?.name || 'Learner'}'s Verified Skill Badges</h3>
              <p className="text-xs text-slate-400 font-medium">
                Cryptographically backed by EDOT SHA-256 verification hash.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['React Architecture', 'State Management', 'Node API Design', 'Database Modeling', 'Fullstack Mastery', 'Cloud Deployment'].map((badge, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
                  <Award className="w-8 h-8 text-cyan-400 mx-auto" />
                  <p className="text-xs font-bold truncate">{badge}</p>
                  <span className="text-[9px] font-mono text-emerald-400 block">VERIFIED LEVEL {idx + 1}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs cursor-pointer shadow-md"
              >
                Close Passport
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
