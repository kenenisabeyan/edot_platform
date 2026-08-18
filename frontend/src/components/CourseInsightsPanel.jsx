/**
 * CourseInsightsPanel.jsx
 *
 * Course Intelligence & Drop-off Analytics component for Instructors & Admins.
 * Visualizes lesson-by-lesson retention curve and quiz accuracy rates.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingDown, Users, CheckCircle2, AlertTriangle, Sparkles, BookOpen } from 'lucide-react';
import api from '../utils/api';

export default function CourseInsightsPanel({ courseId, isDarkMode = false }) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['courseIntelligenceInsights', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data } = await api.get(`/v2/intelligence/courses/${courseId}/insights`).catch(() => ({ data: { data: null } }));
      return data?.data || null;
    },
    enabled: Boolean(courseId)
  });

  const cardClass = isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200';
  const containerClass = isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  if (!courseId) return null;

  return (
    <div className={`rounded-[28px] border p-6 shadow-xl ${containerClass}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] mb-2 ${isDarkMode ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
            <BarChart3 className="h-3.5 w-3.5" />
            Course Intelligence Insights
          </div>
          <h3 className={`text-xl font-black ${textPrimary}`}>Retention & Lesson Mastery Curve</h3>
          <p className={`text-sm mt-1 ${textSecondary}`}>
            Real-time analytics detecting learner drop-off points and lesson difficulty signals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`rounded-xl border px-3.5 py-2 text-center ${cardClass}`}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Active Cohort</div>
            <div className={`text-base font-black ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
              {insights?.totalEnrollments || 0} Students
            </div>
          </div>
          <div className={`rounded-xl border px-3.5 py-2 text-center ${cardClass}`}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase">Avg Quiz Pass</div>
            <div className={`text-base font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {insights?.averageQuizAccuracy || 0}%
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={`py-8 text-center text-sm ${textSecondary}`}>
          Computing course intelligence signals...
        </div>
      ) : !insights || !insights.lessonStats || insights.lessonStats.length === 0 ? (
        <div className={`py-6 text-center text-sm ${textSecondary}`}>
          No lesson progress data recorded yet for this course.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            <span>Lesson Sequence</span>
            <span>Completion Rate</span>
          </div>

          <div className="space-y-3">
            {insights.lessonStats.map((stat, idx) => {
              const isDropOff = idx > 0 && stat.completionRate < (insights.lessonStats[idx - 1].completionRate - 20);
              return (
                <div key={stat.lessonId || idx} className={`rounded-2xl border p-3.5 transition-all ${cardClass} ${isDropOff ? 'border-rose-500/30' : ''}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        L{stat.order || idx + 1}
                      </span>
                      <span className={`font-semibold text-sm truncate ${textPrimary}`}>{stat.title}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isDropOff && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <TrendingDown className="h-3 w-3" /> Drop-off Point
                        </span>
                      )}
                      <span className={`font-black text-sm ${stat.completionRate >= 70 ? 'text-emerald-400' : stat.completionRate >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {stat.completionRate}%
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stat.completionRate >= 70
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                          : stat.completionRate >= 40
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                          : 'bg-gradient-to-r from-rose-500 to-orange-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, stat.completionRate))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
