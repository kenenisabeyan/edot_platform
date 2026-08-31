import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { 
  Award, TrendingUp, CheckCircle2, 
  Flame, Target, ChevronRight, PlayCircle, BookOpen, Clock, BarChart2, Star, Zap,
  CheckCircle, ArrowUpRight, GraduationCap, ShieldCheck, MoreHorizontal, Atom, Code, Calculator, MessageSquare, Users, Loader2
} from 'lucide-react';
import api from '../../utils/api';
import PremiumModal from '../PremiumModal';
import ErrorBoundary from '../ErrorBoundary';

const StudentOverview = ({ 
  user, 
  enrolledCourses, 
  completedCourses, 
  totalEnrolled, 
  totalLessonsCompleted, 
  averageProgress, 
  isDarkMode,
  setActiveTab,
  dashboardStats,
  sectionsData = [],
  certificateSummary = { claimed: 0, readyToClaim: 0, total: 0 }
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [certificateDropdownOpen, setCertificateDropdownOpen] = useState(false);
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [claimingCertificateId, setClaimingCertificateId] = useState(null);
  const dropdownRef = useRef(null);
  const [twinProfile, setTwinProfile] = useState(null);
  const [loadingTwin, setLoadingTwin] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTwin = async () => {
      try {
        setLoadingTwin(true);
        const { data } = await api.get('/ai/twin');
        if (data.success && isMounted) {
          setTwinProfile(data.twinProfile);
        }
      } catch (err) {
        console.error('Failed to fetch AI twin profile', err);
      } finally {
        if (isMounted) setLoadingTwin(false);
      }
    };
    fetchTwin();
    return () => { isMounted = false; };
  }, []);


  const toggleCertificateDropdown = () => setCertificateDropdownOpen((prev) => !prev);

  useEffect(() => {
    if (!certificateDropdownOpen) return;
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setCertificateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [certificateDropdownOpen]);

  const handleClaimCertificate = async (courseId) => {
    try {
      setClaimingCertificateId(courseId);
      await api.post('/progress/certificate', { courseId });
      queryClient.invalidateQueries({ queryKey: ['edotDashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setCertificateDropdownOpen(true);
    } catch (err) {
      console.error('Failed to claim certificate', err);
      alert(err.response?.data?.message || 'Failed to claim certificate');
    } finally {
      setClaimingCertificateId(null);
    }
  };

  const openCertificatePage = () => {
    setCertificateDropdownOpen(false);
    navigate('/dashboard/certificates');
  };
  const {
    study = {},
    progress = {},
    recentCourses = [],
    achievements = []
  } = dashboardStats || {};

  const {
    weeklyStudyData = [
      { name: 'Mon', hours: 0 }, { name: 'Tue', hours: 0 }, { name: 'Wed', hours: 0 },
      { name: 'Thu', hours: 0 }, { name: 'Fri', hours: 0 }, { name: 'Sat', hours: 0 }, { name: 'Sun', hours: 0 }
    ],
    studyGoal = 10,
    daysStudied = 0,
  } = study;

  const { percentile = 0 } = progress;

  const { data: recentContactsData, isLoading: loadingMessages } = useQuery({
    queryKey: ['recentMessagesOverview'],
    queryFn: async () => {
      const { data } = await api.get('/messages/recent');
      return data.success ? data.data : [];
    },
    refetchInterval: 30000
  });

  const allRecentContacts = recentContactsData || [];
  const recentContacts = allRecentContacts.slice(0, 4);

  const safeWeeklyData = Array.isArray(weeklyStudyData) ? weeklyStudyData : [];
  const totalWeeklyHours = safeWeeklyData.reduce((acc, curr) => acc + (curr?.hours || 0), 0).toFixed(1);

  const certificateEarned = certificateSummary?.claimed || 0;
  const certificateReady = certificateSummary?.readyToClaim || 0;
  const certificateTotal = certificateSummary?.total || 0;
  const certificateSubtitle = certificateTotal === 0
    ? (certificateReady > 0 ? `0 earned • ${certificateReady} ready` : 'No certificates yet')
    : certificateReady > 0
      ? `${certificateEarned} earned • ${certificateReady} ready`
      : `${certificateEarned} earned`;

  const claimedCertificates = Array.isArray(dashboardStats?.certificates) ? dashboardStats.certificates : [];
  const claimedCourseIds = new Set(claimedCertificates.map(cert => cert?.courseId || cert?.id));
  const safeCompletedCourses = Array.isArray(completedCourses) ? completedCourses : [];
  const readyCertificates = safeCompletedCourses.filter(course => {
    if (!course) return false;
    const courseId = course.course?.id || course.courseId;
    const isPassed = !course.course?.isExamRequired || course.passedFinalExam;
    return !claimedCourseIds.has(courseId) && isPassed;
  });
  const hasCertificates = claimedCertificates.length > 0 || readyCertificates.length > 0;

  const cardClass = isDarkMode ? 'bg-[#121A2F] border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900';
  const textClass = isDarkMode ? 'text-white' : 'text-slate-900';
  const mutedTextClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  // SVG Circular Progress
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // Progress represented as a full circle
  const maxDisplayPercentage = 100; 
  // Use real average progress data
  const progressPercentage = (averageProgress / 100) * maxDisplayPercentage;
  
  const trackStrokeDasharray = `${(maxDisplayPercentage / 100) * circumference} ${circumference}`;
  const progressStrokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
<motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative space-y-6 w-full max-w-none pb-10" ref={dropdownRef}>
      
      {/* Hero Banner */}
      {/* Hero Banner */}
      <motion.div variants={itemVariants} className={`p-8 md:px-12 md:py-10 min-h-[240px] rounded-[32px] relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 transition-all duration-500 ${isDarkMode ? 'bg-[#0B1D3A] border border-[#1e293b]' : 'bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-[#EAF7FF] border border-[#E5E7EB]'}`}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-20 -top-16 w-48 h-48 rounded-full bg-[#38BDF8]/20 blur-3xl"></div>
          <div className="absolute right-8 top-12 w-44 h-44 rounded-full bg-[#F97316]/15 blur-3xl"></div>
          <div className="absolute left-1/2 bottom-0 w-60 h-60 rounded-full bg-[#22C55E]/10 blur-3xl transform -translate-x-1/2"></div>
        </div>
        
        {/* Left Content */}
        <div className="relative z-10 flex-1 min-w-[300px]">
          <h1 className={`text-3xl md:text-[34px] font-black mb-3 font-['Inter',sans-serif] tracking-tight leading-tight flex flex-col sm:flex-row sm:items-center gap-3 ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>
            <span>Welcome back, {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Learner'}! <span className="text-3xl">👋</span></span>
            {(user?.position || (user?.learnerGroups && user.learnerGroups.length > 0) || user?.role) && (
                <span className={`text-[10px] sm:ml-2 font-bold px-3 py-1 rounded-full uppercase tracking-widest w-max shadow-sm ${isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'}`}>
                    {user?.position || user?.learnerGroups?.[0]?.name || user?.role}
                </span>
            )}
          </h1>
          <p className={`text-[15px] font-medium mb-8 ${isDarkMode ? 'text-slate-400' : 'text-[#6B7280]'}`}>
            Keep learning, keep growing. You're doing great!
          </p>
          <motion.button 
            whileHover={{ scale: 1.03, boxShadow: '0px 20px 50px rgba(0, 212, 255, 0.18)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('courses')} 
            className={`px-6 py-3 font-bold text-[14px] rounded-2xl transition-all flex items-center gap-2 w-max shadow-lg
            ${isDarkMode ? 'bg-[#0F172A] border border-[#0F172A] text-white shadow-[0_20px_50px_rgba(0,212,255,0.18)]' 
                         : 'bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white shadow-[0_20px_50px_rgba(14,165,233,0.24)]'}`}
          >
            <span className="text-xl leading-none font-medium mb-0.5">+</span> Start a Lesson
          </motion.button>
        </div>

        {/* Center 3D Illustration */}
        <div className="relative flex items-center justify-center w-[300px] md:w-[400px] h-56 md:h-[220px]">
          
          {/* 3D Illustration */}
          <motion.img 
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            src="https://cdn3d.iconscout.com/3d/premium/thumb/student-using-laptop-5309325-4441549.png" 
            alt="Student Learning" 
            className="w-64 md:w-80 object-contain relative z-10 drop-shadow-2xl"
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          {/* Desk Shadow Grounding */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 h-6 bg-black/5 dark:bg-black/20 blur-xl rounded-[100%] z-0"></div>
        </div>

        {/* Far Right Section (Profile & Streak) */}
        <div className="relative shrink-0 z-20 hidden md:flex items-center gap-6">
          
          {/* Profile Picture */}
          <motion.div 
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            whileHover={{ scale: 1.05, boxShadow: "0px 15px 30px rgba(0,0,0,0.15)" }}
            className={`rounded-full shadow-[0_10px_40px_rgb(0,0,0,0.12)] w-[160px] h-[160px] relative shrink-0 border-[8px] transition-colors duration-500 ${daysStudied >= 7 ? 'border-[#00D4FF] shadow-[#00D4FF]/30' : daysStudied >= 3 ? 'border-[#00D4FF] shadow-[#00D4FF]/30' : isDarkMode ? 'border-slate-700' : 'border-white'}`}
          >
             <img 
               src={user?.avatar && user.avatar !== 'default-avatar.png' ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Student')}&background=F97316&color=fff&size=256&font-size=0.4`}
               alt="User Profile" 
               className="w-full h-full rounded-full object-cover" 
             />
             <div className="absolute bottom-2 right-2 w-8 h-8 bg-emerald-500 border-[6px] border-white dark:border-[#1E293B] rounded-full z-10"></div>
          </motion.div>

          {/* Streak Card */}
          <motion.div 
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            whileHover={{ y: -5, boxShadow: "0px 15px 30px rgba(0,0,0,0.1)" }}
            className={`p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col justify-center w-[150px] h-[160px] ${isDarkMode ? 'bg-[#1E293B] border border-slate-700' : 'bg-[#FFFFFF] border border-[#E5E7EB]'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-8 h-8 text-[#00D4FF]" fill="#00D4FF" />
              <span className={`text-[32px] leading-none font-black ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>{daysStudied || 0}</span>
            </div>
            <span className={`text-[13px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-[#6B7280]'}`}>Day Streak</span>
            <span className={`text-[11px] font-medium mt-1 mb-4 ${isDarkMode ? 'text-slate-500' : 'text-[#6B7280]'}`}>
              {daysStudied >= 7 ? "You're on fire! 🔥" : daysStudied >= 3 ? "Keep it up!" : "Start a streak!"}
            </span>
            <div className="w-full h-2 bg-[#F5F7FF] dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#00D4FF] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (daysStudied / 7) * 100)}%` }}></div>
            </div>
      </motion.div>
    </div>
  </motion.div>

      {/* AI Learning Twin Widget */}
      <motion.div 
        variants={itemVariants} 
        className={`p-6 md:p-8 rounded-[32px] border relative overflow-hidden transition-all duration-300 ${
          isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-gradient-to-tr from-white via-slate-50 to-amber-50/20 border-slate-200/80 shadow-md'
        }`}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div className="flex-1 space-y-3 w-full">
            <h3 className={`text-base font-black flex items-center gap-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Atom className="w-5 h-5" /></span>
              EDOT AI Learning Twin
            </h3>
            {loadingTwin ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Analysing cognitive performance indicators...
              </div>
            ) : twinProfile ? (
              <div className="space-y-4 w-full">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                    Twin Mode: {twinProfile.pace}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold w-full">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-100'}`}>
                    <span className="text-[10px] font-black uppercase text-emerald-400 block mb-1">Knowledge Strengths</span>
                    <p className={isDarkMode ? 'text-slate-300 font-medium leading-relaxed' : 'text-slate-650 font-medium leading-relaxed'}>{twinProfile.strengths}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-100'}`}>
                    <span className="text-[10px] font-black uppercase text-amber-500 block mb-1">Focus & Growth Gaps</span>
                    <p className={isDarkMode ? 'text-slate-300 font-medium leading-relaxed' : 'text-slate-650 font-medium leading-relaxed'}>{twinProfile.weaknesses}</p>
                  </div>
                </div>
                <div className="pt-2 w-full">
                  <span className="text-[10px] font-black uppercase text-slate-450 block mb-2">Personalised Revision Roadmap</span>
                  <div className="flex flex-wrap gap-2">
                    {twinProfile.recommendations.map((rec, rIdx) => (
                      <span 
                        key={rIdx} 
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                          isDarkMode ? 'bg-slate-800/40 border-white/5 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                        }`}
                      >
                        🎯 {rec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Failed to render AI learning profile.</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Enrolled Courses', value: totalEnrolled.toString(), subtitle: 'Courses', trend: '', icon: ({className}) => <BookOpen className={className} fill="currentColor" strokeWidth={1} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { title: 'Average Progress', value: `${averageProgress}%`, subtitle: 'Across all courses', trend: '', icon: ({className}) => <TrendingUp className={className} strokeWidth={2.5} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { title: 'Completed Lessons', value: totalLessonsCompleted.toString(), subtitle: 'Lessons', trend: '', icon: ({className}) => <CheckCircle className={className} fill="currentColor" stroke="white" strokeWidth={1.5} />, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { title: 'Certificates', value: certificateTotal.toString(), subtitle: certificateSubtitle, action: 'View all certificates →', icon: ({className}) => <Award className={className} fill="currentColor" strokeWidth={1} />, color: 'text-[#00D4FF]', bg: 'bg-orange-50 dark:bg-[#00D4FF]/10' },
        ].map((stat, i) => (
          <motion.div key={i} variants={itemVariants} className={`p-6 rounded-[28px] border shadow-[0_14px_55px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_rgba(15,23,42,0.12)] ${isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-white border-slate-200/80'}`}>
            <div className="flex flex-col items-center text-center gap-3">
               {/* Icon */}
               <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
                 <stat.icon className="w-6 h-6" />
               </div>
               
               {/* Content */}
               <div className="flex flex-col items-center">
                 <p className={`text-[12px] font-bold mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.title}</p>
                 <h3 className={`text-[28px] font-bold leading-none ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>{stat.value}</h3>
                 <p className={`text-[11px] font-medium mt-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{stat.subtitle}</p>
                 
                 <div className="mt-3">
                   {stat.trend && (
                     <p className="text-[11px] font-bold text-emerald-500">{stat.trend}</p>
                   )}
                   {stat.action && (
                     <button onClick={toggleCertificateDropdown} className="text-[11px] font-bold text-[#00D4FF] hover:underline">
                       {stat.action}
                     </button>
                   )}
                 </div>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      <PremiumModal isOpen={certificateDropdownOpen} onClose={() => setCertificateDropdownOpen(false)} maxWidth="max-w-2xl">
                 <div className="flex flex-col w-full h-full p-6 md:p-8">
             {/* Brand Background Decorative Elements */}
             <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#00D4FF]/10 to-transparent pointer-events-none z-0"></div>
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00D4FF]/20 blur-[80px] pointer-events-none z-0"></div>
             <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00D4FF]/20 blur-[80px] pointer-events-none z-0"></div>

             <div className="relative z-10 flex flex-col flex-1 max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isDarkMode ? 'bg-[#1E293B] border border-slate-700' : 'bg-orange-50 border border-orange-100'}`}>
                    <Award className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Certificates</h3>
                    <p className={`text-sm font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {hasCertificates ? `${claimedCertificates.length} claimed • ${readyCertificates.length} ready to claim` : 'Your official credential hub'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setCertificateDropdownOpen(false)} 
                  className={`p-2 rounded-full transition-colors bg-white/5 backdrop-blur-sm border ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 border-slate-700/50' : 'hover:bg-slate-100 text-slate-500 border-slate-200'}`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Scrollable List Content */}
              <div className="mt-6 overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-8">
                {readyCertificates.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>Ready to Claim</h4>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${isDarkMode ? 'bg-[#00D4FF]/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>{readyCertificates.length} Available</span>
                    </div>
                    <div className="grid gap-3">
                      {readyCertificates.map((course) => {
                        const courseId = course.course?.id || course.courseId;
                        return (
                          <div key={courseId} className={`rounded-[20px] border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-lg ${isDarkMode ? 'border-slate-700/50 bg-[#121A2F]/80 hover:bg-[#121A2F]' : 'border-slate-200/80 bg-white hover:border-[#00D4FF]/30'}`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#00D4FF]/10 text-orange-400' : 'bg-orange-50 text-[#00D4FF]'}`}>
                                <Star className="w-5 h-5 fill-current" />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.course?.title || 'Untitled course'}</p>
                                <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Complete the process to issue your certificate.</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleClaimCertificate(courseId)}
                              disabled={claimingCertificateId === courseId}
                              className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${claimingCertificateId === courseId ? 'bg-slate-300 text-slate-700 cursor-not-allowed' : 'bg-[#00D4FF] hover:bg-[#EA580C] text-white hover:shadow-[#00D4FF]/20 hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                              {claimingCertificateId === courseId ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Issuing...</>
                              ) : 'Claim Certificate'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {claimedCertificates.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Claimed Certificates</h4>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{claimedCertificates.length} Earned</span>
                    </div>
                    <div className="grid gap-3">
                      {claimedCertificates.map((cert) => (
                        <div key={cert.id} className={`rounded-[20px] border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${isDarkMode ? 'border-slate-700/50 bg-[#121A2F]/50 hover:bg-[#121A2F]' : 'border-slate-200/80 bg-slate-50/50 hover:bg-white'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cert.course?.title || 'Certificate'}</p>
                              <p className={`text-[11px] font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Issued: {new Date(cert.issueDate || Date.now()).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button
                            onClick={openCertificatePage}
                            className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                          >
                            View Details
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasCertificates && (
                  <div className={`rounded-[24px] border p-10 text-center flex flex-col items-center justify-center min-h-[300px] ${isDarkMode ? 'border-slate-700/50 bg-[#121A2F]/50' : 'border-slate-200/80 bg-slate-50/50'}`}>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 ${isDarkMode ? 'bg-[#1E293B]' : 'bg-white shadow-sm'}`}>
                      <Award className={`w-12 h-12 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    </div>
                    <p className={`text-xl font-black mb-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No certificates yet</p>
                    <p className={`text-sm font-medium max-w-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Complete your first course and pass the final exam to earn an official certificate.
                    </p>
                    <button 
                      onClick={() => { setCertificateDropdownOpen(false); setActiveTab('courses'); }} 
                      className="mt-8 px-8 py-3.5 rounded-full bg-[#00D4FF] text-white font-bold hover:bg-[#EA580C] shadow-lg shadow-[#00D4FF]/20 transition-all hover:-translate-y-1"
                    >
                      Browse Courses
                    </button>
                  </div>
                )}
              </div>
               </div>
             </div>
      </PremiumModal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Academic Progress */}
        <motion.div variants={itemVariants} className={`p-6 rounded-[1.75rem] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] relative overflow-hidden ${cardClass}`}>
          <div className="absolute -right-16 top-10 w-52 h-52 rounded-full bg-[#38BDF8]/10 blur-3xl mix-blend-screen"></div>
          <div className="absolute left-8 bottom-8 w-40 h-40 rounded-full bg-[#22C55E]/10 blur-3xl mix-blend-screen"></div>
          <div className="flex justify-between items-center mb-4 relative z-10">
            <h3 className={`text-[13px] font-bold ${textClass}`}>Academic Progress</h3>
            <button onClick={() => setActiveTab('courses')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${isDarkMode ? 'bg-[#1A2235] border-slate-700 text-slate-300 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              All Courses <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <div className="relative w-48 h-48 flex items-center justify-center">
               <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                 {/* Background track */}
                 <circle
                   cx="70" cy="70" r={radius}
                   stroke={isDarkMode ? '#1E293B' : '#F1F5F9'}
                   strokeWidth="10" fill="transparent"
                   strokeDasharray={trackStrokeDasharray}
                   strokeLinecap="round"
                 />
                 {/* Progress track */}
                 <circle
                   cx="70" cy="70" r={radius}
                   stroke="url(#orangeGradient)"
                   strokeWidth="10" fill="transparent"
                   strokeDasharray={circumference}
                   strokeDashoffset={progressStrokeDashoffset}
                   strokeLinecap="round"
                   className="transition-all duration-1000 ease-out"
                 />
                 <defs>
                   <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                     <stop offset="0%" stopColor="#FDBA74" />
                     <stop offset="100%" stopColor="#00D4FF" />
                   </linearGradient>
                 </defs>
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
                 <span className={`text-[32px] leading-none font-black ${textClass}`}>{averageProgress}%</span>
                 <span className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 ${mutedTextClass}`}>Progress</span>
                 <span className={`text-[11px] font-bold mt-2 flex items-center gap-1 ${textClass}`}>
                   Keep going! <span className="text-sm">💪</span>
                 </span>
               </div>
            </div>

            <div className="w-full grid grid-cols-3 gap-2 mt-4 text-center">
               <div className="flex flex-col items-center">
                 <span className="text-emerald-500 font-bold text-[10px] mb-1">Completed</span>
                 <span className={`text-lg font-black ${textClass}`}>{totalLessonsCompleted}</span>
                 <span className={`text-[9px] ${mutedTextClass}`}>Lessons</span>
               </div>
               <div className="flex flex-col items-center border-x border-slate-100 dark:border-slate-800">
                 <span className="text-blue-500 font-bold text-[10px] mb-1">In Progress</span>
                 <span className={`text-lg font-black ${textClass}`}>{totalEnrolled > 0 ? totalEnrolled - completedCourses.length : 0}</span>
                 <span className={`text-[9px] ${mutedTextClass}`}>Courses</span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[#00D4FF] font-bold text-[10px] mb-1">Certificates</span>
                 <span className={`text-lg font-black ${textClass}`}>{certificateEarned}</span>
                 <span className={`text-[9px] ${mutedTextClass}`}>Earned</span>
               </div>
            </div>

            <div className={`mt-6 px-4 py-2 rounded-full text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center gap-1.5`}>
               You're ahead of {percentile}% of learners 📈
            </div>
          </div>
        </motion.div>

        {/* Weekly Study Goal */}
        <motion.div variants={itemVariants} className={`p-6 rounded-[1.75rem] border shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-[#121A2F] border-slate-800' : 'bg-white border-slate-200/80'}`}>
          <div className="absolute right-10 bottom-10 w-36 h-36 rounded-full bg-[#10B981]/10 blur-3xl mix-blend-screen"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className={`text-[13px] font-bold ${textClass}`}>Weekly Study Goal</h3>
            <button onClick={() => setActiveTab('study-goal')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${isDarkMode ? 'bg-[#1A2235] border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-6">
             <Target className="w-4 h-4 text-[#00D4FF] shrink-0" />
             <span className={`text-[11px] font-bold ${mutedTextClass}`}>Goal: {studyGoal} hours</span>
          </div>

          <div className="flex gap-4 items-center mb-4">
             <div className="relative w-20 h-20 shrink-0">
               <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                 <circle cx="50" cy="50" r="40" stroke={isDarkMode ? '#1E293B' : '#F1F5F9'} strokeWidth="8" fill="transparent" />
                 <circle 
                   cx="50" cy="50" r="40" stroke="#10B981" strokeWidth="8" fill="transparent" strokeLinecap="round"
                   strokeDasharray={2 * Math.PI * 40} strokeDashoffset={(2 * Math.PI * 40) - ((totalWeeklyHours/studyGoal)*100 / 100) * (2 * Math.PI * 40)}
                 />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                 <span className={`text-[19px] font-black leading-none ${textClass}`}>{totalWeeklyHours}</span>
                 <span className={`text-[8px] mt-0.5 font-bold ${mutedTextClass}`}>/ {studyGoal} hours</span>
               </div>
             </div>
             <div className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold h-max whitespace-nowrap">
               {Math.min(100, Math.round((totalWeeklyHours / studyGoal) * 100))}% Completed
             </div>
          </div>

          <div className="h-32 w-full mt-auto mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStudyData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }} barSize={10}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 10 }} ticks={[0, 1, 2, 3, 4]} tickFormatter={(val) => `${val}h`} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`px-2 py-1 rounded shadow-lg border text-[10px] font-bold ${isDarkMode ? 'bg-[#1A2235] border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          {`${payload[0].value}h`}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hours" radius={[4, 4, 4, 4]}>
                   {weeklyStudyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.hours > 0 ? '#10B981' : (isDarkMode ? '#1E293B' : '#F1F5F9')} />
                   ))}
                   <LabelList dataKey="hours" position="top" formatter={(val) => `${val.toFixed(1)}h`} style={{ fontSize: '9px', fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={`mt-2 p-3 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold ${isDarkMode ? 'bg-[#1A2235] text-slate-300' : 'bg-[#F4F8FE] text-slate-600'}`}>
             Great consistency! 🔥 You studied {daysStudied} days this week.
          </div>
        </motion.div>

        {/* Certificates Claim */}
        <motion.div variants={itemVariants} className={`p-6 md:p-8 rounded-[24px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-white border-slate-200/80'}`}>
          <div className="absolute right-6 top-8 w-44 h-44 rounded-full bg-[#00D4FF]/10 blur-3xl mix-blend-screen"></div>
          <div className="absolute left-6 bottom-10 w-36 h-36 rounded-full bg-[#F97316]/10 blur-3xl mix-blend-screen"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className={`text-[13px] font-bold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>
              {readyCertificates.length === 0 && dashboardStats?.certificates?.length > 0 ? 'Recent Certificates' : 'Certificates Claim'}
            </h3>
            <button onClick={() => setActiveTab('certificates')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
              <MoreHorizontal className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            {readyCertificates.length === 0 && dashboardStats?.certificates?.length > 0 ? (
               <div className="space-y-3 w-full">
                 {dashboardStats.certificates.slice(0, 3).map((cert, idx) => (
                   <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-[#121A2F] border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#00D4FF]/10 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                       <Award className="w-5 h-5" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                         {cert.course?.title || 'Certificate'}
                       </h4>
                       <p className={`text-[9px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                         Issued: {new Date(cert.issueDate || Date.now()).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                 ))}
                 <button 
                   onClick={toggleCertificateDropdown}
                   className={`w-full py-2.5 mt-2 rounded-full-[10px] font-bold text-[12px] transition-all bg-[#10B981] hover:bg-[#059669] text-white shadow-sm flex items-center justify-center gap-2`}
                 >
                   View All Certificates <span className="text-[14px]">→</span>
                 </button>
               </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                {/* Certificate Graphic */}
                <div className="relative w-36 h-28 mb-10 mt-2 flex items-center justify-center">
                   {/* Background Document */}
                   <div className={`absolute w-28 h-20 top-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                   {/* Foreground Document */}
                   <div className={`absolute w-32 h-20 bottom-2 rounded-xl shadow-sm flex items-center justify-start pl-5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                     {/* Lines */}
                     <div className="flex flex-col gap-2">
                       <div className="w-12 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                       <div className="w-8 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                       <div className="w-10 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                     </div>
                     {/* Gold Seal & Ribbon */}
                     <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
                        <div className="w-7 h-10 bg-slate-400 dark:bg-slate-500 absolute top-4 z-0" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)" }}></div>
                        <div className="w-10 h-10 rounded-full bg-[#00D4FF] border-[3px] border-orange-200 dark:border-orange-900 shadow-sm z-10 flex items-center justify-center">
                           <div className="w-5 h-5 rounded-full border-2 border-orange-300 dark:border-orange-800 opacity-50"></div>
                        </div>
                     </div>
                   </div>
                   {/* Confetti dots */}
                   <div className="absolute left-0 top-0 w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                   <div className="absolute left-2 top-8 w-2 h-2 rounded-full bg-blue-500"></div>
                   <div className="absolute left-4 bottom-2 w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                   <div className="absolute right-0 top-0 w-2 h-2 rotate-45 bg-orange-400" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}></div>
                   <div className="absolute right-2 bottom-6 w-1.5 h-3 rounded-full bg-slate-300 rotate-45"></div>
                </div>

                {certificateTotal === 0 && certificateReady === 0 ? (
                  <>
                    <h4 className={`text-[13px] font-bold mb-6 leading-[1.6] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      You do not have any certificates yet.
                    </h4>
                    <p className={`text-[12px] mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Complete a course and claim your certificate to have it appear in the Certificates section.
                    </p>
                    <button 
                      onClick={() => setActiveTab('courses')}
                      className={`w-full py-3 rounded-[10px] font-bold text-[13px] transition-all mb-5 ${isDarkMode ? 'bg-[#00D4FF] hover:bg-[#EA580C] text-white' : 'bg-[#00D4FF] hover:bg-[#EA580C] text-white'} shadow-sm`}
                    >
                      Start Now
                    </button>
                  </>
                ) : certificateTotal === 0 && certificateReady > 0 ? (
                  <>
                    <h4 className={`text-[13px] font-bold mb-6 leading-[1.6] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      You have {certificateReady} certificate{certificateReady !== 1 ? 's' : ''} ready to claim!
                    </h4>
                    <p className={`text-[12px] mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Claim your certificates now in the Certificates section.
                    </p>
                    <button 
                      onClick={() => setActiveTab('certificates')}
                      className={`w-full py-3 rounded-[10px] font-bold text-[13px] transition-all mb-5 bg-[#00D4FF] hover:bg-[#EA580C] text-white shadow-sm`}
                    >
                      Claim Now ({certificateReady})
                    </button>
                  </>
                ) : certificateReady === 0 ? (
                  <>
                    <h4 className={`text-[13px] font-bold mb-6 leading-[1.6] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      You have {certificateTotal} certificate{certificateTotal !== 1 ? 's' : ''} recorded.
                    </h4>
                    <p className={`text-[12px] mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Review or export your certificates in the Certificates section.
                    </p>
                    <button 
                      onClick={() => setActiveTab('certificates')}
                      className={`w-full py-3 rounded-[10px] font-bold text-[13px] transition-all mb-5 ${isDarkMode ? 'bg-[#00D4FF] hover:bg-[#EA580C] text-white' : 'bg-[#00D4FF] hover:bg-[#EA580C] text-white'} shadow-sm`}
                    >
                      View Certificates
                    </button>
                  </>
                ) : (
                  <>
                    <h4 className={`text-[13px] font-bold mb-6 leading-[1.6] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      You have {certificateReady} certificate{certificateReady !== 1 ? 's' : ''} available to claim!
                    </h4>
                    <button 
                      onClick={() => setActiveTab('certificates')}
                      className={`w-full py-3 rounded-[10px] font-bold text-[13px] transition-all mb-5 bg-[#00D4FF] hover:bg-[#EA580C] text-white shadow-sm`}
                    >
                      Claim Now ({certificateReady})
                    </button>
                  </>
                )}
                
                <button onClick={toggleCertificateDropdown} className="text-[11px] font-medium text-[#00D4FF] hover:underline flex items-center justify-center gap-1">
                  View all certificates <span className="text-[12px]">→</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Courses */}
        <motion.div variants={itemVariants} className={`p-6 rounded-[1.75rem] border shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 ${cardClass}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-[13px] font-bold ${textClass}`}>Recent Courses</h3>
            <button onClick={() => setActiveTab('courses')} className="text-[11px] font-bold text-blue-500 hover:underline">
              View all
            </button>
          </div>
          
          <div className="space-y-5">
            {recentCourses.length === 0 ? (
                <div className={`text-center p-4 text-[12px] font-medium ${mutedTextClass}`}>
                    No recent courses found.
                </div>
            ) : recentCourses.map((enrollment, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-[0.8rem] flex items-center justify-center shrink-0 border ${
                  idx === 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-500 dark:bg-indigo-500/10 dark:border-indigo-500/20' : 
                  idx === 1 ? 'bg-emerald-50 border-emerald-100 text-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 
                  'bg-orange-50 border-orange-100 text-[#00D4FF] dark:bg-[#00D4FF]/10 dark:border-[#00D4FF]/20'
                }`}>
                  {idx === 0 ? <Atom className="w-5 h-5" /> : idx === 1 ? <Code className="w-5 h-5" /> : <Calculator className="w-5 h-5" />}
                </div>
                
                <div className="w-[140px] shrink-0">
                  <h4 className={`text-xs font-bold truncate ${textClass}`}>{enrollment.course?.title || 'Course Title'}</h4>
                  <p className={`text-[9px] font-bold mt-1 ${mutedTextClass}`}>
                    <span className="text-emerald-500">{enrollment.completedLessons?.length || 0}</span> / {enrollment.course?.lessons?.length || 10} Lessons
                  </p>
                </div>

                <div className="flex-1 hidden sm:block h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-2">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${enrollment.progress || 0}%` }}></div>
                </div>

                <div className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  {enrollment.progress || 0}%
                </div>

                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div variants={itemVariants} className={`p-6 md:p-8 rounded-[32px] border shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-white border-slate-200/80'}`}>
          <div className="absolute right-6 top-8 w-44 h-44 rounded-full bg-[#0EA5E9]/10 blur-3xl mix-blend-screen"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className={`text-[15px] font-bold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>Achievements</h3>
            <button onClick={() => setAchievementsModalOpen(true)} className="text-[12px] font-bold text-blue-500 hover:underline">
              View all
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {achievements && achievements.length > 0 ? achievements.slice(0,4).map((ach, i) => {
                 const IconComponent = typeof ach.icon === 'string' 
                   ? ({ Award, Star, Zap, Target }[ach.icon] || Award) 
                   : (ach.icon || Award);
                 return (
               <div key={i} className={`flex flex-col items-center text-center p-4 md:py-6 rounded-[24px] ${isDarkMode ? ach.darkBg : ach.lightBg || 'bg-slate-50'}`}>
                 <div className="relative mb-5 flex items-center justify-center">
                    {/* Glowing Aura */}
                    <div className="absolute inset-0 blur-xl opacity-40 scale-150" style={{ backgroundColor: ach.color || '#00D4FF' }}></div>
                    
                    {/* Hexagon Badge */}
                    <div className="relative w-14 h-14 flex items-center justify-center z-10" 
                         style={{ backgroundColor: ach.color || '#00D4FF', clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)" }}>
                      
                      {/* Inner border effect */}
                      <div className="w-[48px] h-[48px] flex items-center justify-center border-[1.5px] border-white/30"
                           style={{ clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)" }}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>

                    </div>
                 </div>
                 <h4 className={`text-[12px] font-bold mb-1.5 ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>{ach.title}</h4>
                 <p className={`text-[10px] font-medium leading-relaxed max-w-[100px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ach.description || ach.desc}</p>
               </div>
               );
              }) : (
                 <div className={`col-span-4 text-center p-4 text-[12px] font-medium ${mutedTextClass}`}>
                     No achievements earned yet. Start learning to unlock badges!
                 </div>
             )}
          </div>

          <div className={`mt-auto p-4 rounded-[20px] flex items-center gap-3 text-[11px] font-medium ${isDarkMode ? 'bg-[#1E293B] text-slate-300' : 'bg-[#F8FAFC] text-slate-600'}`}>
            <span className="text-base leading-none">⭐</span> Keep going! You're unlocking great achievements! <span className="text-base leading-none">🚀</span>
          </div>
        </motion.div>

        {/* Messages Preview */}
        <motion.div variants={itemVariants} className={`p-6 md:p-8 rounded-[32px] border shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-white border-slate-200/80'}`}>
          <div className="absolute left-6 top-8 w-36 h-36 rounded-full bg-[#16A34A]/10 blur-3xl mix-blend-screen"></div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className={`text-[15px] font-bold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>Recent Messages</h3>
            <button onClick={() => setActiveTab('message')} className={`text-[12px] font-bold flex items-center gap-1 px-3 py-1 rounded-full border transition-all ${isDarkMode ? 'text-blue-400 border-[#00D4FF]/30 hover:bg-[#00D4FF]/10' : 'text-blue-500 border-orange-200 hover:bg-orange-50'}`}>
              Open Chat <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            {loadingMessages ? (
              <div className="flex-1 flex items-center justify-center">
                 <div className="animate-spin w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full"></div>
              </div>
            ) : recentContacts.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center text-center p-4 text-[12px] font-medium ${mutedTextClass}`}>
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDarkMode ? 'bg-[#1E293B]' : 'bg-slate-100'}`}>
                    <MessageSquare className="w-5 h-5 opacity-50" />
                 </div>
                 No recent conversations. Start chatting with your peers!
              </div>
            ) : (
              recentContacts.map((contact, idx) => (
                <div key={idx} onClick={() => setActiveTab('message')} className={`flex items-center gap-4 p-3 rounded-[16px] cursor-pointer transition-all ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white dark:border-[#0B1D3A] shadow-sm bg-gradient-to-tr from-[#4ade80] via-[#fb923c] to-[#facc15] p-[2px]">
                       <div className="w-full h-full rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center text-[14px] font-bold text-blue-500 overflow-hidden">
                          {contact.avatar && contact.avatar !== 'default-avatar.png' ? (
                             <img src={contact.avatar?.startsWith('http') ? contact.avatar : `http://localhost:5000${contact.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                             contact.name.charAt(0).toUpperCase()
                          )}
                       </div>
                    </div>
                    {contact.isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#0B1D3A] rounded-full z-10"></div>}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className={`text-[13px] font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{contact.name}</h4>
                      {contact.unreadCount > 0 && (
                        <span className="bg-[#007AFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0 leading-none">
                          {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-medium truncate pr-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {contact.role || 'User'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Achievements Modal */}
      <PremiumModal isOpen={achievementsModalOpen} onClose={() => setAchievementsModalOpen(false)} maxWidth="max-w-2xl">
        <div className="flex flex-col w-full h-full p-6 md:p-8">
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none z-0"></div>
          <div className="relative z-10 flex flex-col flex-1 max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isDarkMode ? 'bg-[#1E293B] border border-slate-700' : 'bg-blue-50 border border-blue-100'}`}>
                  <Target className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>All Achievements</h3>
                  <p className={`text-sm font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Your collected badges and milestones
                  </p>
                </div>
              </div>
              <button onClick={() => setAchievementsModalOpen(false)} className={`p-2 rounded-full transition-colors bg-white/5 backdrop-blur-sm border ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 border-slate-700/50' : 'hover:bg-slate-100 text-slate-500 border-slate-200'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="mt-6 overflow-y-auto pr-2 custom-scrollbar flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
              {achievements && achievements.length > 0 ? achievements.map((ach, i) => {
                 const IconComponent = typeof ach.icon === 'string' ? ({ Award, Star, Zap, Target }[ach.icon] || Award) : (ach.icon || Award);
                 return (
                   <div key={i} className={`flex flex-col items-center text-center p-4 md:py-6 rounded-[24px] ${isDarkMode ? ach.darkBg || 'bg-[#121A2F]' : ach.lightBg || 'bg-slate-50'} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                     <div className="relative mb-5 flex items-center justify-center">
                        <div className="absolute inset-0 blur-xl opacity-40 scale-150" style={{ backgroundColor: ach.color || '#3b82f6' }}></div>
                        <div className="relative w-14 h-14 flex items-center justify-center z-10" style={{ backgroundColor: ach.color || '#3b82f6', clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)" }}>
                          <div className="w-[48px] h-[48px] flex items-center justify-center border-[1.5px] border-white/30" style={{ clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)" }}>
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                        </div>
                     </div>
                     <h4 className={`text-[12px] font-bold mb-1.5 ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>{ach.title}</h4>
                     <p className={`text-[10px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ach.description || ach.desc}</p>
                   </div>
                 );
              }) : (
                 <div className={`col-span-full text-center p-8 text-[13px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                     No achievements earned yet. Keep learning!
                 </div>
              )}
            </div>
          </div>
        </div>
      </PremiumModal>

      {/* Messages Modal */}
      <PremiumModal isOpen={messagesModalOpen} onClose={() => setMessagesModalOpen(false)} maxWidth="max-w-2xl">
        <div className="flex flex-col w-full h-full p-6 md:p-8">
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#00D4FF]/10 to-transparent pointer-events-none z-0"></div>
          <div className="relative z-10 flex flex-col flex-1 max-h-[85vh] overflow-hidden">
            <div className="flex items-start justify-between pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isDarkMode ? 'bg-[#1E293B] border border-slate-700' : 'bg-orange-50 border border-orange-100'}`}>
                  <MessageSquare className="w-6 h-6 text-[#00D4FF]" />
                </div>
                <div>
                  <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>All Recent Messages</h3>
                  <p className={`text-sm font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Your recent conversations
                  </p>
                </div>
              </div>
              <button onClick={() => setMessagesModalOpen(false)} className={`p-2 rounded-full transition-colors bg-white/5 backdrop-blur-sm border ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 border-slate-700/50' : 'hover:bg-slate-100 text-slate-500 border-slate-200'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="mt-6 overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-4">
              {allRecentContacts.length === 0 ? (
                <div className={`text-center p-8 text-[13px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                   No conversations found.
                </div>
              ) : (
                allRecentContacts.map((contact, idx) => (
                  <div key={idx} onClick={() => { setMessagesModalOpen(false); setActiveTab('message'); }} className={`flex items-center gap-4 p-4 rounded-[20px] border cursor-pointer transition-all ${isDarkMode ? 'border-slate-700 bg-[#121A2F]/50 hover:bg-[#121A2F]' : 'border-slate-200 bg-white hover:border-[#00D4FF]/30'}`}>
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-white dark:border-[#0B1D3A] shadow-sm bg-gradient-to-tr from-[#4ade80] via-[#fb923c] to-[#facc15] p-[2px]">
                         <div className="w-full h-full rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center text-[16px] font-bold text-blue-500 overflow-hidden">
                            {contact.avatar && contact.avatar !== 'default-avatar.png' ? (
                               <img src={contact.avatar?.startsWith('http') ? contact.avatar : `http://localhost:5000${contact.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                               contact.name.charAt(0).toUpperCase()
                            )}
                         </div>
                      </div>
                      {contact.isOnline && <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-[#0B1D3A] rounded-full z-10"></div>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className={`text-[15px] font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{contact.name}</h4>
                        {contact.unreadCount > 0 && (
                          <span className="bg-[#007AFF] text-white text-[11px] font-bold px-2 py-1 rounded-full min-w-[20px] text-center shrink-0 leading-none">
                            {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-[12px] font-medium truncate pr-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {contact.role || 'User'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PremiumModal>

      {/* Shared Global Block: Active Sections */}
      {sectionsData.length > 0 && (
        <motion.div variants={itemVariants} className={`p-6 md:p-8 rounded-[32px] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${isDarkMode ? 'bg-[#0B1D3A] border-[#1e293b]' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`font-black text-[15px] tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Sections</h3>
              <p className={`text-[12px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Groups and cohorts you are a part of</p>
            </div>
            <div className={`text-[11px] px-3 py-1 rounded-full font-bold shadow-sm ${isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'}`}>
              {sectionsData.length} sections
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...sectionsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3).map((sec, idx) => {
              const hasMembers = sec.students && sec.students.length > 0;
              return (
                <div 
                  key={`global-sec-${idx}`} 
                  className={`group relative overflow-hidden rounded-[1.5rem] p-6 border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between min-h-[220px] ${
                    hasMembers
                    ? (isDarkMode ? 'bg-gradient-to-br from-[#0B1D3A] to-[#00D4FF]/10 border-[#00D4FF]/50 hover:border-[#F97316]/50 shadow-[0_0_30px_rgba(0,212,255,0.15)] ring-1 ring-[#00D4FF]/50' : 'bg-gradient-to-br from-white to-[#00D4FF]/5 border-[#00D4FF]/50 hover:border-[#F97316]/50 shadow-lg ring-1 ring-[#00D4FF]/50') 
                    : (isDarkMode ? 'bg-[#0B1D3A]/80 border-[#F97316]/30 hover:border-[#00D4FF]/50 hover:bg-[#0B1D3A] shadow-md hover:shadow-[0_20px_40px_rgba(0,212,255,0.08)]' : 'bg-white border-[#F97316]/30 hover:border-[#00D4FF]/50 hover:shadow-xl shadow-sm')
                  }`}
                >
                  {/* Border Indicator Strips */}
                  <div className={`absolute top-0 left-0 w-1.5 h-full transition-all duration-300 ${hasMembers ? 'bg-[#00D4FF] group-hover:bg-[#F97316]' : 'bg-[#F97316] group-hover:bg-[#00D4FF]'}`}></div>
                  <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-300 ${hasMembers ? 'bg-[#00D4FF] group-hover:bg-[#F97316]' : 'bg-[#F97316] group-hover:bg-[#00D4FF]'}`}></div>

                  <div className="flex items-start justify-between mb-3 pl-2 relative z-10">
                    <p className={`text-base font-black flex items-center gap-2 transition-colors duration-300 ${hasMembers ? 'text-[#00D4FF] group-hover:text-[#F97316]' : 'text-[#F97316] group-hover:text-[#00D4FF]'}`}>
                      <Users className={`w-5 h-5 transition-colors duration-300 shrink-0 ${hasMembers ? 'text-[#00D4FF] group-hover:text-[#F97316]' : 'text-[#F97316] group-hover:text-[#00D4FF]'}`} /> {sec.name || 'Unnamed Section'}
                    </p>
                  </div>
                
                <div className="space-y-1.5 mb-4 text-xs pl-2 relative z-10">
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Course: <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>{sec.course?.title || 'Unknown'}</span></p>
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Instructor: <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>{sec.instructor?.name || 'Unassigned'}</span></p>
                </div>
                
                <div className="pt-3.5 border-t flex flex-wrap gap-1.5 items-center dark:border-white/10 border-slate-200 pl-2 relative z-10">
                  <span className={`text-[10px] font-black mr-1 uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Members:</span>
                  {sec.students?.slice(0, 3).map(st => (
                    <span key={st.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDarkMode ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
                      {st.name?.split(' ')[0]}
                    </span>
                  ))}
                  {sec.students?.length > 3 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDarkMode ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      +{sec.students.length - 3}
                    </span>
                  )}
                  {!sec.students?.length && (
                    <span className={`text-[10px] italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No students yet</span>
                  )}
                </div>
              </div>
            );
            })}
          </div>
          
          <div className="mt-5 flex justify-end">
            <button 
              onClick={() => navigate('/dashboard/sections')} 
              className="text-[12px] font-bold text-[#00D4FF] hover:text-[#00A3CC] transition-colors flex items-center gap-1"
            >
              View All Sections &rarr;
            </button>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
};

export default StudentOverview;
