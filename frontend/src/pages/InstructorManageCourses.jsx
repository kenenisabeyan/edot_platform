import React, { useEffect, useState, useCallback, useMemo } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  FolderOpen, Edit3, Clock, CheckCircle2, 
  XSquare, PlayCircle, Send, Users, Sparkles, X, LayoutGrid, Star,
  Globe, Calculator, BookOpen, Rocket, Target, UserCheck, List, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import PremiumModal from '../components/PremiumModal';
import CourseFallbackThumbnail from '../components/CourseFallbackThumbnail';
import CourseInsightsPanel from '../components/CourseInsightsPanel';
import CourseIntelligenceStatusPanel from '../components/CourseIntelligenceStatusPanel';

const CATEGORY_MAP = {
  "Social Science": {
    color: "#F97316", // Orange
    gradient: "from-orange-500/20 to-orange-600/10",
    bannerGradient: "from-orange-500 to-red-600",
    badgeBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(249,115,22,0.15)] hover:border-orange-500/40",
    buttonHover: "hover:bg-orange-500 hover:text-white hover:border-orange-500",
    icon: Globe
  },
  "Mathematics & Natural Science": {
    color: "#3B82F6", // Blue
    gradient: "from-blue-500/20 to-blue-600/10",
    bannerGradient: "from-blue-600 to-indigo-700",
    badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(59,130,246,0.15)] hover:border-blue-500/40",
    buttonHover: "hover:bg-blue-500 hover:text-white hover:border-blue-500",
    icon: Calculator
  },
  "Natural Language": {
    color: "#A855F7", // Purple
    gradient: "from-purple-500/20 to-purple-600/10",
    bannerGradient: "from-purple-600 to-pink-700",
    badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(168,85,247,0.15)] hover:border-purple-500/40",
    buttonHover: "hover:bg-purple-500 hover:text-white hover:border-purple-500",
    icon: BookOpen
  },
  "Programming & Technology": {
    color: "#6366F1", // Indigo
    gradient: "from-indigo-500/20 to-indigo-600/10",
    bannerGradient: "from-indigo-600 to-violet-700",
    badgeBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(99,102,241,0.15)] hover:border-indigo-500/40",
    buttonHover: "hover:bg-indigo-500 hover:text-white hover:border-indigo-500",
    icon: Rocket
  },
  "Business & Entrepreneurship": {
    color: "#FFD700", // Gold
    gradient: "from-amber-400/20 to-amber-600/10",
    bannerGradient: "from-amber-400 to-amber-600",
    badgeBg: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(255,215,0,0.15)] hover:border-amber-400/40",
    buttonHover: "hover:bg-[#FFD700] hover:text-slate-900 hover:border-[#FFD700]",
    icon: Target
  },
  "Personal Development": {
    color: "#22C55E", // Green
    gradient: "from-emerald-500/20 to-emerald-600/10",
    bannerGradient: "from-emerald-500 to-teal-600",
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    hoverGlow: "hover:shadow-[0_15px_30px_rgba(34,197,94,0.15)] hover:border-emerald-500/40",
    buttonHover: "hover:bg-emerald-500 hover:text-slate-900 hover:border-emerald-500",
    icon: UserCheck
  }
};

const DEFAULT_CAT = {
  color: "#94A3B8",
  gradient: "from-slate-500/20 to-slate-600/10",
  bannerGradient: "from-slate-600 to-slate-800",
  badgeBg: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  hoverGlow: "hover:shadow-[0_15px_30px_rgba(148,163,184,0.15)] hover:border-slate-500/40",
  buttonHover: "hover:bg-slate-500 hover:text-white hover:border-slate-500",
  icon: FolderOpen
};

const normalizeCategory = (cat) => {
  const c = cat?.toLowerCase() || '';
  if (c.includes('social')) return 'Social Science';
  if (c.includes('math') || c.includes('science')) return 'Mathematics & Natural Science';
  if (c.includes('language')) return 'Natural Language';
  if (c.includes('programming') || c.includes('tech')) return 'Programming & Technology';
  if (c.includes('business') || c.includes('entrepreneur')) return 'Business & Entrepreneurship';
  if (c.includes('personal') || c.includes('growth') || c.includes('development')) return 'Personal Development';
  return 'General Overview';
};

export default function InstructorManageCourses() {
  const isDarkMode = useThemeMode();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';

  const [modalType, setModalType] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseStudents, setCourseStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');

  const { data: courses = [], isLoading: loading, refetch: fetchCourses } = useQuery({
    queryKey: ['manageCourses', isAdmin],
    queryFn: async () => {
      const endpoint = isAdmin ? '/admin/courses' : '/instructor/courses';
      const { data } = await api.get(endpoint);
      return data.data || [];
    }
  });

  const coursesByCategory = useMemo(() => {
    const grouped = {};
    courses.forEach(course => {
      const category = course.mainCategory || course.category || 'General Overview';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(course);
    });
    return grouped;
  }, [courses]);

  const filteredCoursesList = useMemo(() => {
    return courses.filter(c => {
      const cat = c.mainCategory || c.category || 'General Overview';
      return selectedCategory === 'All' || cat === selectedCategory;
    });
  }, [courses, selectedCategory]);

  const openLessons = (course) => {
    setActiveCourse(course);
    setModalType('lessons');
  };

  const openStudents = async (course) => {
    setActiveCourse(course);
    setModalType('students');
    setLoadingStudents(true);
    try {
      const { data } = await api.get(`/courses/${course.id}/students`);
      if (data.success) {
         setCourseStudents(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const openInsights = (course) => {
    setActiveCourse(course);
    setModalType('insights');
  };

  const openOnboarding = (course) => {
    setActiveCourse(course);
    setModalType('onboarding');
  };

  const handleSubmitReview = async (courseId) => {
    if (isAdmin) return;
    try {
      await api.put(`/instructor/courses/${courseId}/submit`);
      fetchCourses();
    } catch (err) {
      console.error('Failed to submit for review', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#00D4FF] rounded-full animate-spin shadow-[0_0_15px_rgba(255,215,0,0.4)]"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.5 }}
      className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full"
    >
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <LayoutGrid className="w-8 h-8 text-[#00D4FF]" />
            Manage Courses
          </h1>
          <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Build, edit, and orchestrate top-tier learning experiences across domains.</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard/builder')} 
          className={`inline-flex items-center gap-2 px-6 py-3 font-black rounded-xl hover:-translate-y-0.5 transition-transform bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
        >
          <Sparkles className="w-4 h-4" /> 
          <span>Create New Course</span>
        </button>
      </div>
      
      {/* Category Filter Tabs and View Mode Switcher */}
      {courses.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
          <div className="flex-1 min-w-0">
            <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Filter by Category</label>
            <div className="flex flex-wrap gap-2.5 pb-2 overflow-x-auto scrollbar-thin">
              <button 
                onClick={() => setSelectedCategory('All')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-300 ${
                  selectedCategory === 'All'
                    ? 'bg-[#00D4FF] border-[#00D4FF] text-slate-900 shadow-[0_4px_20px_rgba(0,212,255,0.25)]'
                    : isDarkMode
                      ? 'bg-[#0B1120] border-white/10 text-slate-300 hover:border-white/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'
                }`}
              >
                All Categories
              </button>
              {Object.keys(coursesByCategory).sort().map(cat => {
                const normalized = normalizeCategory(cat);
                const catInfo = CATEGORY_MAP[normalized] || DEFAULT_CAT;
                const isActive = selectedCategory === cat;
                return (
                  <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all duration-300 flex items-center gap-2 ${
                      isActive
                        ? `text-white shadow-lg`
                        : isDarkMode
                          ? 'bg-[#0B1120] border-white/10 text-slate-300 hover:border-white/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'
                    }`}
                    style={isActive ? {
                      backgroundColor: catInfo.color,
                      borderColor: catInfo.color,
                      boxShadow: `0 4px 20px ${catInfo.color}40`
                    } : {}}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>View Mode</label>
            <div className={`flex items-center gap-1.5 p-1 rounded-full border transition-colors ${isDarkMode ? 'bg-[#0F172A] border-white/10' : 'bg-[#F8FAFC] border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-full transition-all ${
                  viewMode === 'grid' 
                    ? (isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]' : 'bg-[#e0f7ff] text-[#0088cc] border border-[#00D4FF] shadow-sm') 
                    : 'text-slate-400 hover:text-slate-600 border border-transparent'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2.5 rounded-full transition-all ${
                  viewMode === 'table' 
                    ? (isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]' : 'bg-[#e0f7ff] text-[#0088cc] border border-[#00D4FF] shadow-sm') 
                    : 'text-slate-400 hover:text-slate-600 border border-transparent'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {courses.length === 0 ? (
          <div className={`p-16 text-center rounded-3xl border shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden group ${isDarkMode ? 'border-white/10 bg-[#0B1120]/90' : 'border-slate-200 bg-white/95'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#008A32]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            <div className={`w-24 h-24 border rounded-full flex items-center justify-center mb-6 relative group-hover:scale-110 transition-transform duration-500 group-hover:border-[#00D4FF]/30 group-hover:text-[#00D4FF] ${isDarkMode ? 'bg-[#0B1120]/5 text-slate-200 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              <FolderOpen className="w-12 h-12" />
            </div>
            <h3 className={`text-2xl font-display font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Digital Vault is Empty</h3>
            <p className={`max-w-sm mb-8 text-lg ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>You have not created or managed any courses yet.</p>
            <button 
              onClick={() => navigate('/dashboard/builder')} 
              className={`px-8 py-3.5 bg-gradient-to-r from-[#008A32] to-[#006622] font-bold rounded-xl hover:shadow-[0_0_25px_rgba(0,138,50,0.4)] transition-all hover:-translate-y-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              Start Creating Now
            </button>
          </div>
      ) : (
        viewMode === 'grid' ? (
          filteredCoursesList.length === 0 ? (
            <div className={`p-16 text-center rounded-3xl border shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden group ${isDarkMode ? 'border-white/10 bg-[#0B1120]/90' : 'border-slate-200 bg-white/95'}`}>
              <FolderOpen className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className={`text-2xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>No courses found</h3>
              <p className={`font-medium max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>We couldn't find any courses matching your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {filteredCoursesList.map(c => {
                const normalized = normalizeCategory(c.mainCategory || c.category);
                const catInfo = CATEGORY_MAP[normalized] || DEFAULT_CAT;
                
                // Calculate display time
                const totalMins = c.lessons?.reduce((acc, l) => acc + (l.duration || 0), 0) || 0;
                const hasLessons = Array.isArray(c.lessons) && c.lessons.length > 0;
                const displayTime = hasLessons && totalMins > 0 
                  ? (totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins}m`) 
                  : `${c.duration || 0}h`;

                // Stable ratings based on course ID
                const ratingSeed = (c.id.charCodeAt(0) + c.id.charCodeAt(c.id.length - 1)) % 10;
                const courseRating = (4.5 + (ratingSeed / 20)).toFixed(1);
                const reviewsSeed = (c.id.charCodeAt(1) + c.id.charCodeAt(c.id.length - 2)) * 3 % 200 + 40;
                const contrastTextColor = catInfo.color === "#FFD700" ? "#0F172A" : "#FFFFFF";

                return (
                  <motion.div 
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    key={c.id} 
                    className={`rounded-[32px] border shadow-2xl flex flex-col group transition-all duration-300 h-full relative overflow-hidden ${
                      isDarkMode 
                        ? `border-white/5 bg-[#0B1120]/80 ${catInfo.hoverGlow}` 
                        : `border-slate-200/60 bg-white ${catInfo.hoverGlow}`
                    }`}
                    style={{
                      '--cat-color': catInfo.color,
                      borderTop: `6px solid ${catInfo.color}`
                    }}
                  >
                    {/* Thumbnail Wrapper */}
                    <div className="p-4 pb-0 shrink-0">
                      <div className="w-full h-[200px] relative overflow-hidden bg-slate-900 flex items-center justify-center rounded-2xl">
                         {c.thumbnail && c.thumbnail !== 'default-course.jpg' ? (
                           <img 
                             src={c.thumbnail} 
                             alt={c.title} 
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                           />
                         ) : (
                           <CourseFallbackThumbnail 
                             color={catInfo.color} 
                             darkColor={catInfo.color} 
                             ribbon={c.mainCategory} 
                             fallbackId={c.id} 
                           />
                         )}

                         {/* Status Badge in lowercase pill border shape */}
                         <div className="absolute top-4 right-4 z-20">
                           <span 
                             className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border"
                             style={{ backgroundColor: catInfo.color, color: contrastTextColor, borderColor: 'transparent' }}
                           >
                             {(c.status || 'draft').toLowerCase()}
                           </span>
                         </div>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 flex flex-col flex-1">
                      {/* Title */}
                      <h4 className="text-lg font-bold font-display leading-snug line-clamp-2 mb-2 transition-colors duration-300"
                        style={{ color: catInfo.color }}
                      >
                        {c.title}
                      </h4>

                      {/* Info Row (styled as solid interactive pills in category colors) */}
                      <div className="flex flex-wrap items-center gap-2.5 mb-4">
                        {/* Duration (non-clickable pill) */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors shadow-sm"
                          style={{
                            backgroundColor: catInfo.color,
                            borderColor: catInfo.color,
                            color: contrastTextColor
                          }}
                        >
                          <Clock className="w-3.5 h-3.5 opacity-90" />
                          {displayTime}
                        </span>
                        
                        {/* Lessons Button (clickable pill styled by category color) */}
                        <button 
                          onClick={() => openLessons(c)} 
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold border transition-all duration-300 shadow-md cursor-pointer hover:brightness-110 active:scale-95"
                          style={{
                            backgroundColor: catInfo.color,
                            borderColor: catInfo.color,
                            color: contrastTextColor,
                          }}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {c.lessons?.length || 0} Lessons
                        </button>
                        
                        {/* Students Button (clickable pill styled by category color) */}
                        <button 
                          onClick={() => openStudents(c)} 
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold border transition-all duration-300 shadow-md cursor-pointer hover:brightness-110 active:scale-95"
                          style={{
                            backgroundColor: catInfo.color,
                            borderColor: catInfo.color,
                            color: contrastTextColor,
                          }}
                        >
                          <Users className="w-3.5 h-3.5" />
                          {c.totalStudents || 0} Students
                        </button>
                      </div>

                      {/* Course Creator/Instructor Row */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                          {c.instructor && c.instructor.avatar && c.instructor.avatar !== 'default-avatar.png' ? (
                            <img 
                              src={c.instructor.avatar.startsWith('http') ? c.instructor.avatar : `http://localhost:5000${c.instructor.avatar.startsWith('/') ? '' : '/'}${c.instructor.avatar}`} 
                              alt={c.instructor.name || 'Instructor'} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center w-full h-full">
                            {c.instructor?.name ? c.instructor.name.charAt(0) : '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Instructor</p>
                          <p className={`text-[13px] font-bold truncate leading-snug ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{c.instructor?.name || 'EDOT Creator'}</p>
                        </div>
                      </div>

                      {/* Level and Rating Row */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5 mt-auto mb-6">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full border transition-all shadow-sm"
                          style={{
                            backgroundColor: catInfo.color,
                            borderColor: catInfo.color,
                            color: contrastTextColor
                          }}
                        >
                          {c.level || 'Beginner'}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{courseRating}</span>
                          <span className="text-slate-400 dark:text-slate-500 font-semibold">({reviewsSeed})</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2.5">
                        {!isAdmin && (c.status === 'draft' || c.status === 'rejected') && (
                          <button 
                            onClick={() => handleSubmitReview(c.id)} 
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-2xl hover:shadow-[0_6px_20px_rgba(16,185,129,0.3)] transition-all text-xs"
                          >
                            <Send className="w-3.5 h-3.5" /> Submit for Review
                          </button>
                        )}
                        
                        {c.status !== 'pending' && (
                          <button 
                            onClick={() => navigate('/dashboard/builder/' + c.id)} 
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-2xl border transition-all duration-300 text-xs cursor-pointer shadow-md hover:brightness-110"
                            style={{
                              backgroundColor: catInfo.color,
                              borderColor: catInfo.color,
                              color: contrastTextColor
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit Content
                          </button>
                        )}
                        
                        <button 
                          onClick={() => navigate('/dashboard/library', { state: { courseId: c.id } })} 
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 font-bold rounded-2xl border transition-all duration-300 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5"
                          style={{
                            borderColor: catInfo.color,
                            color: catInfo.color,
                            backgroundColor: 'transparent'
                          }}
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Course Resources
                        </button>

                        <button 
                          onClick={() => openInsights(c)} 
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-2xl border transition-all duration-300 text-xs cursor-pointer bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> Intelligence Insights
                        </button>

                        <button 
                          onClick={() => openOnboarding(c)} 
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-2xl border transition-all duration-300 text-xs cursor-pointer bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Onboarding Pipeline Status
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          /* Table list view mode */
          <div className={`rounded-[2.5rem] p-8 border backdrop-blur-2xl shadow-2xl overflow-hidden relative transition-all duration-500 ${isDarkMode ? 'border-white/10 bg-[#0B1120]/80' : 'border-slate-200 bg-white/90 hover:border-[#00D4FF]/30'}`}>
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00D4FF]/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#00D4FF]/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>

            {filteredCoursesList.length === 0 ? (
              <p className={`text-sm italic font-medium p-4 border border-dashed rounded-2xl text-center ${isDarkMode ? 'text-slate-400 border-white/10' : 'text-slate-500 border-slate-200'}`}>
                No courses match selected category.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'bg-[#0B1120]/40 text-slate-400' : 'bg-slate-100/80 text-slate-500'} border-b ${isDarkMode ? 'border-[#00D4FF]/20' : 'border-[#00D4FF]/10'}`}>
                      <th className="px-6 py-4 rounded-tl-2xl">Course Details</th>
                      <th className="px-6 py-4">Level</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Total Students</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 rounded-tr-2xl text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-sm font-bold ${isDarkMode ? 'divide-white/5 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                    {filteredCoursesList.map(c => {
                      const normalized = normalizeCategory(c.mainCategory || c.category);
                      const catInfo = CATEGORY_MAP[normalized] || DEFAULT_CAT;
                      const contrastTextColor = catInfo.color === "#FFD700" ? "#0F172A" : "#FFFFFF";

                      return (
                        <tr key={c.id} className={`transition-colors duration-300 ${isDarkMode ? 'hover:bg-[#00D4FF]/5' : 'hover:bg-[#00D4FF]/5'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-10 rounded overflow-hidden shrink-0 relative bg-[#030303] flex items-center justify-center">
                                {c.thumbnail && c.thumbnail !== 'default-course.jpg' ? (
                                  <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="absolute w-[260px] h-[220px] scale-[0.15] origin-center flex items-center justify-center">
                                    <CourseFallbackThumbnail 
                                      color={catInfo.color} 
                                      darkColor={catInfo.color} 
                                      ribbon={c.mainCategory} 
                                      fallbackId={c.id} 
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                    {c.instructor && c.instructor.avatar && c.instructor.avatar !== 'default-avatar.png' ? (
                                      <img 
                                        src={c.instructor.avatar.startsWith('http') ? c.instructor.avatar : `http://localhost:5000${c.instructor.avatar.startsWith('/') ? '' : '/'}${c.instructor.avatar}`} 
                                        alt={c.instructor.name || 'Instructor'} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center w-full h-full">
                                      {c.instructor?.name ? c.instructor.name.charAt(0) : '?'}
                                    </span>
                                  </div>
                                  <span className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>{c.instructor?.name || 'EDOT Creator'}</span>
                                </div>
                                <div className={`font-black text-sm truncate mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.title}</div>
                                <div className="text-xs text-slate-400 font-medium line-clamp-1">{c.description || 'No description provided.'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className="px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors shadow-sm"
                              style={{
                                backgroundColor: catInfo.color,
                                borderColor: catInfo.color,
                                color: contrastTextColor
                              }}
                            >
                              {c.level || 'Beginner'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ color: catInfo.color }}>
                              {c.mainCategory || c.category || 'General'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => openStudents(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-all duration-300 shadow-md cursor-pointer hover:brightness-110 active:scale-95"
                              style={{
                                backgroundColor: catInfo.color,
                                borderColor: catInfo.color,
                                color: contrastTextColor
                              }}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{c.totalStudents || 0} Students</span>
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span 
                              className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border"
                              style={{ backgroundColor: catInfo.color, color: contrastTextColor, borderColor: 'transparent' }}
                            >
                              {(c.status || 'draft').toLowerCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex gap-2 justify-end">
                              {!isAdmin && (c.status === 'draft' || c.status === 'rejected') && (
                                <button 
                                  onClick={() => handleSubmitReview(c.id)} 
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:shadow-md transition-all text-xs"
                                >
                                  <Send className="w-3 h-3" /> Submit for Review
                                </button>
                              )}
                              
                              {c.status !== 'pending' && (
                                <button 
                                  onClick={() => navigate('/dashboard/builder/' + c.id)} 
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 font-bold rounded-xl border transition-all duration-300 text-xs hover:brightness-110 shadow-md"
                                  style={{
                                    backgroundColor: catInfo.color,
                                    borderColor: catInfo.color,
                                    color: contrastTextColor
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" /> Edit Content
                                </button>
                              )}
                              
                              <button 
                                onClick={() => navigate('/dashboard/library', { state: { courseId: c.id } })} 
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 font-bold rounded-xl border transition-all duration-300 text-xs hover:bg-slate-100 dark:hover:bg-white/5"
                                style={{
                                  borderColor: catInfo.color,
                                  color: catInfo.color,
                                  backgroundColor: 'transparent'
                                }}
                              >
                                <FolderOpen className="w-3 h-3" /> Course Resources
                              </button>

                              <button 
                                onClick={() => openInsights(c)} 
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 font-bold rounded-xl border transition-all duration-300 text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
                              >
                                <BarChart3 className="w-3 h-3" /> Insights
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* Modals remain mostly unchanged but fit aesthetic */}
      <PremiumModal isOpen={!!(modalType && activeCourse)} onClose={() => { setModalType(null); setActiveCourse(null); }} maxWidth="max-w-2xl">
             <div className="p-6 md:p-8 flex flex-col h-full w-full">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
              <div className={`flex justify-between items-center mb-6 border-b pb-4 relative z-10 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div>
                  <h3 className={`text-2xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {modalType === 'lessons' ? <PlayCircle className="w-7 h-7 text-[#00D4FF]" /> : modalType === 'insights' ? <BarChart3 className="w-7 h-7 text-cyan-400" /> : <Users className="w-7 h-7 text-indigo-400" />}
                    {modalType === 'lessons' ? 'Course Lessons' : modalType === 'insights' ? 'Intelligence Insights' : 'Enrolled Students'}
                  </h3>
                  <p className="text-sm text-[#00D4FF] font-semibold mt-1">{activeCourse?.title}</p>
                </div>
                <button onClick={() => setModalType(null)} className={`p-2 hover:bg-[#E30A17]/20 hover:text-[#E30A17] rounded-xl transition-colors ${isDarkMode ? 'bg-[#0B1120]/5 text-slate-200' : 'bg-slate-50 text-slate-600'}`}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto overflow-x-hidden pr-2 space-y-3 custom-scrollbar flex-1">
                {modalType === 'insights' && (
                  <CourseInsightsPanel courseId={activeCourse?.id} isDarkMode={isDarkMode} />
                )}

                {modalType === 'onboarding' && (
                  <CourseIntelligenceStatusPanel courseId={activeCourse?.id} courseTitle={activeCourse?.title} isDarkMode={isDarkMode} />
                )}

                {modalType === 'lessons' && (
                  activeCourse?.lessons?.length === 0 ? (
                    <div className={`text-center p-8 italic rounded-2xl border ${isDarkMode ? 'text-slate-200 bg-[#0B1120]/5 border-white/5' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>No lessons have been added to this course yet.</div>
                  ) : (
                    activeCourse?.lessons?.map((l, index) => (
                      <div key={l.id || index} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border hover:border-[#00D4FF]/30 transition-colors group ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/20 text-[#00D4FF] flex items-center justify-center font-bold font-display shrink-0 group-hover:scale-110 transition-transform">{index + 1}</div>
                        <div className="flex-1">
                          <h4 className={`font-bold text-lg leading-tight mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{l.title}</h4>
                          <p className={`text-xs flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}><Clock className="w-3.5 h-3.5" /> {l.duration} min</p>
                        </div>
                        <div className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-bold bg-black/40 border ${isDarkMode ? 'text-slate-300 border-white/10' : 'text-slate-500 border-slate-200'}`}>
                          {l.lesson_exam ? 'Has Quiz' : 'Video Only'}
                        </div>
                      </div>
                    ))
                  )
                )}

                {modalType === 'students' && (
                  loadingStudents ? (
                    <div className="flex justify-center p-12"><div className="w-10 h-10 border-4 border-white/20 border-t-[#00D4FF] rounded-full animate-spin"></div></div>
                  ) : courseStudents.length === 0 ? (
                    <div className={`text-center p-8 italic rounded-2xl border ${isDarkMode ? 'text-slate-200 bg-[#0B1120]/5 border-white/5' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>No students are currently enrolled in this course.</div>
                  ) : (
                    courseStudents.map((stu) => (
                      <div key={stu.id} className={`flex items-center gap-4 p-4 rounded-2xl border hover:border-indigo-500/30 transition-colors group ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="w-12 h-12 rounded-full bg-indigo-500/100/20 text-indigo-400 flex items-center justify-center font-bold text-lg  shadow-inner border border-indigo-500/20 group-hover:scale-110 transition-transform shrink-0">
                          {stu.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stu.name}</h4>
                          <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{stu.email}</p>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
             </div>
      </PremiumModal>

    </motion.div>
  );
}
