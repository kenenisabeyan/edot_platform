import React, { useMemo } from 'react';
import { BrainCircuit, TrendingUp, AlertTriangle, Sparkles, ArrowRight, Clock3, Target, BarChart3 } from 'lucide-react';

const IntelligenceCard = ({ title, value, subtitle, accent, icon: Icon, isDarkMode }) => (
  <div className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200'}`}>
    <div className="flex items-center justify-between">
      <div className={`rounded-2xl p-2 ${accent}`}> 
        <Icon className="h-5 w-5" />
      </div>
      <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</span>
    </div>
    <div className={`mt-4 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</div>
    <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
  </div>
);

export default function IntelligentLearningAnalytics({ enrolledCourses = [], dashboardStats = {}, isDarkMode = false }) {
  const analytics = useMemo(() => {
    const intelligence = dashboardStats?.intelligence || {};
    const courseCount = enrolledCourses.length || 0;
    const averageProgress = intelligence.courseProgress ?? Math.round(
      enrolledCourses.reduce((sum, course) => sum + Number(course.progress || 0), 0) / Math.max(courseCount, 1)
    );
    const totalStudyHours = intelligence.totalStudyHours ?? 0;
    const quizAverage = intelligence.quizPerformance ?? Math.round(
      enrolledCourses.reduce((sum, course) => sum + Number(course.quizAverage || 0), 0) / Math.max(courseCount, 1)
    );
    const improvement = intelligence.improvement ?? Math.max(0, Math.round(quizAverage - 40));

    return {
      averageProgress: Number(averageProgress) || 0,
      totalStudyHours: Number(totalStudyHours).toFixed(1),
      quizAverage: Number(quizAverage) || 0,
      improvement,
      strongestSkill: intelligence.strongestSkill || 'Consistency and momentum',
      weakConcept: intelligence.weakConcept || 'Foundational concepts',
      recommendedAction: intelligence.recommendedAction || (averageProgress > 70 ? 'Maintain your stride and revisit a concept from your latest quiz.' : 'Increase your weekly study sessions and focus on one weak topic at a time.'),
      nextStep: intelligence.nextStep || (averageProgress > 60 ? 'Complete the next unit and reinforce it with a short review.' : 'Start with the first milestone lesson and build a daily study streak.'),
      learningPattern: intelligence.learningPattern || 'building'
    };
  }, [dashboardStats, enrolledCourses]);

  return (
    <div className={`rounded-[32px] border p-6 shadow-xl ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${isDarkMode ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
            <BrainCircuit className="h-3.5 w-3.5" />
            Intelligent learning analytics
          </div>
          <h3 className={`mt-3 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your learning behavior is telling a story</h3>
          <p className={`mt-2 max-w-2xl text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            EDOT interprets your patterns across study time, progress, quiz performance, and growth so you can act with confidence.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-700'}`}>
          <div className="font-semibold">Behavior signal</div>
          <div className="font-black text-lg">{analytics.averageProgress}% overall momentum</div>
          <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Pattern: {analytics.learningPattern === 'consistent' ? 'steady and consistent' : 'building momentum'}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <IntelligenceCard title="Your strongest skill" value={analytics.strongestSkill} subtitle="Your best-performing learning area right now." accent={isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700'} icon={TrendingUp} isDarkMode={isDarkMode} />
        <IntelligenceCard title="Your improvement area" value={analytics.weakConcept} subtitle="A topic worth revisiting this week." accent={isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-700'} icon={AlertTriangle} isDarkMode={isDarkMode} />
        <IntelligenceCard title="Recommended action" value={analytics.recommendedAction} subtitle="A practical next move based on your recent behavior." accent={isDarkMode ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'} icon={Target} isDarkMode={isDarkMode} />
        <IntelligenceCard title="Next learning step" value={analytics.nextStep} subtitle="The most valuable thing to do next." accent={isDarkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-700'} icon={ArrowRight} isDarkMode={isDarkMode} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-3xl border p-5 ${isDarkMode ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2 text-cyan-500">
            <Clock3 className="h-5 w-5" />
            <span className="text-sm font-semibold">Study time</span>
          </div>
          <div className={`mt-3 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analytics.totalStudyHours} hrs</div>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Your current momentum across active courses.</p>
        </div>
        <div className={`rounded-3xl border p-5 ${isDarkMode ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2 text-emerald-500">
            <BarChart3 className="h-5 w-5" />
            <span className="text-sm font-semibold">Quiz performance</span>
          </div>
          <div className={`mt-3 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analytics.quizAverage}%</div>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Recent quiz results and mastery signals.</p>
        </div>
        <div className={`rounded-3xl border p-5 ${isDarkMode ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2 text-violet-500">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold">Improvement</span>
          </div>
          <div className={`mt-3 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analytics.improvement}%</div>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Growth compared with earlier performance baselines.</p>
        </div>
      </div>
    </div>
  );
}
