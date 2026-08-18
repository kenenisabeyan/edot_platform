/**
 * PersonalizedIntelligenceDashboard.jsx
 * 
 * EDOT Learner Intelligence Dashboard Header & Widget Suite.
 * Answers the core question: "What should I do next to make meaningful progress?"
 * 
 * Features 10 Intelligence Layer Widgets:
 * 1. Today's Next Best Action (Hero Prominent Card)
 * 2. Learning Momentum Indicator
 * 3. Current Goal Progress
 * 4. Verified Strengths
 * 5. Areas to Improve (Weak Skills)
 * 6. Personalized Recommendations Stream
 * 7. AI Mentor Launcher Card
 * 8. Learning Streak & Consistency Index
 * 9. Risk & Attention Alerts
 * 10. Recent Achievements & Milestones
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Flame, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Bot, 
  ChevronRight, 
  RotateCcw, 
  Award, 
  ShieldCheck, 
  BookOpen, 
  Zap, 
  Loader2, 
  X, 
  ArrowRight,
  BrainCircuit,
  Activity
} from 'lucide-react';
import api from '../../utils/api.js';

export default function PersonalizedIntelligenceDashboard({ isDarkMode = false, onNavigateTab }) {
  const [profileData, setProfileData] = useState(null);
  const [nextActionData, setNextActionData] = useState(null);
  const [recsData, setRecsData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIntelligenceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, nextActionRes, recsRes, analyticsRes] = await Promise.allSettled([
        api.get('/v2/intelligence/profile/me'),
        api.get('/v2/intelligence/next-action/me'),
        api.get('/v2/intelligence/recommendations/me'),
        api.get('/v2/intelligence/analytics/me')
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data.success) {
        setProfileData(profileRes.value.data.data);
      }
      if (nextActionRes.status === 'fulfilled' && nextActionRes.value.data.success) {
        setNextActionData(nextActionRes.value.data.data);
      }
      if (recsRes.status === 'fulfilled' && recsRes.value.data.success) {
        setRecsData(recsRes.value.data.data || []);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data.success) {
        setAnalyticsData(analyticsRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to load intelligence dashboard data:', err);
      setError('Unable to load latest intelligence metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  const handleDismissRec = async (id) => {
    try {
      await api.post(`/v2/intelligence/recommendations/${id}/dismiss`);
      setRecsData(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to dismiss recommendation:', e);
    }
  };

  const handleCompleteRec = async (id) => {
    try {
      await api.post(`/v2/intelligence/recommendations/${id}/complete`);
      setRecsData(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to complete recommendation:', e);
    }
  };

  if (loading) {
    return (
      <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200'} space-y-6 animate-pulse`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Assembling your personalized intelligence profile & Next Best Action...
          </span>
        </div>
        <div className="h-32 bg-cyan-500/10 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-white/5 rounded-2xl" />
          <div className="h-24 bg-white/5 rounded-2xl" />
          <div className="h-24 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !profileData && !nextActionData) {
    return (
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-rose-500/20' : 'bg-white border-rose-200'} flex items-center justify-between`}>
        <div className="flex items-center gap-3 text-rose-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
        <button
          onClick={fetchIntelligenceData}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold transition-all flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const primaryAction = nextActionData?.primaryAction || {
    reason: 'Resume your course modules to maintain your weekly study momentum.',
    recommendationType: 'NEXT_LESSON',
    priority: 'HIGH'
  };

  const riskLevel = profileData?.riskLevel || analyticsData?.riskLevel || 'LOW';
  const riskReasons = profileData?.riskReasons || [];

  return (
    <div className="space-y-6">

      {/* 9. RISK / ATTENTION ALERT (If Risk != LOW) */}
      {riskLevel !== 'LOW' && (
        <div className={`p-5 rounded-3xl border flex items-start justify-between gap-4 ${riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider">
                Attention Required: {riskLevel} Academic Risk Flagged
              </h4>
              <p className="text-xs mt-1 text-slate-300 font-medium">
                {riskReasons[0] || 'Your engagement rate or quiz performance is below expected thresholds.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('courses')}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold shrink-0 hover:bg-rose-600 transition-all shadow-md"
          >
            Take Action
          </button>
        </div>
      )}

      {/* 1. TODAY'S NEXT BEST ACTION (HERO PROMINENT WIDGET) */}
      <div className={`p-6 sm:p-8 rounded-3xl border relative overflow-hidden shadow-xl ${isDarkMode ? 'bg-gradient-to-br from-[#0D1527] via-[#0B1120] to-[#070B14] border-cyan-500/30' : 'bg-gradient-to-br from-cyan-900 via-blue-900 to-slate-900 text-white border-cyan-500/40'}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-300">
                Today's Next Best Action
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> High Impact
            </span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              What should I do next to make meaningful progress?
            </h2>
            <p className="text-sm text-cyan-100/90 font-medium mt-2 leading-relaxed max-w-3xl">
              {primaryAction.reason}
            </p>
          </div>

          {/* Primary CTA & Secondary Action Pills */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab && onNavigateTab('courses')}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-sm hover:scale-105 transition-all shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-2"
            >
              <span>Execute Action Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {nextActionData?.secondaryActions?.slice(0, 2).map((sec, idx) => (
              <span
                key={idx}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold border border-white/15 flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{sec.recommendationType.replace('_', ' ')}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* METRICS & INTELLIGENCE GRID (WIDGETS 2, 3, 7, 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 2. LEARNING MOMENTUM */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Learning Momentum
            </span>
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div className="my-3">
            <span className="text-3xl font-black text-amber-400">
              {profileData?.learningMomentum || 85}
            </span>
            <span className="text-xs font-semibold text-slate-400 ml-1">/ 100</span>
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            {profileData?.momentumReasons?.[0] || 'Steady weekly learning streak.'}
          </p>
        </div>

        {/* 8. LEARNING STREAK & CONSISTENCY */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Consistency Index
            </span>
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">
              {profileData?.consistencyScore || 78}%
            </span>
            <span className="text-xs font-bold text-slate-400">
              ({analyticsData?.activeLearningDays || 12} Active Days)
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            Based on 30-day session activity.
          </p>
        </div>

        {/* 3. CURRENT GOAL PROGRESS */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Current Goal
            </span>
            <Target className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="my-3">
            <h4 className={`text-sm font-extrabold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {profileData?.goals?.[0]?.title || 'Master Core Curriculum'}
            </h4>
            <div className="w-full h-2 rounded-full bg-cyan-500/20 mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-700"
                style={{ width: `${profileData?.goals?.[0]?.progress || 65}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] font-bold text-cyan-400">
            {profileData?.goals?.[0]?.progress || 65}% Completed
          </span>
        </div>

        {/* 7. AI MENTOR QUICK LAUNCHER */}
        <div className={`p-5 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-gradient-to-br from-cyan-950/40 to-[#0B1120] border-cyan-500/30' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              AI Tutor Coach
            </span>
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <p className={`text-xs font-semibold my-2 leading-snug ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            Stuck on a concept? Get grounded guidance.
          </p>
          <button
            onClick={() => {
              const mentorBtn = document.querySelector('button:has(svg.lucide-bot)');
              if (mentorBtn) mentorBtn.click();
            }}
            className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <span>Ask AI Mentor</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* STRENGTHS & AREAS TO IMPROVE GRID (WIDGETS 4 & 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 4. VERIFIED STRENGTHS */}
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Verified Strengths
            </h3>
          </div>
          {profileData?.skills?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{skill.name}</span>
                  <span className="text-[10px] opacity-75">({skill.proficiencyLevel})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-medium italic">
              Complete practice quizzes to benchmark your skill strengths.
            </p>
          )}
        </div>

        {/* 5. AREAS TO IMPROVE */}
        <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Areas to Improve
            </h3>
          </div>
          {analyticsData?.weakTopics?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analyticsData.weakTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{topic}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-medium italic">
              No critical weak areas detected in recent quizzes. Great job!
            </p>
          )}
        </div>
      </div>

      {/* 6. PERSONALIZED RECOMMENDATIONS STREAM */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Personalized Recommendations Stream
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {recsData.length} Recommended Steps
          </span>
        </div>

        {recsData.length > 0 ? (
          <div className="space-y-3">
            {recsData.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${isDarkMode ? 'bg-[#05070A] border-white/10 hover:border-cyan-500/30' : 'bg-slate-50 border-slate-200 hover:border-cyan-400'}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-[10px] font-extrabold uppercase tracking-wider">
                      {rec.recommendationType.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-bold text-amber-400">
                      {(rec.confidence * 100).toFixed(0)}% Match
                    </span>
                  </div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {rec.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCompleteRec(rec.id)}
                    className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-colors flex items-center gap-1"
                    title="Mark Completed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDismissRec(rec.id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-medium italic">
            You are fully caught up with all active recommendations!
          </p>
        )}
      </div>

      {/* 10. RECENT ACHIEVEMENTS & MILESTONES */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Recent Achievements & Milestones
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#05070A] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {analyticsData?.activeLearningDays || 12}-Day Streak
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">Consistent Learner</p>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#05070A] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {analyticsData?.quizPerformance?.accuracyPercent || 88}% Quiz Accuracy
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">Assessment Excellence</p>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-[#05070A] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {analyticsData?.timeInvestedHours || 18} Hours Invested
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">Deep Focused Study</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
