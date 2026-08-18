import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { Sparkles, Compass, Rocket, BookOpen, Layers3 } from 'lucide-react';

function RecommendationSection({ title, items = [], accent, isDarkMode }) {
  return (
    <div className={`rounded-3xl border p-5 ${isDarkMode ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <div className={`rounded-xl p-2 ${accent}`}>
          <Sparkles className="h-4 w-4" />
        </div>
        <span>{title}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className={`rounded-2xl border p-3 ${isDarkMode ? 'border-white/10 bg-slate-800/70' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title || item.name || item.label}</div>
                <div className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{item.reason || item.description || item.steps?.join(' → ')}</div>
              </div>
              {item.score ? <span className="text-xs font-bold text-cyan-500">{item.score}%</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RecommendationEnginePanel({ isDarkMode = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const { data } = await api.get('/recommendations/me').catch(() => ({ data: { data: { skills: [], courses: [], lessons: [], projects: [], learningPaths: [] } } }));
      return data.data || { skills: [], courses: [], lessons: [], projects: [], learningPaths: [] };
    }
  });

  const recommendations = useMemo(() => ({
    courses: data?.courses || [],
    lessons: data?.lessons || [],
    skills: data?.skills || [],
    projects: data?.projects || [],
    learningPaths: data?.learningPaths || []
  }), [data]);

  return (
    <div className={`rounded-[32px] border p-6 shadow-xl ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${isDarkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
            <Compass className="h-3.5 w-3.5" />
            EDOT recommendation engine
          </div>
          <h3 className={`mt-3 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your next best move, personalized</h3>
          <p className={`mt-2 max-w-2xl text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Recommendations grow from your goals, progress, interests, and performance so the platform can guide you with more confidence over time.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-700'}`}>
          <div className="font-semibold">Confidence</div>
          <div className="font-black text-lg">{data?.metadata?.confidence || 70}%</div>
        </div>
      </div>

      {isLoading ? (
        <div className={`mt-6 rounded-3xl border p-6 text-sm ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
          Preparing your personalized recommendations...
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <RecommendationSection title="Recommended courses" items={recommendations.courses} accent={isDarkMode ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-100 text-cyan-700'} isDarkMode={isDarkMode} />
          <RecommendationSection title="Recommended lessons" items={recommendations.lessons} accent={isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700'} isDarkMode={isDarkMode} />
          <RecommendationSection title="Suggested skills" items={recommendations.skills} accent={isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-700'} isDarkMode={isDarkMode} />
          <RecommendationSection title="Projects & paths" items={[...recommendations.projects, ...recommendations.learningPaths].slice(0, 4)} accent={isDarkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-700'} isDarkMode={isDarkMode} />
        </div>
      )}
    </div>
  );
}
