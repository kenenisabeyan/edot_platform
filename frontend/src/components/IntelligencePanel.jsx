/**
 * IntelligencePanel.jsx
 *
 * Student-facing intelligence panel widget.
 * Shows risk level, momentum score, consistency, and recommended next action
 * drawn from the /api/intelligence/analytics/me endpoint.
 *
 * Usage:
 *   <IntelligencePanel isDarkMode={isDarkMode} />
 */

import React from 'react';
import { BrainCircuit, ShieldCheck, AlertTriangle, Flame, Zap, TrendingUp } from 'lucide-react';
import { useIntelligence } from '../hooks/useIntelligence.js';

const RISK_CONFIG = {
  low: {
    label: 'On Track',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: ShieldCheck
  },
  medium: {
    label: 'Needs Attention',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle
  },
  high: {
    label: 'At Risk',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: AlertTriangle
  },
  critical: {
    label: 'Critical',
    color: 'text-rose-500',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    icon: AlertTriangle
  }
};

function ScoreBar({ value = 0, color = 'bg-cyan-500', isDarkMode }) {
  return (
    <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function IntelligencePanel({ isDarkMode = false }) {
  const { report, isLoading } = useIntelligence();

  const risk = RISK_CONFIG[report?.riskLevel || 'low'];
  const RiskIcon = risk.icon;

  const card = isDarkMode
    ? 'border-white/10 bg-[#0F172A]'
    : 'border-slate-200 bg-white';

  const wrapper = isDarkMode
    ? 'bg-[#0B1120] border-white/10'
    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200';

  return (
    <div className={`rounded-[28px] border p-5 shadow-lg ${wrapper}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`rounded-2xl p-2.5 ${isDarkMode ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Intelligence Core
          </div>
          <div className={`font-black text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Your learning signal
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={`text-sm py-6 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Analysing your learning patterns...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Risk badge */}
          <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${risk.bg} ${risk.border}`}>
            <div className="flex items-center gap-2">
              <RiskIcon className={`h-4 w-4 ${risk.color}`} />
              <span className={`font-bold text-sm ${risk.color}`}>{risk.label}</span>
            </div>
            {report?.riskFactors?.length > 0 && (
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {report.riskFactors[0]}
              </span>
            )}
          </div>

          {/* Score bars */}
          <div className={`rounded-2xl border p-4 space-y-3 ${card}`}>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className={`flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Flame className="h-3.5 w-3.5 text-amber-400" /> Momentum
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                  {Math.round(report?.momentumScore || 0)}%
                </span>
              </div>
              <ScoreBar value={report?.momentumScore || 0} color="bg-amber-400" isDarkMode={isDarkMode} />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className={`flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Zap className="h-3.5 w-3.5 text-cyan-400" /> Engagement
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                  {Math.round(report?.engagementScore || 0)}%
                </span>
              </div>
              <ScoreBar value={report?.engagementScore || 0} color="bg-cyan-400" isDarkMode={isDarkMode} />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className={`flex items-center gap-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Consistency
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                  {Math.round(report?.consistencyScore || 0)}%
                </span>
              </div>
              <ScoreBar value={report?.consistencyScore || 0} color="bg-emerald-400" isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
