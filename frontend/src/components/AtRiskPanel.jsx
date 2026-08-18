/**
 * AtRiskPanel.jsx
 *
 * Admin-only component that displays a table of at-risk learners
 * from the /api/intelligence/analytics/admin/at-risk endpoint.
 *
 * Usage (in AdminDashboard or AnalyticsReport):
 *   <AtRiskPanel isDarkMode={isDarkMode} />
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Flame, BarChart2, RefreshCw } from 'lucide-react';
import { getAtRiskLearners } from '../services/intelligenceApi.js';

const RISK_BADGE = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  critical: 'bg-rose-600/15 text-rose-500 border-rose-600/30'
};

function RiskBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${RISK_BADGE[level] || RISK_BADGE.medium}`}>
      <AlertTriangle className="h-3 w-3" />
      {level}
    </span>
  );
}

export default function AtRiskPanel({ isDarkMode = false }) {
  const [learners, setLearners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAtRiskLearners(20);
      if (result?.success) {
        setLearners(result.data || []);
      } else {
        setError('Failed to load at-risk report');
      }
    } catch {
      setError('Could not connect to intelligence service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const card = isDarkMode ? 'border-white/10 bg-[#0F172A]' : 'border-slate-200 bg-white';
  const wrapper = isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const sub = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`rounded-[28px] border p-6 shadow-xl ${wrapper}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] mb-3 ${isDarkMode ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-100 text-rose-700'}`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Intelligence Core — At-Risk Detection
          </div>
          <h3 className={`text-xl font-black ${text}`}>Learners Needing Intervention</h3>
          <p className={`text-sm mt-1 ${sub}`}>Students whose engagement, consistency, or quiz performance signals require attention.</p>
        </div>
        <button
          onClick={load}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={`text-sm py-8 text-center ${sub}`}>Analysing learner risk signals...</div>
      ) : error ? (
        <div className={`text-sm py-6 text-center text-rose-400`}>{error}</div>
      ) : learners.length === 0 ? (
        <div className={`rounded-2xl border p-6 text-center ${card}`}>
          <div className="text-2xl mb-2">✅</div>
          <div className={`font-semibold ${text}`}>No at-risk learners detected</div>
          <div className={`text-sm mt-1 ${sub}`}>All learners are tracking well based on current signals.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-widest ${sub}`}>
                <th className="text-left pb-3 pr-4">Learner</th>
                <th className="text-left pb-3 pr-4">Risk</th>
                <th className="text-left pb-3 pr-4">
                  <Flame className="inline h-3.5 w-3.5 text-amber-400 mr-1" />Momentum
                </th>
                <th className="text-left pb-3 pr-4">
                  <BarChart2 className="inline h-3.5 w-3.5 text-cyan-400 mr-1" />Consistency
                </th>
                <th className="text-left pb-3">Risk Factors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {learners.map((entry, i) => (
                <tr key={entry.userId || i} className="group">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {entry.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className={`font-semibold ${text}`}>{entry.user?.name || 'Unknown'}</div>
                        <div className={`text-xs ${sub}`}>{entry.user?.email || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <RiskBadge level={entry.riskLevel} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                      {Math.round(entry.momentumScore || 0)}%
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}>
                      {Math.round(entry.consistencyScore || 0)}%
                    </span>
                  </td>
                  <td className="py-3">
                    <div className={`text-xs ${sub}`}>
                      {entry.riskFactors?.slice(0, 2).join(' · ') || '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
