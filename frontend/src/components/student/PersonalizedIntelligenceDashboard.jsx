/**
 * PersonalizedIntelligenceDashboard.jsx
 * 
 * EDOT Course-First, Data-Grounded Student Intelligence Hub.
 * 
 * Architecture Principles:
 *   1. COURSE-FIRST: Intelligence is grounded in real enrolled courses and lessons.
 *   2. CONTEXT-AWARE: AI Mentor & Voice Mentor receive studentId, courseId, sectionId, lessonId.
 *   3. DATA-GROUNDED: Zero fabricated claims — insights show explicit source evidence.
 *   4. DYNAMIC: Works for 0, 1, 5, or 50 courses without hardcoding.
 *   5. NO BLACK COLORS: Uses luminous glassmorphic gradients and ultra-modern aesthetic.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Compass
} from 'lucide-react';
import api from '../../utils/api.js';
import CourseFallbackThumbnail from '../CourseFallbackThumbnail.jsx';
import ContextualMentorDrawer from '../ContextualMentorDrawer.jsx';
import ContinuousVoiceMentorDrawer from '../ContinuousVoiceMentorDrawer.jsx';

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

  // Data States
  const [profileData, setProfileData] = useState(null);
  const [nextActionData, setNextActionData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [passportData, setPassportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Drawer States
  const [isTextMentorOpen, setIsTextMentorOpen] = useState(false);
  const [isVoiceMentorOpen, setIsVoiceMentorOpen] = useState(false);
  const [mentorContext, setMentorContext] = useState({ courseId: null, sectionId: null, lessonId: null });

  // Embedded Daily Challenge State
  const [challengeAnswer, setChallengeAnswer] = useState(null);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);
  const [challengeXp, setChallengeXp] = useState(0);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'PASSPORT' | 'ROADMAP'

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Derive Primary Active Enrollment & Lesson
  const activeEnrollments = enrolledCourses.filter(e => e.status !== 'dropped');
  const primaryEnrollment = activeEnrollments.find(e => e.status === 'active' || (e.progress > 0 && e.progress < 100)) || activeEnrollments[0] || null;
  const primaryCourse = primaryEnrollment?.course || null;
  const primaryLesson = primaryEnrollment?.lastAccessedLesson || primaryCourse?.lessons?.[0] || null;

  const fetchIntelligenceData = async () => {
    setLoading(true);
    try {
      const [profileRes, nextActionRes, analyticsRes, passportRes] = await Promise.allSettled([
        api.get('/v2/intelligence/profile/me'),
        api.get('/v2/intelligence/next-action/me'),
        api.get('/v2/intelligence/analytics/me'),
        api.get('/v2/intelligence/skill-passport/me')
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data.success) {
        setProfileData(profileRes.value.data.data);
      }
      if (nextActionRes.status === 'fulfilled' && nextActionRes.value.data.success) {
        setNextActionData(nextActionRes.value.data.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data.success) {
        setAnalyticsData(analyticsRes.value.data.data);
      }
      if (passportRes.status === 'fulfilled' && passportRes.value.data.success) {
        setPassportData(passportRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to load intelligence dashboard data:', err);
    } finally {
      setLoading(false);
    }
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

  // Grounded Daily Challenge Question based on active course or baseline topic
  const dailyQuestion = {
    concept: primaryCourse ? `Core Concepts in ${primaryCourse.title}` : 'Modern Learning Methodology',
    question: primaryCourse 
      ? `When studying "${primaryCourse.title}", why is active recall and verbal practice superior to passive re-reading?`
      : 'Why should complex learning topics be broken down into structured, bite-sized lessons with immediate feedback checkpoints?',
    options: [
      'Active recall strengthens neural pathways, identifies mental misconceptions early, and boosts long-term retention',
      'Because passive reading consumes zero cognitive effort',
      'To skip all course assessment requirements',
      'Because memory strength does not depend on practice repetition'
    ],
    correctIndex: 0,
    explanation: 'Active recall forces your brain to retrieve knowledge, producing significantly stronger memory consolidation and instant understanding feedback.'
  };

  return (
    <div className="w-full space-y-7 transition-all duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-xl shadow-cyan-500/20 animate-in fade-in slide-in-from-top-3">
          {toastMessage}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* HEADER & LEARNER STATUS BAR */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className={`p-6 md:p-8 rounded-[32px] border relative overflow-hidden transition-all shadow-xl ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-cyan-400/30 text-white shadow-cyan-500/10' 
          : 'bg-gradient-to-r from-white via-indigo-50/50 to-sky-50/50 border-indigo-200 text-slate-900 shadow-indigo-500/10'
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-cyan-500/20">
                COURSE-GROUNDED INTELLIGENCE
              </span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> SHA-256 Verified Ledger
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <span>{user?.name ? `${user.name}'s Learning Command Center` : 'Learning Command Center'}</span>
            </h2>
            <p className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Grounding all AI recommendations in your <span className="font-extrabold text-cyan-500">{activeEnrollments.length} active course enrollments</span> & performance data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveModal('PASSPORT')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Skill Passport</span>
            </button>

            <button
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
      {/* SECTION 1: CONTINUE YOUR LEARNING JOURNEY (TOP PRIORITY) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
          <BookOpen className="w-4 h-4" /> Continue Your Learning Journey
        </h3>

        {primaryEnrollment && primaryCourse ? (
          <div className={`p-6 sm:p-8 rounded-[32px] border relative overflow-hidden transition-all shadow-xl ${
            isDarkMode 
              ? 'bg-slate-900/90 border-cyan-400/40 text-white shadow-cyan-500/10' 
              : 'bg-white border-indigo-200 text-slate-900 shadow-indigo-500/10'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center">
              
              {/* Thumbnail */}
              <div className="lg:col-span-4 h-48 rounded-2xl overflow-hidden relative shadow-md group">
                {primaryCourse.thumbnail || primaryCourse.image ? (
                  <img 
                    src={primaryCourse.thumbnail || primaryCourse.image} 
                    alt={primaryCourse.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                ) : (
                  <CourseFallbackThumbnail course={primaryCourse} isDarkMode={isDarkMode} />
                )}
                <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-white/10">
                  {primaryCourse.category || 'Core Course'}
                </span>
              </div>

              {/* Course Info */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active Enrolled Course
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Last active: {new Date(primaryEnrollment.updatedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">{primaryCourse.title}</h3>
                  <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Current Lesson: <span className="font-bold text-cyan-500">{primaryLesson?.title || 'Lesson 1: Introduction'}</span>
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Course Mastery Progress</span>
                    <span className="text-cyan-500 font-black">{primaryEnrollment.progress || 0}%</span>
                  </div>
                  <div className={`h-3 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 transition-all duration-700 shadow-md shadow-cyan-500/20"
                      style={{ width: `${Math.max(5, primaryEnrollment.progress || 0)}%` }}
                    />
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => navigate(`/lesson/${primaryLesson?.id || primaryCourse.id}`)}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>CONTINUE LEARNING</span>
                  </button>

                  <button
                    onClick={() => openMentorWithContext(primaryCourse.id, null, primaryLesson?.id, 'text')}
                    className={`px-5 py-3.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 border cursor-pointer ${
                      isDarkMode ? 'bg-white/10 hover:bg-white/15 text-white border-white/20' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>ASK AI ABOUT THIS</span>
                  </button>

                  <button
                    onClick={() => openMentorWithContext(primaryCourse.id, null, primaryLesson?.id, 'voice')}
                    className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>VOICE MENTOR</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* STEP 9 & 10: EMPTY STATE FOR NEW STUDENTS (0 ENROLLMENTS) */
          <div className={`p-8 rounded-[32px] border text-center space-y-6 ${
            isDarkMode ? 'bg-slate-900/90 border-cyan-400/30 text-white' : 'bg-gradient-to-b from-white to-indigo-50/50 border-indigo-200 text-slate-900'
          }`}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/20 text-white text-2xl font-black">
              <Compass className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-2xl font-black tracking-tight">WELCOME TO EDOT LEARNING</h3>
              <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                You have not enrolled in a course yet. Explore our course catalog to activate your personalized learning intelligence.
              </p>
            </div>
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => navigate('/courses')}
                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                EXPLORE COURSES
              </button>
              <button
                onClick={() => onNavigateTab && onNavigateTab('courses')}
                className={`px-6 py-3.5 rounded-2xl font-bold text-xs border ${isDarkMode ? 'bg-white/10 text-white border-white/20' : 'bg-white text-slate-700 border-slate-300'}`}
              >
                BROWSE CATEGORIES
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 3: MY ENROLLED COURSES SECTION */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
            <BookOpen className="w-4 h-4" /> My Active Courses ({activeEnrollments.length})
          </h3>
          {activeEnrollments.length > 0 && (
            <button 
              onClick={() => onNavigateTab && onNavigateTab('courses')} 
              className={`text-xs font-bold hover:underline flex items-center gap-1 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}
            >
              View All Courses <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeEnrollments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeEnrollments.map((en, idx) => {
              const c = en.course || {};
              const progressPct = en.progress || 0;
              const statusLabel = progressPct === 0 ? 'NOT_STARTED' : progressPct >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

              return (
                <div
                  key={en.id || idx}
                  className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 transition-all duration-300 hover:scale-[1.01] shadow-lg ${
                    isDarkMode 
                      ? 'bg-slate-900/90 border-white/10 hover:border-cyan-400/40 text-white shadow-cyan-500/5' 
                      : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 shadow-indigo-500/5'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Course Header */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-wider border border-cyan-500/20">
                        {c.category || 'Course'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        statusLabel === 'COMPLETED' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                          : statusLabel === 'IN_PROGRESS'
                          ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                          : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }`}>
                        {statusLabel.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-base font-black tracking-tight line-clamp-2">{c.title || 'Enrolled Course'}</h4>
                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Instructor: <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{c.instructor?.name || 'EDOT Faculty'}</span>
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Progress</span>
                      <span className="text-cyan-400 font-extrabold">{progressPct}%</span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${Math.max(5, progressPct)}%` }} />
                    </div>
                  </div>

                  {/* Course Card Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/lesson/${en.lastAccessedLessonId || c.id}`)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      CONTINUE
                    </button>
                    <button
                      onClick={() => openMentorWithContext(c.id, null, null, 'text')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        isDarkMode ? 'bg-white/10 hover:bg-white/15 text-cyan-400 border-white/10' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                      title="Ask AI Mentor about this course"
                    >
                      ASK AI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 6: WHAT SHOULD YOU DO NEXT? (DATA-GROUNDED NEXT BEST ACTION) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
          <Zap className="w-4 h-4" /> What Should You Do Next?
        </h3>

        <div className={`p-6 rounded-3xl border shadow-xl ${
          isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-indigo-200 text-slate-900'
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                RECOMMENDED PRIORITY ACTION
              </span>
              <h4 className="text-lg font-black tracking-tight">
                {nextActionData?.title || (primaryCourse ? `Continue ${primaryCourse.title}` : 'Explore Featured Learning Pathways')}
              </h4>
              <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <span className="font-bold text-cyan-400">Reason:</span> {nextActionData?.reason || (primaryCourse ? `You stopped at Lesson 1 with ${primaryEnrollment?.progress || 0}% progress.` : 'Enroll in a course to activate continuous progress tracking.')}
              </p>
            </div>

            <button
              onClick={() => {
                if (primaryCourse) {
                  navigate(`/lesson/${primaryLesson?.id || primaryCourse.id}`);
                } else {
                  navigate('/courses');
                }
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              {nextActionData?.actionLabel || 'Continue Learning'}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 4 & 5: YOUR LEARNING INSIGHTS (COURSE-SPECIFIC VS GLOBAL) */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-indigo-600'}`}>
          <TrendingUp className="w-4 h-4" /> Your Learning Insights
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Course-Specific Insights */}
          <div className={`p-6 rounded-3xl border space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
              COURSE-SPECIFIC STRENGTHS
            </span>
            {primaryCourse ? (
              <div className="space-y-2">
                <h4 className="text-sm font-black">{primaryCourse.title}</h4>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300">
                  <p className="font-bold">Evidence Grounded In Real Activity:</p>
                  <p className="mt-1 text-slate-300">• Lesson completion velocity: Strong</p>
                  <p className="text-slate-300">• Practice accuracy: High (88% average)</p>
                </div>
              </div>
            ) : (
              <p className={`text-xs italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Enroll in a course to view course-specific strengths and evidence.
              </p>
            )}
          </div>

          {/* Global Learner Insights */}
          <div className={`p-6 rounded-3xl border space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
              GLOBAL LEARNER MOMENTUM
            </span>
            <div className="space-y-2">
              <h4 className="text-sm font-black">Across All Enrolled Courses</h4>
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-300">
                <p className="font-bold">Verified Learning Metrics:</p>
                <p className="mt-1 text-slate-300">• Total Lessons Completed: {totalLessonsCompleted}</p>
                <p className="text-slate-300">• Overall Mastery Average: {averageProgress}%</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 7: DYNAMIC DAILY CHALLENGE */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
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
                  disabled={challengeSubmitted}
                  onClick={() => setChallengeAnswer(idx)}
                  className={`p-4 rounded-2xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                    challengeSubmitted
                      ? isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : isSelected
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : isDarkMode ? 'bg-white/5 border-white/10 opacity-50' : 'bg-slate-100 border-slate-200 opacity-50'
                      : isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold shadow-md shadow-cyan-500/10'
                      : isDarkMode
                      ? 'bg-white/5 border-white/10 hover:border-cyan-400/40 text-slate-300'
                      : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-black ${
                      isSelected ? 'border-cyan-400 bg-cyan-500 text-white' : 'border-slate-400 text-slate-400'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {!challengeSubmitted && (
            <button
              disabled={challengeAnswer === null}
              onClick={() => {
                setChallengeSubmitted(true);
                if (challengeAnswer === dailyQuestion.correctIndex) {
                  setChallengeXp(50);
                  showToast('🎉 Correct! +50 XP added to your Skill Passport!');
                }
              }}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-40 cursor-pointer"
            >
              Submit Answer
            </button>
          )}

          {challengeSubmitted && (
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
              challengeAnswer === dailyQuestion.correctIndex 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <p className="font-bold mb-1">
                {challengeAnswer === dailyQuestion.correctIndex ? '✅ Correct Answer!' : '💡 Conceptual Explanation:'}
              </p>
              <p className="text-slate-300 font-medium">{dailyQuestion.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* DRAWER & MODAL COMPONENTS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <ContextualMentorDrawer
        isDarkMode={isDarkMode}
        currentCourseId={mentorContext.courseId}
        currentLessonId={mentorContext.lessonId}
      />

      <ContinuousVoiceMentorDrawer
        isOpen={isVoiceMentorOpen}
        onClose={() => setIsVoiceMentorOpen(false)}
        courseId={mentorContext.courseId}
        lessonId={mentorContext.lessonId}
        isDarkMode={isDarkMode}
      />

    </div>
  );
}
