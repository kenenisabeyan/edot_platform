import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Brain, Target, TrendingUp, BookOpen, Sparkles, ShieldCheck } from 'lucide-react';

export default function LearningProfileCard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/learning-profile/me');
        setProfile(data.data);
      } catch (error) {
        console.error('Failed to load learning profile', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">Loading learner intelligence...</div>;

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-cyan-400" />
          <h3 className="text-xl font-bold">EDOT Intelligence Profile</h3>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Your learning identity is being prepared. This profile will power personalized coaching, skill tracking, and future AI recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-600">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold">AI Learning Profile</span>
          </div>
          <h3 className="mt-2 text-2xl font-black text-slate-900">Intelligent Learner Model</h3>
        </div>
        <div className="rounded-2xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700">
          {profile.academicLevel || 'Intermediate'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Target className="h-4 w-4" />
            <span className="text-sm font-semibold">Current Focus</span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{profile.currentFocus || 'Building momentum'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-semibold">AI Readiness</span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{Math.round(profile.aiReadinessScore || 0)}%</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm font-semibold">Completed Courses</span>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">{profile.completedCourses || 0}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Strengths</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {(profile.strengths || []).slice(0, 6).map((item, idx) => (
              <span key={`${item}-${idx}`} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Learning Goals</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {(profile.learningGoals || []).slice(0, 6).map((item, idx) => (
              <span key={`${item}-${idx}`} className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-medium text-cyan-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-slate-700">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-sm font-semibold">Learner Intelligence Summary</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{profile.summary || 'This profile is being enriched from learning history, quiz outcomes, skills, and habits for future personalization.'}</p>
      </div>
    </div>
  );
}
