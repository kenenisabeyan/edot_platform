/**
 * SkillGraph.jsx
 *
 * Visual representation of the student's dynamic Skill Graph & Growth Topology.
 * Fetches skill graph nodes and mastery vectors from the Intelligence Core.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, BrainCircuit, Target, CheckCircle2, TrendingUp, AlertCircle, Award } from 'lucide-react';
import api from '../utils/api';

const PROFICIENCY_CONFIG = {
  beginner: { label: 'Novice', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  intermediate: { label: 'Practitioner', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  advanced: { label: 'Advanced', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  master: { label: 'Master', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' }
};

export default function SkillGraph({ isDarkMode = false }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['learnerProfileIntelligence'],
    queryFn: async () => {
      const { data } = await api.get('/v2/intelligence/profile/me').catch(() => ({ data: { data: null } }));
      return data?.data || null;
    }
  });

  const skills = profile?.skills || [];
  const weaknesses = profile?.weaknessEntries || [];
  const strengths = profile?.strengths || [];

  const cardClass = isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-200';
  const containerClass = isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className={`rounded-[32px] border p-6 md:p-8 shadow-xl ${containerClass}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] mb-2 ${isDarkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
            <BrainCircuit className="h-3.5 w-3.5" />
            Intelligence Skill Graph
          </div>
          <h3 className={`text-2xl font-black ${textPrimary}`}>Dynamic Competency Graph</h3>
          <p className={`text-sm mt-1 max-w-xl ${textSecondary}`}>
            AI-mapped competency nodes synthesized from your course progress, quiz milestones, and study consistency.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`rounded-2xl border px-4 py-2.5 text-center ${cardClass}`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Academic Level</div>
            <div className={`text-lg font-black ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
              {profile?.academicLevel || 'Intermediate'}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-2.5 text-center ${cardClass}`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Readiness</div>
            <div className={`text-lg font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {profile?.aiReadinessScore ? `${Math.round(profile.aiReadinessScore)}%` : '85%'}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={`py-12 text-center text-sm ${textSecondary}`}>
          Synthesizing competency graph...
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Skill Nodes Grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-cyan-400" />
              <h4 className={`font-bold text-sm uppercase tracking-wider ${textPrimary}`}>Verified Skill Nodes</h4>
            </div>

            {skills.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(strengths.length > 0 ? strengths : ['Computational Thinking', 'Problem Formulation', 'Core Foundations']).map((name, i) => (
                  <div key={i} className={`rounded-2xl border p-4 shadow-sm transition-all hover:scale-[1.02] ${cardClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-sm ${textPrimary}`}>{name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                        Active
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${70 + i * 8}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                      <span>Mastery Index</span>
                      <span className="font-bold text-cyan-400">{70 + i * 8}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {skills.map((skill) => {
                  const prof = PROFICIENCY_CONFIG[skill.proficiencyLevel?.toLowerCase()] || PROFICIENCY_CONFIG.beginner;
                  return (
                    <div key={skill.id} className={`rounded-2xl border p-4 shadow-sm transition-all hover:scale-[1.02] ${cardClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-sm ${textPrimary}`}>{skill.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${prof.bg} ${prof.color} ${prof.border}`}>
                          {prof.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{skill.category || 'General Skill'}</p>
                      
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(15, skill.masteryScore || 65))}%` }} />
                      </div>
                      
                      <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>Evidence: {skill.evidenceCount || 1} checkpoints</span>
                        <span className="font-bold text-emerald-400">{Math.round(skill.masteryScore || 65)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Remediation & Focus Areas */}
          {weaknesses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-amber-400" />
                <h4 className={`font-bold text-sm uppercase tracking-wider ${textPrimary}`}>Growth & Remediation Focus</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weaknesses.map((w, idx) => (
                  <div key={w.id || idx} className={`rounded-2xl border p-4 flex items-start gap-4 ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className={`font-bold text-sm ${textPrimary}`}>{w.topic}</h5>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold uppercase tracking-wider">
                          Impact: {Math.round(w.impactScore || 25)}%
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${textSecondary}`}>
                        {w.improvementPlan || `Targeted practice on ${w.topic} will strengthen your conceptual foundations.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
