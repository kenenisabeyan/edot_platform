/**
 * IntelligenceHubView.jsx
 *
 * EDOT Intelligence Hub — Unified Gateway to all 13 Intelligence Nodes.
 * Phase 0–21 backend APIs are fully wired per node.
 *
 * Architecture:
 *  - Each subview manages its own data-fetching lifecycle (useState + useEffect)
 *  - AbortController prevents stale requests
 *  - Every API call has graceful error handling and empty-state handling
 *  - No hardcoded demo data; all content is live from the existing intelligence backend
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Routes, Route, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useThemeMode from '../hooks/useThemeMode';
import ErrorBoundary from '../components/ErrorBoundary';
import CareerCenter from './CareerCenter';
import AdminIntelligenceDashboard from './AdminIntelligenceDashboard';
import ParentInsightGrid from '../components/ParentInsightGrid';
import api from '../utils/api';
import {
  Sparkles, TrendingUp, Brain, Target, Bot, Lightbulb, Compass, Flame,
  Users, Rocket, Briefcase, Globe, BarChart3, ArrowRight, CheckCircle2,
  BookOpen, Zap, Clock, PlayCircle, Loader2, AlertCircle, RefreshCw,
  Activity, Send, MessageSquare, Award, ShieldCheck, ChevronRight,
  Layers, FileText, GitBranch, Star, Bell, XCircle, Circle, CheckSquare,
  TrendingDown, Eye, Plus, GraduationCap, User, Calendar, Hash
} from 'lucide-react';

/* ─── Navigation Config ─────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: 'next-step', label: 'Your Next Best Step', icon: Sparkles, path: '/dashboard/intelligence/next-step' },
  { id: 'progress', label: 'My Progress', icon: TrendingUp, path: '/dashboard/intelligence/progress' },
  { id: 'mastery', label: 'My Mastery', icon: Brain, path: '/dashboard/intelligence/mastery' },
  { id: 'skills', label: 'My Skills', icon: Target, path: '/dashboard/intelligence/skills' },
  { id: 'mentor', label: 'AI Mentor', icon: Bot, path: '/dashboard/intelligence/mentor' },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, path: '/dashboard/intelligence/recommendations' },
  { id: 'learning-path', label: 'Learning Path', icon: Compass, path: '/dashboard/intelligence/learning-path' },
  { id: 'pulse', label: 'Learning Pulse', icon: Flame, path: '/dashboard/intelligence/pulse' },
  { id: 'mentors', label: 'Mentors & Collaboration', icon: Users, path: '/dashboard/intelligence/mentors' },
  { id: 'projects', label: 'Projects & Experience', icon: Rocket, path: '/dashboard/intelligence/projects' },
  { id: 'career', label: 'Career Readiness', icon: Briefcase, path: '/dashboard/intelligence/career' },
  { id: 'opportunities', label: 'Opportunities', icon: Globe, path: '/dashboard/intelligence/opportunities' },
  { id: 'insights', label: 'Insights', icon: BarChart3, path: '/dashboard/intelligence/insights' },
];

/* ─── Shared Utilities ───────────────────────────────────────────────────────── */

function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data?.data ?? res.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

function LoadingPane({ isDarkMode }) {
  return (
    <div className={`flex items-center justify-center py-24 rounded-3xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
        <span className="text-sm font-medium">Loading intelligence data…</span>
      </div>
    </div>
  );
}

function ErrorPane({ error, onRetry, isDarkMode }) {
  return (
    <div className={`p-6 rounded-3xl border flex flex-col items-center gap-4 py-16 ${isDarkMode ? 'bg-[#0F172A] border-red-900/40' : 'bg-red-50 border-red-200'}`}>
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm font-medium text-slate-400">{error || 'Something went wrong'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-2 hover:bg-slate-700 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

function EmptyPane({ message, isDarkMode }) {
  return (
    <div className={`p-6 rounded-3xl border flex flex-col items-center gap-3 py-16 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
      <Circle className="w-10 h-10 text-slate-600" />
      <p className="text-sm font-medium text-slate-400">{message || 'No data available yet. Keep learning to build your profile.'}</p>
    </div>
  );
}

function SectionHeader({ label, isDarkMode }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest mb-2 ${isDarkMode ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-emerald-100 text-emerald-700'}`}>
      {label}
    </div>
  );
}

function MetricTile({ label, value, sub, color, isDarkMode }) {
  return (
    <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`text-2xl font-black ${color || (isDarkMode ? 'text-white' : 'text-slate-900')}`}>{value ?? '—'}</div>
      <div className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── Main Hub Shell ─────────────────────────────────────────────────────────── */

export default function IntelligenceHubView() {
  const { user } = useAuth();
  const isDarkMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role ? user.role.toLowerCase().trim() : 'student';
  const activePath = location.pathname;

  return (
    <div className={`min-h-screen p-4 md:p-8 space-y-6 transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Top Banner */}
      <div className={`p-6 md:p-8 rounded-3xl relative overflow-hidden border backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl ${isDarkMode ? 'bg-[#0F172A]/80 border-slate-800' : 'bg-gradient-to-r from-emerald-900 via-slate-900 to-blue-950 text-white border-slate-700'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_30%_30%,#00D4FF,transparent_70%)]" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> EDOT Intelligence Core
            </span>
            <span className="text-xs font-medium text-slate-300">Phase 0–21 Ecosystem</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
            <span>Intelligence Hub</span>
            <Sparkles className="w-6 h-6 text-[#00D4FF] animate-pulse" />
          </h1>
          <p className="text-sm text-slate-300 font-medium">
            {role === 'admin' ? 'Platform intelligence pipeline, learning analytics, and course health registry.' :
             role === 'instructor' ? 'Class learning health, student support signals, and course engagement insights.' :
             role === 'parent' ? 'Authorized learner progress summary, milestones, and support recommendations.' :
             role === 'sponsor' ? 'Aggregated program outcomes, skill acquisition trends, and impact metrics.' :
             'Your personalized command center for skill mastery, learning path growth, and next best steps.'}
          </p>
        </div>
        <div className="relative z-10">
          <button type="button" onClick={() => navigate('/dashboard/intelligence')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all ${
              activePath === '/dashboard/intelligence' || activePath === '/dashboard/intelligence/'
                ? 'bg-[#22C55E] text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <Brain className="w-4 h-4" /> Hub Overview
          </button>
        </div>
      </div>

      {/* Nav Pills */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 min-w-max">
          {NAV_ITEMS.map((nav) => {
            const Icon = nav.icon;
            const isActive = activePath === nav.path || activePath.startsWith(nav.path + '/');
            return (
              <NavLink key={nav.id} to={nav.path}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border ${
                  isActive
                    ? isDarkMode ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40 scale-105' : 'bg-emerald-100 text-emerald-700 border-emerald-300 scale-105'
                    : isDarkMode ? 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#22C55E]' : 'text-slate-400'}`} />
                <span>{nav.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Subview Routes */}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HubLanding role={role} isDarkMode={isDarkMode} user={user} />} />
          <Route path="next-step" element={<NextBestStepView isDarkMode={isDarkMode} user={user} />} />
          <Route path="progress" element={<ProgressView isDarkMode={isDarkMode} user={user} />} />
          <Route path="mastery" element={<MasteryView isDarkMode={isDarkMode} user={user} />} />
          <Route path="skills" element={<SkillsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="mentor" element={<AIMentorView isDarkMode={isDarkMode} user={user} />} />
          <Route path="recommendations" element={<RecommendationsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="learning-path" element={<LearningPathView isDarkMode={isDarkMode} user={user} />} />
          <Route path="pulse" element={<LearningPulseView isDarkMode={isDarkMode} user={user} />} />
          <Route path="mentors" element={<MentorsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="projects" element={<ProjectsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="career" element={<CareerReadinessView isDarkMode={isDarkMode} user={user} />} />
          <Route path="opportunities" element={<OpportunitiesView isDarkMode={isDarkMode} user={user} />} />
          <Route path="insights" element={<InsightsView isDarkMode={isDarkMode} user={user} role={role} />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HUB LANDING — Overview with live snapshot cards
═══════════════════════════════════════════════════════════════════════════════ */

function HubLanding({ role, isDarkMode, user }) {
  const navigate = useNavigate();
  const { data: analytics } = useFetch('/intelligence/analytics/me');
  const { data: nextAction } = useFetch('/intelligence/next-action/me');

  const card = `p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.01] cursor-pointer ${isDarkMode ? 'bg-[#0F172A]/80 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`;

  return (
    <div className="space-y-8">
      {/* Primary Next Best Step highlight */}
      <div className={`p-8 rounded-3xl border relative overflow-hidden shadow-2xl ${isDarkMode ? 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B1120] border-amber-500/30' : 'bg-gradient-to-r from-amber-50 via-white to-orange-50 border-amber-200'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-bounce" /> Primary Recommendation
          </div>
          <h2 className={`text-2xl md:text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Next Best Step</h2>
          <p className={`text-sm md:text-base font-medium max-w-2xl leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {nextAction?.description || nextAction?.action?.description || 'Continue building your learning momentum — explore your personalized next step.'}
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/dashboard/intelligence/next-step')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105">
              <span>Take Next Step</span><ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => navigate('/dashboard/intelligence/mentor')}
              className={`px-5 py-3 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Bot className="w-4 h-4 text-cyan-500" /><span>Ask AI Mentor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricTile label="Engagement" value={`${analytics.engagementScore ?? 0}%`} sub="Weekly activity level" color="text-emerald-400" isDarkMode={isDarkMode} />
          <MetricTile label="Consistency" value={`${analytics.consistencyScore ?? 0}%`} sub="Study rhythm score" color="text-sky-400" isDarkMode={isDarkMode} />
          <MetricTile label="Momentum" value={`${analytics.momentumScore ?? 0}%`} sub="Combined growth signal" color="text-violet-400" isDarkMode={isDarkMode} />
          <MetricTile label="Risk Level" value={analytics.riskLevel ? analytics.riskLevel.charAt(0).toUpperCase() + analytics.riskLevel.slice(1) : '—'} sub="Learning health status" color={analytics.riskLevel === 'high' ? 'text-red-400' : analytics.riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400'} isDarkMode={isDarkMode} />
        </div>
      )}

      {/* Node grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {NAV_ITEMS.map((nav) => {
          const Icon = nav.icon;
          return (
            <div key={nav.id} onClick={() => navigate(nav.path)} className={card}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-[#22C55E]/10' : 'bg-emerald-100'}`}>
                  <Icon className="w-5 h-5 text-[#22C55E]" />
                </div>
                <div>
                  <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{nav.label}</div>
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>Open</span><ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   1. NEXT BEST STEP — /api/intelligence/next-action/me + /personal-learning/plan
═══════════════════════════════════════════════════════════════════════════════ */

function NextBestStepView({ isDarkMode, user }) {
  const { data: nextAction, loading, error, refetch } = useFetch('/intelligence/next-action/me');
  const { data: plan } = useFetch('/intelligence/personal-learning/plan');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const action = nextAction?.action || nextAction || {};
  const planItems = plan?.actions || plan?.items || [];

  return (
    <div className="space-y-6">
      <SectionHeader label="Your Next Best Step" isDarkMode={isDarkMode} />

      {/* Primary action card */}
      <div className={`p-8 rounded-3xl border relative overflow-hidden shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-amber-900/20 to-[#0F172A] border-amber-500/30' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'}`}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700'}`}>
            <Zap className="w-3.5 h-3.5" />
            {action.urgency || action.priority || 'Recommended'}
          </div>
          <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {action.title || action.type || 'Continue your learning journey'}
          </h2>
          <p className={`text-base leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {action.description || action.reason || 'Based on your current progress, quiz performance, and study consistency, this is your most impactful next move.'}
          </p>
          {(action.courseTitle || action.courseName) && (
            <div className={`flex items-center gap-2 text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <BookOpen className="w-4 h-4 text-[#22C55E]" />
              <span>Course: {action.courseTitle || action.courseName}</span>
            </div>
          )}
          {action.lessonTitle && (
            <div className={`flex items-center gap-2 text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <PlayCircle className="w-4 h-4 text-cyan-400" />
              <span>Lesson: {action.lessonTitle}</span>
            </div>
          )}
          {action.courseId && (
            <Link to={`/dashboard/courses/${action.courseId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E] text-slate-950 font-black text-sm hover:opacity-90 transition-all hover:scale-105">
              <PlayCircle className="w-4 h-4" /> Start Now
            </Link>
          )}
        </div>
      </div>

      {/* Learning plan items */}
      {planItems.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Active Learning Plan</h3>
          <div className="space-y-3">
            {planItems.slice(0, 6).map((item, i) => (
              <div key={item.id || i} className={`p-4 rounded-2xl border flex items-start gap-4 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/30 text-slate-400'}`}>
                  {item.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-black">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.title || item.type}</div>
                  {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' : item.status === 'STARTED' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700/30 text-slate-400'}`}>
                  {item.status || 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!action.title && !planItems.length && (
        <EmptyPane message="No next action computed yet. Complete a few lessons or quizzes to activate your personalized intelligence." isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   2. MY PROGRESS — /api/intelligence/analytics/me + /learning-summary/me
═══════════════════════════════════════════════════════════════════════════════ */

function ProgressView({ isDarkMode }) {
  const { data: analytics, loading: aLoading, error: aError, refetch } = useFetch('/intelligence/analytics/me');
  const { data: summary, loading: sLoading } = useFetch('/intelligence/learning-summary/me');

  if (aLoading || sLoading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (aError) return <ErrorPane error={aError} onRetry={refetch} isDarkMode={isDarkMode} />;

  const courses = summary?.courses || summary?.courseProgress || [];
  const riskColor = analytics?.riskLevel === 'high' ? 'text-red-400' : analytics?.riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="space-y-6">
      <SectionHeader label="My Progress" isDarkMode={isDarkMode} />

      {/* Metric tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricTile label="Engagement Score" value={`${analytics?.engagementScore ?? 0}%`} sub="Weekly activity level" color="text-emerald-400" isDarkMode={isDarkMode} />
        <MetricTile label="Consistency Score" value={`${analytics?.consistencyScore ?? 0}%`} sub="Study rhythm regularity" color="text-sky-400" isDarkMode={isDarkMode} />
        <MetricTile label="Momentum Score" value={`${analytics?.momentumScore ?? 0}%`} sub="Combined growth signal" color="text-violet-400" isDarkMode={isDarkMode} />
        <MetricTile label="Risk Level" value={analytics?.riskLevel ? analytics.riskLevel.charAt(0).toUpperCase() + analytics.riskLevel.slice(1) : '—'} sub="Learning health status" color={riskColor} isDarkMode={isDarkMode} />
      </div>

      {/* Risk factors */}
      {analytics?.riskFactors?.length > 0 && (
        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-amber-900/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-black text-amber-400">Risk Signals Detected</span>
          </div>
          <ul className="space-y-1">
            {analytics.riskFactors.map((rf, i) => (
              <li key={i} className="text-sm text-amber-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{rf}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-course progress */}
      {courses.length > 0 ? (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Course Progress</h3>
          {courses.map((course, i) => {
            const pct = Math.round(course.progressPercent || course.progress || 0);
            return (
              <div key={course.courseId || course.id || i} className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.courseTitle || course.title}</div>
                    {course.completedLessons !== undefined && (
                      <div className="text-xs text-slate-400 mt-0.5">{course.completedLessons} / {course.totalLessons} lessons complete</div>
                    )}
                  </div>
                  <span className={`text-lg font-black ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
                </div>
                <div className="w-full bg-slate-700/30 h-2.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPane message="Enroll in courses and complete lessons to see detailed progress analytics here." isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   3. MY MASTERY — /api/intelligence/mastery/student/:id + /mastery/recommendations
═══════════════════════════════════════════════════════════════════════════════ */

function MasteryView({ isDarkMode, user }) {
  const { data: masteries, loading, error, refetch } = useFetch(user?.id ? `/intelligence/mastery/student/${user.id}` : null);
  const { data: recs } = useFetch('/intelligence/mastery/recommendations');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const masteryList = Array.isArray(masteries) ? masteries : masteries?.masteries || [];
  const recList = Array.isArray(recs) ? recs : recs?.recommendations || [];

  const masteryLevels = { MASTERED: { label: 'Mastered', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }, PROFICIENT: { label: 'Proficient', color: 'text-sky-400', bg: 'bg-sky-500/10' }, DEVELOPING: { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/10' }, NOVICE: { label: 'Novice', color: 'text-red-400', bg: 'bg-red-500/10' } };

  return (
    <div className="space-y-6">
      <SectionHeader label="My Mastery" isDarkMode={isDarkMode} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(masteryLevels).map(([lvl, cfg]) => {
          const count = masteryList.filter(m => m.masteryLevel === lvl || m.level === lvl).length;
          return <MetricTile key={lvl} label={cfg.label} value={count} sub="concepts" color={cfg.color} isDarkMode={isDarkMode} />;
        })}
      </div>

      {masteryList.length > 0 ? (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Concept Mastery Records</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {masteryList.map((m, i) => {
              const lvl = m.masteryLevel || m.level || 'DEVELOPING';
              const cfg = masteryLevels[lvl] || masteryLevels.DEVELOPING;
              const score = Math.round(m.confidenceScore ?? m.score ?? 0);
              return (
                <div key={m.id || i} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{m.conceptName || m.concept || m.nodeId}</div>
                      {m.courseName && <div className="text-xs text-slate-400 mt-0.5">{m.courseName}</div>}
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-400">Confidence</span>
                      <span className={cfg.color}>{score}%</span>
                    </div>
                    <div className="w-full bg-slate-700/30 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${lvl === 'MASTERED' ? 'bg-emerald-500' : lvl === 'PROFICIENT' ? 'bg-sky-500' : lvl === 'DEVELOPING' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                  {m.evidenceCount !== undefined && (
                    <div className="text-xs text-slate-500 mt-2">{m.evidenceCount} evidence points</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyPane message="Answer quiz questions and complete lessons to build your concept mastery records." isDarkMode={isDarkMode} />
      )}

      {recList.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Mastery Recommendations</h3>
          {recList.slice(0, 4).map((rec, i) => (
            <div key={rec.id || i} className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{rec.title || rec.concept}</div>
                {rec.reason && <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   4. MY SKILLS — /api/intelligence/career/skills/me + /intelligence/learner-profile/me
═══════════════════════════════════════════════════════════════════════════════ */

function SkillsView({ isDarkMode }) {
  const { data: careerSkills, loading, error, refetch } = useFetch('/intelligence/career/skills/me');
  const { data: learnerProfile } = useFetch('/intelligence/learner-profile/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const skills = careerSkills?.skills || careerSkills?.verifiedSkills || (Array.isArray(careerSkills) ? careerSkills : []);
  const profileSkills = learnerProfile?.profile?.skills || [];
  const weaknesses = learnerProfile?.profile?.weaknessEntries || [];

  const profConfig = {
    master: { label: 'Master', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    advanced: { label: 'Advanced', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    intermediate: { label: 'Practitioner', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    beginner: { label: 'Novice', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  };

  const allSkills = skills.length > 0 ? skills : profileSkills;

  return (
    <div className="space-y-6">
      <SectionHeader label="My Skills" isDarkMode={isDarkMode} />

      {allSkills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allSkills.map((skill, i) => {
            const profKey = (skill.proficiencyLevel || skill.level || 'beginner').toLowerCase();
            const cfg = profConfig[profKey] || profConfig.beginner;
            const score = Math.round(skill.masteryScore ?? skill.score ?? 0);
            return (
              <div key={skill.id || skill.name || i} className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{skill.name || skill.skillName}</div>
                    {skill.category && <div className="text-xs text-slate-400 mt-0.5">{skill.category}</div>}
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-400">Mastery</span>
                    <span className={cfg.color}>{score}%</span>
                  </div>
                  <div className="w-full bg-slate-700/30 h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-all duration-700" style={{ width: `${score}%` }} />
                  </div>
                </div>
                {skill.evidenceCount !== undefined && (
                  <div className="text-xs text-slate-500 mt-2">{skill.evidenceCount} evidence points</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPane message="Complete quizzes and lessons to build your verified skill profile." isDarkMode={isDarkMode} />
      )}

      {weaknesses.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Improvement Areas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weaknesses.map((w, i) => (
              <div key={w.id || i} className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#0F172A] border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
                <TrendingDown className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{w.topic}</div>
                  <div className="text-xs text-slate-400">{w.severity} severity · {w.category || 'Learning gap'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   5. AI MENTOR — Real chat backed by /api/mentor/chat + /api/mentor/conversations
═══════════════════════════════════════════════════════════════════════════════ */

function AIMentorView({ isDarkMode, user }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api.get('/mentor/conversations').then(res => {
      if (!mounted) return;
      const convs = res.data?.data || [];
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConvId(convs[0].id);
        setMessages(convs[0].messages || []);
      }
    }).catch(() => {}).finally(() => { if (mounted) setLoadingConvs(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const userMsg = { role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    try {
      const res = await api.post('/mentor/chat', { message: trimmed, conversationId: activeConvId });
      const { conversationId: newConvId, reply } = res.data?.data || {};
      if (newConvId) setActiveConvId(newConvId);
      setMessages(prev => [...prev, { role: 'assistant', content: reply || 'Sorry, I could not generate a response.', createdAt: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error. Please try again.', createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const sendFeedback = async (feedbackType, details = '') => {
    try {
      await api.post('/mentor/feedback', { feedbackType, details });
      setMessages(prev => [...prev, { role: 'assistant', content: `Got it! I've updated your learning preferences for ${feedbackType.toLowerCase().replace(/_/g, ' ')}. How else can I help?`, createdAt: new Date().toISOString() }]);
    } catch {
      // silent fail
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader label="AI Mentor" isDarkMode={isDarkMode} />
        <button type="button" onClick={startNewChat}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
          <Plus className="w-3.5 h-3.5" /> New Session
        </button>
      </div>

      <div className={`rounded-3xl border overflow-hidden shadow-xl flex ${isDarkMode ? 'bg-[#0A0F1A] border-slate-800' : 'bg-white border-slate-200'}`} style={{ height: '70vh' }}>

        {/* Sidebar: conversation history */}
        <div className={`w-64 shrink-0 border-r overflow-y-auto ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`p-4 border-b text-xs font-black uppercase tracking-widest ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Chat History
          </div>
          {loadingConvs && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
          {!loadingConvs && conversations.map(conv => (
            <button type="button" key={conv.id}
              onClick={() => { setActiveConvId(conv.id); setMessages(conv.messages || []); }}
              className={`w-full text-left px-4 py-3 border-b transition-colors cursor-pointer ${activeConvId === conv.id ? isDarkMode ? 'bg-[#22C55E]/10 border-[#22C55E]/20' : 'bg-emerald-50 border-emerald-100' : isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-100'}`}>
              <div className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{conv.title || conv.topic || 'Session'}</div>
              <div className="text-xs text-slate-400 mt-0.5">{conv.messageCount || 0} messages</div>
            </button>
          ))}
          {!loadingConvs && conversations.length === 0 && (
            <div className="p-4 text-xs text-slate-500">No sessions yet. Start a conversation!</div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className={`w-14 h-14 rounded-3xl flex items-center justify-center ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100'}`}>
                  <Bot className="w-7 h-7 text-cyan-400" />
                </div>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>EDOT AI Mentor is ready</p>
                <p className="text-xs text-slate-400 max-w-xs">Ask me anything — a concept, a topic, your next step, or how to solve a problem from your current course.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${msg.role === 'user' ? (isDarkMode ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-emerald-100 text-emerald-700') : (isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700')}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? (isDarkMode ? 'bg-[#22C55E]/15 text-slate-200' : 'bg-emerald-100 text-slate-800') : (isDarkMode ? 'bg-[#1E293B] text-slate-300' : 'bg-slate-100 text-slate-800')}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
                {msg.role === 'assistant' && i === messages.length - 1 && !sending && (
                  <div className="flex items-center gap-2 mt-2 ml-11 flex-wrap">
                    <button type="button" onClick={() => sendFeedback('TOO_DIFFICULT', 'Explanation was too difficult')}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                      Too difficult
                    </button>
                    <button type="button" onClick={() => sendFeedback('ALREADY_KNOW_THIS', 'Already know this concept')}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                      Already know this
                    </button>
                    <button type="button" onClick={() => sendFeedback('NEED_PRACTICE', 'Need more practice')}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                      Give me an example
                    </button>
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                  <Bot className="w-4 h-4" />
                </div>
                <div className={`px-4 py-3 rounded-2xl flex items-center gap-2 ${isDarkMode ? 'bg-[#1E293B] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={`border-t p-4 ${isDarkMode ? 'border-slate-800 bg-[#0F172A]' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`flex items-end gap-3 rounded-2xl border px-4 py-3 ${isDarkMode ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-300'}`}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={1}
                placeholder="Ask your AI Mentor anything…"
                className={`flex-1 bg-transparent resize-none text-sm outline-none ${isDarkMode ? 'text-slate-200 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
              />
              <button type="button" onClick={sendMessage} disabled={!input.trim() || sending}
                className="p-2.5 rounded-xl bg-[#22C55E] text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16a34a] transition-all cursor-pointer shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   6. RECOMMENDATIONS — /api/intelligence/personal-learning/recommendations + /api/recommendations/me
═══════════════════════════════════════════════════════════════════════════════ */

function RecommendationsView({ isDarkMode }) {
  const { data: plRecs, loading, error, refetch } = useFetch('/intelligence/personal-learning/recommendations');
  const { data: courseRecs } = useFetch('/recommendations/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const actions = Array.isArray(plRecs) ? plRecs : plRecs?.actions || plRecs?.recommendations || [];
  const courses = courseRecs?.courses || [];

  const handleAction = async (id, lifecycle) => {
    try { await api.post(`/intelligence/personal-learning/recommendations/${id}/${lifecycle}`); } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Recommendations" isDarkMode={isDarkMode} />

      {/* Ranked learning actions */}
      {actions.length > 0 ? (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Personalized Learning Actions</h3>
          {actions.map((action, i) => (
            <div key={action.id || i} className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#22C55E]/10' : 'bg-emerald-100'}`}>
                  <span className="text-[#22C55E] font-black text-sm">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{action.title || action.type}</div>
                  {action.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{action.description}</p>}
                  {action.reason && <p className="text-xs text-amber-400 mt-1">Why: {action.reason}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    {action.id && (
                      <>
                        <button type="button" onClick={() => handleAction(action.id, 'start')}
                          className="px-3 py-1.5 rounded-xl bg-[#22C55E]/15 text-[#22C55E] text-xs font-bold hover:bg-[#22C55E]/25 transition-all cursor-pointer">
                          Start
                        </button>
                        <button type="button" onClick={() => handleAction(action.id, 'dismiss')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          Dismiss
                        </button>
                      </>
                    )}
                    {action.priority && (
                      <span className={`text-xs font-bold ${action.priority === 'HIGH' ? 'text-red-400' : action.priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'}`}>
                        {action.priority} priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPane message="Your personalized action recommendations will appear here as you progress through courses." isDarkMode={isDarkMode} />
      )}

      {/* Course recommendations */}
      {courses.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recommended Courses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.slice(0, 6).map((course, i) => (
              <Link key={course.id || i} to={`/courses/${course.slug || course.id}`}
                className={`p-4 rounded-2xl border flex items-start gap-3 transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-[#0F172A] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <BookOpen className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className={`font-bold text-sm truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{course.reason || course.mainCategory}</div>
                  {course.score !== undefined && <div className="text-xs text-[#22C55E] font-bold mt-1">{course.score}% match</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   7. LEARNING PATH — /api/intelligence/personal-learning/plan + /adaptive-path/me
═══════════════════════════════════════════════════════════════════════════════ */

function LearningPathView({ isDarkMode }) {
  const { data: plan, loading, error, refetch } = useFetch('/intelligence/personal-learning/plan');
  const { data: adaptivePath } = useFetch('/intelligence/adaptive-path/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const planActions = plan?.actions || plan?.steps || plan?.items || [];
  const adaptiveSteps = adaptivePath?.sequence || adaptivePath?.steps || (Array.isArray(adaptivePath) ? adaptivePath : []);

  const handleComplete = async (id) => {
    try { await api.post(`/intelligence/personal-learning/recommendations/${id}/complete`); } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Learning Path" isDarkMode={isDarkMode} />

      {planActions.length > 0 ? (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Active Learning Plan</h3>
          <div className="relative">
            {planActions.map((step, i) => {
              const isComplete = step.status === 'COMPLETED';
              const isActive = step.status === 'STARTED';
              return (
                <div key={step.id || i} className="flex gap-4 mb-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-amber-500/20 text-amber-400' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                      {isComplete ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                    </div>
                    {i < planActions.length - 1 && <div className={`w-0.5 flex-1 min-h-[16px] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />}
                  </div>
                  <div className={`flex-1 p-4 rounded-2xl border mb-2 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{step.title || step.type}</div>
                        {step.description && <p className="text-xs text-slate-400 mt-1">{step.description}</p>}
                        {step.courseTitle && <div className="text-xs text-[#22C55E] mt-1 flex items-center gap-1"><BookOpen className="w-3 h-3" />{step.courseTitle}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isComplete ? 'bg-emerald-500/15 text-emerald-400' : isActive ? 'bg-amber-500/15 text-amber-400' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          {isComplete ? 'Done' : isActive ? 'In Progress' : 'Upcoming'}
                        </span>
                        {!isComplete && step.id && (
                          <button type="button" onClick={() => handleComplete(step.id)}
                            className="text-xs text-[#22C55E] font-bold hover:underline cursor-pointer">
                            Mark done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyPane message="Your adaptive learning plan will generate after you enroll in a course and start learning." isDarkMode={isDarkMode} />
      )}

      {adaptiveSteps.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Adaptive Sequence Suggestions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adaptiveSteps.slice(0, 6).map((step, i) => (
              <div key={step.lessonId || step.id || i} className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-100 text-sky-700'}`}>{i + 1}</div>
                <div className="min-w-0">
                  <div className={`font-bold text-sm truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{step.lessonTitle || step.title}</div>
                  {step.reason && <div className="text-xs text-slate-400 mt-0.5">{step.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   8. LEARNING PULSE — /api/intelligence/pulse/live-activity + fatigue + nudges
═══════════════════════════════════════════════════════════════════════════════ */

function LearningPulseView({ isDarkMode }) {
  const { data: liveActivity, loading, error, refetch } = useFetch('/intelligence/pulse/live-activity?limit=15');
  const { data: fatigue } = useFetch('/intelligence/pulse/fatigue-check/me');
  const { data: nudges } = useFetch('/intelligence/pulse/nudges/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const feed = Array.isArray(liveActivity) ? liveActivity : liveActivity?.events || liveActivity?.feed || [];
  const nudgeList = Array.isArray(nudges) ? nudges : nudges?.nudges || [];
  const fatigueLevel = fatigue?.fatigueLevel ?? fatigue?.level ?? null;
  const totalStudyMins = fatigue?.totalStudyMinutes ?? fatigue?.sessionMinutes ?? 0;

  const dismissNudge = async (nudgeId) => {
    try { await api.post(`/intelligence/pulse/nudges/${nudgeId}/dismiss`); } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Learning Pulse" isDarkMode={isDarkMode} />

      {/* Fatigue status */}
      {fatigue && (
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-base font-black mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Session Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricTile label="Fatigue Level" value={fatigueLevel != null ? `${fatigueLevel}%` : 'N/A'} sub="Current session stress" color={fatigueLevel > 70 ? 'text-red-400' : fatigueLevel > 40 ? 'text-amber-400' : 'text-emerald-400'} isDarkMode={isDarkMode} />
            <MetricTile label="Study Time" value={`${Math.round(totalStudyMins)}m`} sub="Active session duration" color="text-sky-400" isDarkMode={isDarkMode} />
            <MetricTile label="Recommendation" value={fatigue?.recommendation || fatigue?.message || (fatigueLevel > 70 ? 'Take a break' : 'Keep going!')} isDarkMode={isDarkMode} />
          </div>
        </div>
      )}

      {/* Nudges */}
      {nudgeList.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Active Nudges</h3>
          {nudgeList.map((nudge, i) => (
            <div key={nudge.id || i} className={`p-4 rounded-2xl border flex items-start gap-3 ${isDarkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
              <Bell className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{nudge.title || nudge.message}</div>
                {nudge.description && <p className="text-xs text-slate-400 mt-0.5">{nudge.description}</p>}
              </div>
              {nudge.id && (
                <button type="button" onClick={() => dismissNudge(nudge.id)}
                  className="shrink-0 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live activity feed */}
      {feed.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live Learning Activity</h3>
          </div>
          <div className="space-y-2">
            {feed.map((event, i) => (
              <div key={event.id || i} className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#22C55E]/10' : 'bg-emerald-100'}`}>
                  <Activity className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {event.eventType?.replace(/_/g, ' ') || event.type?.replace(/_/g, ' ') || 'Learning Event'}
                  </div>
                  {event.courseTitle && <div className="text-xs text-slate-400 mt-0.5">{event.courseTitle}</div>}
                  {event.progress !== undefined && <div className="text-xs text-[#22C55E] mt-0.5">{event.progress}% progress</div>}
                </div>
                {event.occurredAt && (
                  <div className="text-xs text-slate-500 shrink-0">
                    {new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyPane message="Start a lesson to see your live learning pulse activity feed appear here." isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   9. MENTORS & COLLABORATION — /api/mentor/conversations + /api/connections
═══════════════════════════════════════════════════════════════════════════════ */

function MentorsView({ isDarkMode }) {
  const navigate = useNavigate();
  const { data: conversations, loading, error, refetch } = useFetch('/mentor/conversations');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const convList = Array.isArray(conversations) ? conversations : conversations?.conversations || [];

  return (
    <div className="space-y-6">
      <SectionHeader label="Mentors & Collaboration" isDarkMode={isDarkMode} />

      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-gradient-to-br from-teal-900/20 to-[#0F172A] border-teal-700/30' : 'bg-gradient-to-br from-teal-50 to-white border-teal-200'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>AI Mentor Sessions</h3>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {convList.length} conversation{convList.length !== 1 ? 's' : ''} in your history
            </p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/intelligence/mentor')}
            className="px-5 py-2.5 rounded-2xl bg-[#22C55E] text-slate-950 font-black text-sm flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer">
            <Bot className="w-4 h-4" /> Open Mentor
          </button>
        </div>
      </div>

      {convList.length > 0 ? (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Sessions</h3>
          {convList.slice(0, 8).map((conv, i) => (
            <div key={conv.id || i} className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100'}`}>
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{conv.title || conv.topic || 'Mentor Session'}</div>
                    {conv.summary && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{conv.summary}</p>}
                    <div className="text-xs text-slate-500 mt-1">{conv.messageCount || 0} messages</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 shrink-0">
                  {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <EmptyPane message="No mentor sessions yet. Start a conversation with your AI Mentor to build your collaboration history." isDarkMode={isDarkMode} />
          <div className="text-center">
            <button type="button" onClick={() => navigate('/dashboard/intelligence/mentor')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black text-sm flex items-center gap-2 mx-auto hover:opacity-90 transition-all cursor-pointer">
              <Bot className="w-4 h-4" /> Start First Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   10. PROJECTS & EXPERIENCE — /api/v2/intelligence/projects/* 
═══════════════════════════════════════════════════════════════════════════════ */

function ProjectsView({ isDarkMode }) {
  const { data: recommendations, loading, error, refetch } = useFetch('/v2/intelligence/projects/recommendations/me');
  const { data: portfolio } = useFetch('/v2/intelligence/projects/portfolio/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const projects = Array.isArray(recommendations) ? recommendations : recommendations?.projects || recommendations?.recommendations || [];
  const portfolioItems = Array.isArray(portfolio) ? portfolio : portfolio?.projects || portfolio?.items || [];

  return (
    <div className="space-y-6">
      <SectionHeader label="Projects & Experience" isDarkMode={isDarkMode} />

      {projects.length > 0 ? (
        <div className="space-y-4">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recommended Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj, i) => (
              <div key={proj.id || i} className={`p-5 rounded-2xl border flex flex-col gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-100'}`}>
                    <Rocket className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{proj.title || proj.name}</div>
                    {proj.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{proj.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {proj.difficulty && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>{proj.difficulty}</span>}
                  {proj.estimatedHours && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{proj.estimatedHours}h</span>}
                  {proj.matchScore !== undefined && <span className="text-xs text-[#22C55E] font-bold">{proj.matchScore}% match</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyPane message="Project recommendations generate based on your skills and course completions." isDarkMode={isDarkMode} />
      )}

      {portfolioItems.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>My Portfolio</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolioItems.map((item, i) => (
              <div key={item.id || i} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title || item.projectTitle}</div>
                {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                {item.repoUrl && (
                  <a href={item.repoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#22C55E] font-bold mt-2 flex items-center gap-1 hover:underline">
                    <GitBranch className="w-3 h-3" /> View Repo
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   11. CAREER READINESS — CareerCenter + /api/intelligence/career/skills/me
═══════════════════════════════════════════════════════════════════════════════ */

function CareerReadinessView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <SectionHeader label="Career Readiness" isDarkMode={isDarkMode} />
      <CareerCenter isDarkMode={isDarkMode} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   12. OPPORTUNITIES — /api/intelligence/opportunities/me
═══════════════════════════════════════════════════════════════════════════════ */

function OpportunitiesView({ isDarkMode }) {
  const { data: opportunitiesData, loading, error, refetch } = useFetch('/intelligence/opportunities/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const opportunities = Array.isArray(opportunitiesData) ? opportunitiesData : opportunitiesData?.matches || opportunitiesData?.opportunities || [];

  const typeConfig = {
    scholarship: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: GraduationCap },
    internship: { color: 'text-sky-400', bg: 'bg-sky-500/10', icon: Briefcase },
    project: { color: 'text-violet-400', bg: 'bg-violet-500/10', icon: Rocket },
    job: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Briefcase },
    competition: { color: 'text-rose-400', bg: 'bg-rose-500/10', icon: Award },
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Opportunities" isDarkMode={isDarkMode} />

      {opportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp, i) => {
            const typeKey = (opp.type || 'project').toLowerCase();
            const cfg = typeConfig[typeKey] || typeConfig.project;
            const TypeIcon = cfg.icon;
            const matchScore = Math.round(opp.matchScore ?? opp.score ?? 0);
            return (
              <div key={opp.id || i} className={`p-5 rounded-2xl border flex flex-col gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <TypeIcon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opp.title || opp.name}</div>
                    {opp.provider && <div className="text-xs text-slate-400 mt-0.5">{opp.provider}</div>}
                    {opp.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{opp.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>{opp.type || 'Opportunity'}</span>
                  {matchScore > 0 && <span className="text-xs font-bold text-[#22C55E]">{matchScore}% match</span>}
                  {opp.deadline && <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(opp.deadline).toLocaleDateString()}</span>}
                </div>
                {opp.applyUrl && (
                  <a href={opp.applyUrl} target="_blank" rel="noopener noreferrer"
                    className={`text-xs font-bold flex items-center gap-1 ${cfg.color} hover:underline`}>
                    Apply Now <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPane message="Opportunity matches will appear here based on your skills, interests, and learning progress." isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   13. INSIGHTS — Role-based: student analytics, admin dashboard, parent grid
═══════════════════════════════════════════════════════════════════════════════ */

function InsightsView({ isDarkMode, user, role }) {
  if (role === 'admin') return <AdminIntelligenceDashboard isDarkMode={isDarkMode} />;
  if (role === 'parent') return <ParentInsightGrid isDarkMode={isDarkMode} />;
  return <StudentInsightsView isDarkMode={isDarkMode} user={user} />;
}

function StudentInsightsView({ isDarkMode, user }) {
  const { data: analytics, loading, error, refetch } = useFetch('/intelligence/analytics/me');
  const { data: activity } = useFetch('/intelligence/learning-activity/me?limit=10');
  const { data: summary } = useFetch('/intelligence/learning-summary/me');

  if (loading) return <LoadingPane isDarkMode={isDarkMode} />;
  if (error) return <ErrorPane error={error} onRetry={refetch} isDarkMode={isDarkMode} />;

  const recentActivity = Array.isArray(activity) ? activity : activity?.activities || activity?.events || [];
  const overallProgress = summary?.overallProgress ?? summary?.averageProgress ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeader label="Insights" isDarkMode={isDarkMode} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricTile label="Engagement" value={`${analytics?.engagementScore ?? 0}%`} sub="Weekly engagement level" color="text-emerald-400" isDarkMode={isDarkMode} />
        <MetricTile label="Consistency" value={`${analytics?.consistencyScore ?? 0}%`} sub="Study rhythm score" color="text-sky-400" isDarkMode={isDarkMode} />
        <MetricTile label="Momentum" value={`${analytics?.momentumScore ?? 0}%`} sub="Combined growth" color="text-violet-400" isDarkMode={isDarkMode} />
        <MetricTile label="Overall Progress" value={`${Math.round(overallProgress)}%`} sub="Across all courses" color="text-amber-400" isDarkMode={isDarkMode} />
      </div>

      {analytics?.riskLevel && (
        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${
          analytics.riskLevel === 'high' ? (isDarkMode ? 'bg-red-900/10 border-red-800/30' : 'bg-red-50 border-red-200') :
          analytics.riskLevel === 'medium' ? (isDarkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50 border-amber-200') :
          (isDarkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200')
        }`}>
          <ShieldCheck className={`w-8 h-8 shrink-0 ${analytics.riskLevel === 'high' ? 'text-red-400' : analytics.riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
          <div>
            <div className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Learning Health: {analytics.riskLevel.charAt(0).toUpperCase() + analytics.riskLevel.slice(1)} Risk
            </div>
            {analytics.riskFactors?.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">{analytics.riskFactors.join(' · ')}</p>
            )}
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Activity</h3>
          <div className="space-y-2">
            {recentActivity.slice(0, 8).map((event, i) => (
              <div key={event.id || i} className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#22C55E]/10' : 'bg-emerald-100'}`}>
                  <Activity className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {event.eventType?.replace(/_/g, ' ') || event.type?.replace(/_/g, ' ') || 'Learning event'}
                  </div>
                  {event.courseTitle && <div className="text-xs text-slate-400 mt-0.5">{event.courseTitle}</div>}
                </div>
                {event.occurredAt && (
                  <div className="text-xs text-slate-500 shrink-0">
                    {new Date(event.occurredAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
