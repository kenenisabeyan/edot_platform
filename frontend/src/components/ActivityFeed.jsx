import React, { useEffect, useState, useCallback } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import api from '../utils/api';
import { Activity, LogIn, BookOpen, CheckCircle, Settings, MessageSquare, AlertCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ActivityFeed({ isAdmin = false, feedType, limit = 5 }) {
  const isDarkMode = useThemeMode();
  const { user } = useAuth();//
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLimit, setCurrentLimit] = useState(limit);

  const filterType = feedType || (isAdmin ? 'all' : 'personal');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = filterType === 'all' ? '/activity/all' : filterType === 'insights' ? '/activity/insights' : '/activity';
      const res = await api.get(endpoint, { params: { limit: currentLimit } });
      if (res.data.success) {
        setActivities(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setError('Unable to load activities at the moment.');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Unable to load activities at the moment.');
    } finally {
      setLoading(false);
    }
  }, [filterType, currentLimit]);

  useEffect(() => {
    setCurrentLimit(limit);
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleFlag = async (id, flagType) => {
    try {
      await api.put(`/activity/${id}/flag`, { insightFlag: flagType });
      fetchActivities(); // refresh instantly
    } catch(err) {
      console.error('Failed to flag activity', err);
    }
  };

  const formatCreatedAt = (timestamp) => new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getIconForType = (type) => {
    switch (type) {
      case 'auth': return <LogIn className="w-5 h-5 text-[#00D4FF]" />;
      case 'course': return <BookOpen className="w-5 h-5 text-blue-400" />;
      case 'enrollment': return <CheckCircle className="w-5 h-5 text-[#00D4FF]" />;
      case 'learning': return <Activity className="w-5 h-5 text-purple-400" />;
      case 'communication': return <MessageSquare className="w-5 h-5 text-pink-400" />;
      case 'system': return <Settings className={`w-5 h-5 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`} />;
      default: return <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />;
    }
  };

  const getBgColorForType = (type) => {
    switch (type) {
      case 'auth': return 'bg-[#00D4FF]/10 border-[#00D4FF]/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]';
      case 'course': return 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
      case 'enrollment': return 'bg-[#00D4FF]/10 border-[#00D4FF]/30 shadow-[0_0_15px_rgba(0,138,50,0.1)]';
      case 'learning': return 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]';
      case 'communication': return 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.1)]';
      case 'system': return 'bg-[#0B1120]/40 backdrop-blur-xl border-white/5';
      default: return 'bg-[#0B1120]/40 backdrop-blur-xl border-white/5';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className={`w-8 h-8 border-4 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-[2rem] border p-10 text-center ${isDarkMode ? 'bg-slate-950/85 border-white/10' : 'bg-white/90 border-slate-200/70'}`}>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <AlertCircle className={`w-7 h-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
        </div>
        <h3 className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Could not load activity feed</h3>
        <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{error}</p>
        <button
          onClick={fetchActivities}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[#00D4FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00b5f6] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`rounded-[2rem] border p-10 text-center ${isDarkMode ? 'bg-slate-950/85 border-white/10' : 'bg-white/90 border-slate-200/70'}`}>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${isDarkMode ? 'bg-[#0B1120]/80 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Activity className={`w-7 h-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
        </div>
        <h3 className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No recent activities yet</h3>
        <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Your recent actions and insights will appear here once the dashboard starts tracking activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id || index} className={`flex flex-col gap-4 rounded-[2rem] border p-5 transition-transform duration-300 shadow-2xl ${isDarkMode ? 'border-white/10 bg-slate-950/90 shadow-slate-950/20' : 'border-slate-200/70 bg-white/90 shadow-slate-900/5 hover:-translate-y-1'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 shrink-0 rounded-[1.75rem] border flex items-center justify-center text-xl transition-all ${getBgColorForType(activity.type)}`}>
              {getIconForType(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                <h4 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activity.action}</h4>
                <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold border ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  {formatCreatedAt(activity.createdAt)}
                </span>
              </div>
            {isAdmin && activity.user && (
              <p className={`text-xs mb-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>
                <span className={`font-bold text-[9px] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>User:</span> {activity.user.name} <span className="text-[9px] font-black   bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] px-1.5 py-0.5 rounded ml-1">{activity.user.role}</span>
              </p>
            )}
            {activity.details && (
              <p className={`text-xs font-medium mt-2 p-3 rounded-xl border shadow-inner ${isDarkMode ? 'text-slate-300 bg-[#0B1120] border-white/5' : 'text-slate-500 bg-white border-slate-100'}`}>
                {activity.details}
              </p>
            )}

            {/* Privacy & Insight indicators */}
            <div className="flex items-center justify-between mt-4">
               <div className="flex items-center gap-2">
                 {activity.visibility === 'private' && <span className={`text-[9px] font-black border px-2 py-1 rounded-md shadow-sm ${isDarkMode ? 'text-slate-300 bg-[#0B1120]/5 border-white/10' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>Private</span>}
                 {activity.visibility === 'insight' && (
                   <span className={`text-[9px]  font-black  px-2 py-1 rounded-md shadow-sm flex items-center gap-1 border ${activity.insightFlag === 'achievement' ? 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20' : activity.insightFlag === 'concern' ? 'text-[#E30A17] bg-[#E30A17]/10 border-[#E30A17]/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>
                     {activity.insightFlag === 'achievement' ? <TrendingUp className="w-3 h-3"/> : activity.insightFlag === 'concern' ? <AlertTriangle className="w-3 h-3"/> : null}
                     Insight: {activity.insightFlag || 'Curated'}
                   </span>
                 )}
               </div>
               
               {/* Instructor/Admin Flag controls */}
               {(user?.role === 'instructor' || user?.role === 'admin') && filterType === 'all' && activity.visibility !== 'insight' && (
                 <div className="flex gap-2">
                   <button onClick={() => handleFlag(activity.id, 'achievement')} className="text-[10px] font-black   text-[#00D4FF] hover:bg-[#00D4FF]/20 bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1 rounded-md transition-colors">Flag Achievement</button>
                   <button onClick={() => handleFlag(activity.id, 'concern')} className="text-[10px] font-black   text-[#E30A17] hover:bg-[#E30A17]/20 bg-[#E30A17]/10 border border-[#E30A17]/20 px-3 py-1 rounded-md transition-colors">Flag Concern</button>
                 </div>
               )}

               {/* Parent Support Portal action */}
               {user?.role === 'parent' && activity.visibility === 'insight' && activity.insightFlag === 'concern' && (
                 <div className="flex gap-2">
                   <button onClick={() => navigate('/dashboard/messages')} className="text-[10px] font-black   text-[#00D4FF] hover:bg-[#00D4FF]/20 bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                     <MessageSquare className="w-3 h-3" /> Contact Faculty
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
      ))}
      {activities.length >= currentLimit && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setCurrentLimit((prevLimit) => prevLimit + limit)}
            className="rounded-full bg-[#00D4FF] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#00a3cc]"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
