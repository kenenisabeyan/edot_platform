import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import SupportDashboard from './SupportDashboard';
import { Navigate, useNavigate } from 'react-router-dom';
import StudentOverview from '../components/student/StudentOverview';
import AgendaCreationModal from '../components/AgendaCreationModal';
import AgendaWidget from '../components/AgendaWidget';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  CircleDollarSign,
  Briefcase,
  TrendingUp,
  Award,
  CheckCircle,
  MoreHorizontal,
  Mail,
  Calendar,
  Bell,
  ArrowRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import useThemeMode from '../hooks/useThemeMode';

import { useQuery } from '@tanstack/react-query';

export default function EDOTDashboard() {
  const { user } = useAuth();
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [showRechartsMenu, setShowRechartsMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [clearedNotifications, setClearedNotifications] = useState(false);
  const navigate = useNavigate();
  const isDarkMode = useThemeMode();

  const userRole = user?.role ? user.role.toLowerCase().trim() : 'student';
  void motion;

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['edotDashboardStats', userRole],
    queryFn: async () => {
      if (userRole === 'sponsor') {
        const { data } = await api.get('/sponsor/dashboard').catch(() => ({ data: {} }));
        return data;
      }
      if (userRole === 'student') {
        const { data } = await api.get('/student/dashboard').catch(() => ({ data: { data: {} } }));
        const payload = data?.data || {};
        return {
           profile: payload.profile || {},
           enrolledCourses: payload.enrollments || [],
           overview: payload.stats || {},
           progress: payload.progress || { percentile: 0 },
           recentCourses: payload.recentCourses || [],
           study: payload.weeklyStudy || {},
           certificates: payload.certificates || [],
           achievements: payload.achievements || [],
           sidebarCounts: payload.sidebarCounts || { messages: 0, certificates: 0, notices: 0 }
        };
      }
      if (userRole === 'admin') {
        const [dashRes, analyticsRes, activitiesRes] = await Promise.all([
          api.get('/admin/dashboard').catch(() => ({ data: { data: {} } })),
          api.get('/admin/analytics').catch(() => ({ data: { data: {} } })),
          api.get('/admin/activities').catch(() => ({ data: { data: [] } }))
        ]);
        
        const baseStats = dashRes.data?.data || {};
        const analyticsStats = analyticsRes.data?.data || {};
        const activities = activitiesRes.data?.data || [];
        
        return {
          ...baseStats,
          analytics: analyticsStats,
          topCourses: analyticsStats.topCourses || [],
          instructorPerformance: analyticsStats.instructorPerformance || [],
          engagement: analyticsStats.engagementSummary || {},
          recentActivities: activities
        };
      }
      const [dashRes, activitiesRes] = await Promise.all([
        api.get(`/${userRole}/dashboard`).catch(() => ({ data: { data: {} } })),
        api.get('/activity/all').catch(() => ({ data: { data: [] } }))
      ]);
      
      const activities = activitiesRes.data?.data || [];
      const formattedActivities = activities.map(act => ({
          id: act.id,
          type: act.type || 'system',
          title: act.action || 'Activity',
          studentName: act.user?.name || 'System',
          itemTitle: act.details || '',
          date: act.createdAt
      }));

      return {
        ...(dashRes.data?.data || {}),
        recentActivities: formattedActivities
      };
    },
    enabled: !!user,
    refetchInterval: 30000
  });

  const { data: agendaEvents = [], refetch: refetchAgenda } = useQuery({
    queryKey: ['edotAgendaEvents'],
    queryFn: async () => {
      const { data } = await api.get('/calendar');
      return Array.isArray(data.data) ? data.data : [];
    },
    enabled: !!user,
    refetchInterval: 30000
  });

  const { data: sectionsData = [] } = useQuery({
    queryKey: ['dashboardSections'],
    queryFn: async () => {
      const { data } = await api.get('/sections');
      return data.data || [];
    },
    enabled: ['admin', 'instructor', 'student'].includes(userRole)
  });

  const loading = loadingStats && userRole !== 'sponsor';

  const SmartCard = ({ title, value, icon: Icon, accent = '#00D4FF', borderHover = 'hover:border-[#00D4FF]/40', shadowHover = 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.15)]', iconBg = '' }) => {
    return (
      <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="h-full">
        <Card hover={false} className={`h-full rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl flex flex-col items-center text-center gap-4 group relative overflow-hidden transition-all duration-500 ${shadowHover} ${borderHover} ${isDarkMode ? 'bg-[#0B1120]/40 border-white/10' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
          {/* Abstract Hover Background */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: accent }}></div>
          
          {/* Icon (centered top) */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ${iconBg || (isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100')} group-hover:bg-transparent group-hover:border-transparent relative z-10`} style={{ color: isDarkMode ? '#fff' : '#1e293b' }}>
             <div className="absolute inset-0 opacity-0 group-hover:opacity-10 rounded-full transition-opacity duration-500" style={{ backgroundColor: accent }}></div>
             {Icon && <Icon className="w-5 h-5 relative z-10 transition-colors duration-500" style={{ color: 'inherit' }} />}
          </div>

          {/* Content (centered) */}
          <div className="flex flex-col items-center relative z-10 w-full">
            <h3 className={`text-xs font-black tracking-widest uppercase mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h3>
            <h2 className={`text-3xl md:text-4xl font-black max-w-full truncate tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</h2>
          </div>
        </Card>
      </motion.div>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`backdrop-blur-2xl p-4 rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-[#0F172A]/90 border-white/10' : 'bg-white/90 border-slate-200/80'}`}>
          {/* Subtle top glow line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00D4FF] via-[#8B5CF6] to-[#EC4899]"></div>
          
          <p className={`font-black tracking-tight mb-2.5 text-xs uppercase ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#00B2D6]'}`}>{label}</p>
          <div className="space-y-2">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-6 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{entry.name}</span>
                </div>
                <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                  {entry.name === 'Revenue' ? formatCurrency(entry.value) : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const deleteAgenda = async (agendaId) => {
    try {
      await api.delete(`/calendar/${agendaId}`);
      refetchAgenda();
    } catch (err) {
      console.error('Failed to delete agenda event', err);
    }
  };

  const onAgendaCreated = (evt) => {
    refetchAgenda();
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number') return typeof value === 'string' ? value : '$0';
    return `$${value.toLocaleString()}`;
  };

  const monthlyRevenueSeries = Array.isArray(stats?.analytics?.revenueData) ? stats.analytics.revenueData : (Array.isArray(stats?.monthlyRevenue) ? stats.monthlyRevenue : []);
  const currentMonthRevenue = typeof stats?.dashboardStats?.totalRevenue === 'number'
    ? stats.dashboardStats.totalRevenue
    : (stats?.analytics?.totalRevenue ?? stats?.finance?.totalRevenue ?? 0);
  const patternPerformanceData = monthlyRevenueSeries.map((item) => ({
    name: item.name,
    revenue: item.revenue || 0,
    students: item.students || 0,
    courses: item.courses || 0
  }));

  let headerConfig = {};
  let statsConfig = [];
  let gaugeConfig = {};
  let areaConfig = {};
  let widgetConfig = {};

  if (userRole === 'admin') {
    headerConfig = {
      gradient: 'bg-gradient-to-r from-[#020b1f] via-[#0f48b9] to-[#00d4ff]',
      title: 'Welcome back, Admin Kenenisa Beyan 👋',
      subtitle: 'Here’s what’s happening with your platform today.'
    };
    statsConfig = [
      { 
        title: 'Total Courses', 
        value: stats?.dashboardStats?.totalCourses ?? stats?.totalCourses ?? 0, 
        icon: BookOpen,
        accent: '#00D4FF',
        borderHover: 'hover:border-[#00D4FF]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.2)]',
        iconBg: 'bg-[#00D4FF]/10 text-[#00D4FF]'
      },
      { 
        title: 'Active Students', 
        value: stats?.dashboardStats?.totalStudents ?? stats?.totalStudents ?? 0, 
        icon: Users,
        accent: '#8B5CF6',
        borderHover: 'hover:border-[#8B5CF6]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(139,92,246,0.2)]',
        iconBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
      },
      { 
        title: 'Instructors', 
        value: stats?.dashboardStats?.totalInstructors ?? stats?.totalInstructors ?? 0, 
        icon: Briefcase,
        accent: '#10B981',
        borderHover: 'hover:border-[#10B981]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-[#10B981]/10 text-[#10B981]'
      },
      { 
        title: 'Pending Approvals', 
        value: stats?.dashboardStats?.pendingApprovals ?? stats?.pendingCourses ?? 0, 
        icon: Award,
        accent: '#F59E0B',
        borderHover: 'hover:border-[#F59E0B]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]',
        iconBg: 'bg-[#F59E0B]/10 text-[#F59E0B]'
      },
      { 
        title: 'Total Revenue', 
        value: formatCurrency(currentMonthRevenue), 
        icon: CircleDollarSign,
        accent: '#EC4899',
        borderHover: 'hover:border-[#EC4899]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(236,72,153,0.2)]',
        iconBg: 'bg-[#EC4899]/10 text-[#EC4899]'
      }
    ];
    areaConfig = {
      title: 'Platform Performance',
      data: patternPerformanceData.length ? patternPerformanceData : [
         { name: 'Jan', revenue: 1200, students: 420, courses: 28 },
         { name: 'Feb', revenue: 1500, students: 510, courses: 32 },
         { name: 'Mar', revenue: 1080, students: 380, courses: 24 },
         { name: 'Apr', revenue: 1720, students: 620, courses: 38 },
         { name: 'May', revenue: 1980, students: 740, courses: 44 },
         { name: 'Jun', revenue: 1640, students: 560, courses: 36 }
      ],
      lines: [
        { key: 'courses', name: 'Courses', color: '#00D4FF' }, // Brand Cyan
        { key: 'students', name: 'Students', color: '#F97316' }, // Brand Orange
        { key: 'revenue', name: 'Revenue', color: '#10B981' } // Emerald
      ]
    };
    widgetConfig = {
      type: 'activity',
      title: 'Recent Activities',
      subtitle: 'Live platform feed',
    };
  } else if (userRole === 'instructor') {
    headerConfig = {
      gradient: 'bg-gradient-to-r from-[#020b1f] via-[#0f48b9] to-[#00d4ff]',
      title: 'Hello, Instructor! 🎓',
      subtitle: ''
    };
    statsConfig = [
      { 
        title: 'Total Courses Created', 
        value: stats?.totalCourses || 0, 
        icon: BookOpen,
        accent: '#00D4FF',
        borderHover: 'hover:border-[#00D4FF]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.2)]',
        iconBg: 'bg-[#00D4FF]/10 text-[#00D4FF]'
      },
      { 
        title: 'Active Classes', 
        value: stats?.activeCourses || 0, 
        icon: Briefcase,
        accent: '#10B981',
        borderHover: 'hover:border-[#10B981]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-[#10B981]/10 text-[#10B981]'
      },
      { 
        title: 'Students Enrolled', 
        value: stats?.totalStudents || 0, 
        icon: Users,
        accent: '#8B5CF6',
        borderHover: 'hover:border-[#8B5CF6]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(139,92,246,0.2)]',
        iconBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
      },
      { 
        title: 'Total Lessons', 
        value: stats?.totalLessons || 0, 
        icon: TrendingUp,
        accent: '#F59E0B',
        borderHover: 'hover:border-[#F59E0B]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]',
        iconBg: 'bg-[#F59E0B]/10 text-[#F59E0B]'
      }
    ];
    gaugeConfig = {
      title: 'Active Course Ratio',
      valStr: `${stats?.totalCourses ? Math.round((stats.activeCourses/stats.totalCourses)*100) : 0}%\nACTIVE`,
      valNum: stats?.totalCourses ? Math.round((stats.activeCourses/stats.totalCourses)*100) : 0,
      ringColor: '#00D4FF'
    };
    
    const instructorLines = [];
    if (stats?.courseNames?.[0]) instructorLines.push({ key: 'value1', name: stats.courseNames[0], color: '#00D4FF' }); // Brand Cyan
    if (stats?.courseNames?.[1]) instructorLines.push({ key: 'value2', name: stats.courseNames[1], color: '#F97316' }); // Brand Orange
    if (stats?.courseNames?.[2]) instructorLines.push({ key: 'value3', name: stats.courseNames[2], color: '#10B981' }); // Emerald

    areaConfig = {
      title: 'Student Engagement Insights',
      data: stats?.studentPerformanceData || [],
      lines: instructorLines.length ? instructorLines : [{ key: 'value1', name: 'No Data', color: '#00D4FF' }]
    };
    widgetConfig = {
      type: 'agenda',
      title: 'Agenda',
      subtitle: 'Upcoming teaching events',
      items: [
        { label: 'Class', title: 'conceptual card', desc: 'Event', badge: 'Apr 2', color: '#00D4FF' }
      ]
    };
  } else if (userRole === 'student') {
    headerConfig = {
      gradient: 'bg-gradient-to-r from-[#020b1f] via-[#0f48b9] to-[#00d4ff]',
      title: 'Welcome back! 💡\nReady to learn?',
      subtitle: ''
    };
    statsConfig = [
      { 
        title: 'Enrolled Courses', 
        value: stats?.enrolledCourses?.length || 0, 
        icon: BookOpen,
        accent: '#00D4FF',
        borderHover: 'hover:border-[#00D4FF]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.2)]',
        iconBg: 'bg-[#00D4FF]/10 text-[#00D4FF]'
      },
      { 
        title: 'Average Progress', 
        value: `${stats?.percentile || 0}%`, 
        icon: TrendingUp,
        accent: '#10B981',
        borderHover: 'hover:border-[#10B981]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-[#10B981]/10 text-[#10B981]'
      },
      { 
        title: 'Days Studied', 
        value: stats?.daysStudied || 0, 
        icon: CheckCircle,
        accent: '#F59E0B',
        borderHover: 'hover:border-[#F59E0B]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]',
        iconBg: 'bg-[#F59E0B]/10 text-[#F59E0B]'
      },
      { 
        title: 'Certificates', 
        value: stats?.certificates?.length || 0, 
        icon: Award,
        accent: '#8B5CF6',
        borderHover: 'hover:border-[#8B5CF6]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(139,92,246,0.2)]',
        iconBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
      }
    ];
    gaugeConfig = {
      title: 'Academic Progress Ring',
      valStr: `${stats?.percentile || 0}%\nPROGRESS`,
      valNum: stats?.percentile || 0,
      ringColor: '#00D4FF'
    };
    areaConfig = {
      title: 'Weekly Study Goal',
      data: stats?.weeklyStudyData || [],
      lines: [{ key: 'hours', name: 'Study Hours', color: '#00D4FF' }]
    };
    widgetConfig = {
      type: 'claim',
      title: 'Certificates Claim',
      action: 'Claim Certificate'
    };
  } else if (userRole === 'sponsor') {
    headerConfig = {
      gradient: 'bg-gradient-to-r from-[#020b1f] via-[#0f48b9] to-[#00d4ff]',
      title: 'Welcome, Sponsor! 🌟\nEmpowering education for everyone.',
      subtitle: ''
    };
    statsConfig = [
      { 
        title: 'Total Contributions', 
        value: `$${stats?.stats?.totalContributions || 0}`, 
        icon: CircleDollarSign,
        accent: '#EC4899',
        borderHover: 'hover:border-[#EC4899]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(236,72,153,0.2)]',
        iconBg: 'bg-[#EC4899]/10 text-[#EC4899]'
      },
      { 
        title: 'Supported Students', 
        value: stats?.stats?.supportedStudents || 0, 
        icon: Users,
        accent: '#8B5CF6',
        borderHover: 'hover:border-[#8B5CF6]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(139,92,246,0.2)]',
        iconBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
      },
      { 
        title: 'Courses Completed', 
        value: stats?.humanImpact?.coursesCompleted || 0, 
        icon: CheckCircle,
        accent: '#10B981',
        borderHover: 'hover:border-[#10B981]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-[#10B981]/10 text-[#10B981]'
      },
      { 
        title: 'Active Cycles', 
        value: stats?.stats?.activeSupportCycles || 0, 
        icon: BookOpen,
        accent: '#00D4FF',
        borderHover: 'hover:border-[#00D4FF]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.2)]',
        iconBg: 'bg-[#00D4FF]/10 text-[#00D4FF]'
      }
    ];
    gaugeConfig = {
      title: 'Human Impact Index',
      valStr: `${stats?.stats?.supportedStudents ? '100' : '0'}%\nIMPACT`,
      valNum: stats?.stats?.supportedStudents ? 100 : 0,
      ringColor: '#F59E0B'
    };
    areaConfig = {
      title: 'Sponsorship Timeline',
      data: stats?.recentImpact?.map(r => ({ name: new Date(r.createdAt).toLocaleDateString(), impact: 1 })) || [],
      lines: [{ key: 'impact', name: 'Impact Instances', color: '#F59E0B' }]
    };
    widgetConfig = {
      type: 'communication',
      title: 'Communication',
      action: 'Message Student'
    };
  } else {
    headerConfig = {
      gradient: 'bg-gradient-to-r from-[#020b1f] via-[#0f48b9] to-[#00d4ff]',
      title: 'Welcome, Family Guardian! 🛡️\nHeart-centered follow-up for student success.',
      subtitle: ''
    };
    statsConfig = [
      { 
        title: 'Students Monitored', 
        value: stats?.totalLearners || 0, 
        icon: Users,
        accent: '#00D4FF',
        borderHover: 'hover:border-[#00D4FF]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(0,212,255,0.2)]',
        iconBg: 'bg-[#00D4FF]/10 text-[#00D4FF]'
      },
      { 
        title: 'Total Enrolled Courses', 
        value: stats?.totalEnrolledCourses || 0, 
        icon: BookOpen,
        accent: '#8B5CF6',
        borderHover: 'hover:border-[#8B5CF6]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(139,92,246,0.2)]',
        iconBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
      },
      { 
        title: 'Completed Lessons', 
        value: stats?.completedLessons || 0, 
        icon: TrendingUp,
        accent: '#10B981',
        borderHover: 'hover:border-[#10B981]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
        iconBg: 'bg-[#10B981]/10 text-[#10B981]'
      },
      { 
        title: 'Average Progress', 
        value: `${stats?.averageProgress || 0}%`, 
        icon: CheckCircle,
        accent: '#F59E0B',
        borderHover: 'hover:border-[#F59E0B]/40',
        shadowHover: 'hover:shadow-[0_10px_30px_rgba(245,158,11,0.2)]',
        iconBg: 'bg-[#F59E0B]/10 text-[#F59E0B]'
      }
    ];
    gaugeConfig = {
      title: 'Family Growth Circle',
      valStr: `${stats?.averageProgress || 0}%\nGrowth`,
      valNum: stats?.averageProgress || 0,
      ringColor: '#00D4FF'
    };
    areaConfig = {
      title: 'Milestone Timeline',
      data: stats?.performanceTimeline || [],
      lines: [{ key: 'progress', name: 'Growth', color: '#00D4FF' }, { key: 'target', name: 'Target', color: '#F97316' }]
    };
    widgetConfig = {
      type: 'communication',
      title: 'Communication',
      action: 'Message Instructor'
    };
  }

  const topCourseRankings = Array.isArray(stats?.topCourses) ? stats.topCourses : [];
  const recentActivities = Array.isArray(stats?.recentActivities) ? stats.recentActivities.slice(0, 5) : (Array.isArray(stats?.recentActivity) ? stats.recentActivity.slice(0, 5) : []);
  const notifications = clearedNotifications ? [] : (Array.isArray(stats?.notifications) ? stats.notifications.slice(0, 5) : []);
  const events = Array.isArray(stats?.events) ? stats.events.slice(0, 4) : [];
  const studentEngagement = {
    activeStudents: stats?.engagement?.dailyActiveUsers || stats?.studentEngagement?.activeStudents || 0,
    lessonsCompleted: stats?.engagement?.lessonsCompleted || stats?.studentEngagement?.lessonsCompleted || 0,
    studyHours: stats?.engagement?.studyHours || stats?.studentEngagement?.studyHours || 0
  };
  const instructorPerformanceRaw = stats?.engagement?.instructorPerformance || stats?.instructorPerformance;
  const instructorPerformance = Array.isArray(instructorPerformanceRaw) ? instructorPerformanceRaw.slice(0, 3) : [];

  let gauge1 = 0, gauge2 = 0, gauge3 = 0, gauge4 = 0;
  if (userRole === 'admin') {
     gauge1 = Math.min(100, Math.round(((stats?.engagement?.dailyActiveUsers ?? 0) / Math.max(stats?.totalStudents ?? 1, 1)) * 100));
     gauge2 = stats?.topCourses?.length ? Math.round(stats.topCourses.reduce((sum, c) => sum + (c.completionRate || 0), 0) / stats.topCourses.length) : 0;
     gauge3 = Math.min(100, stats?.engagement?.lessonsCompleted ?? 0);
     gauge4 = Math.min(100, (stats?.recentActivities?.length ?? 0) * 5);
  } else if (userRole === 'instructor') {
     gauge1 = stats?.totalStudents ? 100 : 0;
     gauge2 = stats?.totalCourses ? Math.round((stats.activeCourses/stats.totalCourses)*100) : 0;
     gauge3 = stats?.totalLessons ? Math.min(100, stats.totalLessons * 5) : 0;
     gauge4 = 100;
  } else if (userRole === 'student') {
     gauge1 = stats?.daysStudied ? Math.min(100, Math.round((stats.daysStudied / 7) * 100)) : 0;
     gauge2 = stats?.percentile || 0;
     gauge3 = stats?.enrolledCourses?.length ? Math.min(100, stats.enrolledCourses.length * 20) : 0;
     gauge4 = stats?.certificates?.length ? 100 : (stats?.achievements?.length ? 50 : 0);
  } else if (userRole === 'parent') {
     gauge1 = stats?.totalLearners ? 100 : 0;
     gauge2 = stats?.averageProgress || 0;
     gauge3 = stats?.completedLessons ? Math.min(100, stats.completedLessons * 10) : 0;
     gauge4 = stats?.recentActivity?.length ? Math.min(100, stats.recentActivity.length * 20) : 0;
  } else if (userRole === 'sponsor') {
     gauge1 = stats?.stats?.supportedStudents ? 100 : 0;
     gauge2 = stats?.humanImpact?.coursesCompleted ? Math.min(100, stats.humanImpact.coursesCompleted * 10) : 0;
     gauge3 = stats?.stats?.activeSupportCycles ? 100 : 0;
     gauge4 = stats?.recentImpact?.length ? Math.min(100, stats.recentImpact.length * 20) : 0;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={`w-10 h-10 border-4 rounded-full animate-spin ${
          isDarkMode 
            ? 'border-white/20 border-t-white' 
            : 'border-slate-200 border-t-emerald-500'
        }`}></div>
      </div>
    );
  }

  if (userRole === 'sponsor') {
    return <Navigate to="/dashboard/sponsor" replace />;
  }

  const dashboardAction = (tab) => {
    if (!tab) return;
    navigate(`/dashboard?tab=${tab}`, { replace: true });
  };

  if (userRole === 'student') {
    const enrolledCourses = stats?.enrolledCourses || [];
    const completedCourses = enrolledCourses.filter(c => c.progress === 100 || c.status === 'completed' || c.completed === true);
    
    const userCertificates = stats?.certificates || [];
    const claimedCourseIds = new Set(userCertificates.map(c => c.courseId));
    
    const readyToClaimCertificates = completedCourses.filter(enrolled => {
      const courseId = enrolled.course?.id || enrolled.courseId;
      const isPassed = !enrolled.course?.isExamRequired || enrolled.passedFinalExam;
      return !claimedCourseIds.has(courseId) && isPassed;
    });

    const certificateEarnedCount = userCertificates.length;
    const readyToClaimCount = readyToClaimCertificates.length;
    const totalCertificateProgress = certificateEarnedCount + readyToClaimCount;

    let totalProgress = 0;
    let totalLessonsCompleted = 0;
    enrolledCourses.forEach(e => {
        totalProgress += (e.progress || 0);
        const lessons = e.completedLessons ? (Array.isArray(e.completedLessons) ? e.completedLessons : [e.completedLessons]) : [];
        totalLessonsCompleted += lessons.length;
    });
    const averageProgress = enrolledCourses.length > 0 ? Math.round(totalProgress / enrolledCourses.length) : 0;

    return <StudentOverview 
      user={user}
      enrolledCourses={enrolledCourses} 
      completedCourses={completedCourses}
      totalEnrolled={enrolledCourses.length}
      totalLessonsCompleted={totalLessonsCompleted}
      averageProgress={averageProgress}
      isDarkMode={isDarkMode}
      setActiveTab={dashboardAction}
      dashboardStats={stats}
      sectionsData={sectionsData}
      certificateSummary={{
        claimed: certificateEarnedCount,
        readyToClaim: readyToClaimCount,
        total: totalCertificateProgress
      }}
    />;
  }

  const exportToCSV = () => {
    const headers = ['Month', 'Revenue', 'Students', 'Courses'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + patternPerformanceData.map(e => `${e.name},${e.revenue},${e.students},${e.courses}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "platform_performance.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowRechartsMenu(false);
  };

  const exportFullPlatformReport = () => {
    const reportTitle = "EDOT Platform Executive Performance Report";
    const timestamp = new Date().toLocaleString();
    
    // Overview Metrics
    const coursesCount = stats?.dashboardStats?.totalCourses ?? stats?.totalCourses ?? 0;
    const studentsCount = stats?.dashboardStats?.totalStudents ?? stats?.totalStudents ?? 0;
    const instructorsCount = stats?.dashboardStats?.totalInstructors ?? stats?.totalInstructors ?? 0;
    const pendingCount = stats?.dashboardStats?.pendingApprovals ?? stats?.pendingCourses ?? 0;
    const revenueVal = formatCurrency(currentMonthRevenue);
    
    let content = `${reportTitle}\n`;
    content += `=========================================\n`;
    content += `Generated On: ${timestamp}\n`;
    content += `Target Environment: Production Node API\n`;
    content += `=========================================\n\n`;
    
    content += `I. SYSTEM OVERVIEW METRICS\n`;
    content += `-----------------------------------------\n`;
    content += `Total Courses:        ${coursesCount}\n`;
    content += `Active Students:      ${studentsCount}\n`;
    content += `Approved Instructors: ${instructorsCount}\n`;
    content += `Pending Approvals:    ${pendingCount}\n`;
    content += `Cumulative Revenue:   ${revenueVal}\n\n`;
    
    content += `II. MONTHLY TRANSACTIONAL TRENDS\n`;
    content += `-----------------------------------------\n`;
    content += `Month,Course Revenue,Sponsorships,Cumulative Volume\n`;
    patternPerformanceData.forEach(row => {
      content += `${row.name},${row.revenue},${row.students},${row.courses}\n`;
    });
    content += `\n`;
    
    content += `III. TOP PERFORMING COURSE RANKINGS\n`;
    content += `-----------------------------------------\n`;
    if (topCourseRankings.length > 0) {
      topCourseRankings.forEach((c, idx) => {
        content += `${idx + 1}. ${c.title || c.name} | Students: ${c.totalStudents ?? c.enrollments ?? 0} | Completion: ${c.completionRate ?? 0}%\n`;
      });
    } else {
      content += `No course rankings recorded this period.\n`;
    }
    content += `\n`;
    
    content += `IV. RECENT SYSTEM LOG ACTIVITY FEED\n`;
    content += `-----------------------------------------\n`;
    if (recentActivities.length > 0) {
      recentActivities.forEach((act, idx) => {
        content += `[${new Date(act.date).toLocaleDateString()}] ${act.title} - ${act.itemTitle || act.studentName || ''}\n`;
      });
    } else {
      content += `No system log activity feed recorded.\n`;
    }
    
    content += `\n=========================================\n`;
    content += `End of Report - Authorized by Administrator\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `EDOT_Executive_Report_${new Date().toISOString().slice(0,10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowRechartsMenu(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-w-none w-full pb-10"
      onClick={() => {
        if (showRechartsMenu) setShowRechartsMenu(false);
        if (showNotificationsMenu) setShowNotificationsMenu(false);
      }}
    >
      {/* 1. Ultra-Modern Welcome Banner */}
      <div className={`rounded-[2rem] p-8 md:p-10 border relative overflow-hidden backdrop-blur-2xl transition-all duration-500 ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-white/60 border-slate-200 shadow-sm'}`}>
        {/* Dynamic Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00D4FF]/20 to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#F97316]/10 to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/4"></div>
        <div className={`absolute inset-0 opacity-10 pointer-events-none ${headerConfig.gradient}`}></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center">
          <div className="flex-1">
            <h1 className={`text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {headerConfig.title}
            </h1>
            {headerConfig.subtitle && (
              <p className={`text-sm md:text-base font-semibold max-w-2xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{headerConfig.subtitle}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {userRole === 'admin' && (
                <button 
                  onClick={() => setIsAgendaModalOpen(true)}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-white font-black text-xs uppercase tracking-wider hover:-translate-y-0.5 shadow-[0_10px_25px_-5px_rgba(0,212,255,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  <Bell className="w-4 h-4" /> Broadcast Notice
                </button>
              )}
              {userRole === 'instructor' && (
                <button 
                  onClick={() => navigate('/dashboard/builder')}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-xs uppercase tracking-wider hover:-translate-y-0.5 shadow-[0_10px_25px_-5px_rgba(249,115,22,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  <BookOpen className="w-4 h-4" /> Create New Course
                </button>
              )}
              {userRole === 'student' && (
                <button 
                  onClick={() => navigate('/dashboard/courses')}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-white font-black text-xs uppercase tracking-wider hover:-translate-y-0.5 shadow-[0_10px_25px_-5px_rgba(0,212,255,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  <BookOpen className="w-4 h-4" /> Start a Lesson
                </button>
              )}
              {userRole === 'parent' && (
                <button 
                  onClick={() => navigate('/dashboard/messages')}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-white font-black text-xs uppercase tracking-wider hover:-translate-y-0.5 shadow-[0_10px_25px_-5px_rgba(0,212,255,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  <Mail className="w-4 h-4" /> Message Instructor
                </button>
              )}
            </div>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-4 shrink-0">
            <div className={`rounded-3xl p-5 border backdrop-blur-xl flex-1 min-w-[160px] transition-all duration-300 hover:scale-[1.03] group ${isDarkMode ? 'bg-[#0B1120]/50 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-[#00D4FF]/30 hover:shadow-[0_10px_30px_rgba(0,212,255,0.1)]' : 'bg-white/70 border-slate-200/80 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:border-slate-300'}`}>
              <p className={`text-[10px] font-black tracking-widest uppercase mb-2 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#00B2D6]'}`}>Platform Status</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </div>
                <p className={`text-2xl font-black leading-none tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Healthy</p>
              </div>
              <p className={`text-[11px] font-medium mt-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>All systems nominal</p>
            </div>
            
            <div className={`rounded-3xl p-5 border backdrop-blur-xl flex-1 min-w-[160px] transition-all duration-300 hover:scale-[1.03] group ${isDarkMode ? 'bg-[#0B1120]/50 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-[#F97316]/30 hover:shadow-[0_10px_30px_rgba(249,115,22,0.1)]' : 'bg-white/70 border-slate-200/80 shadow-[0_8px_32px_rgba(31,38,135,0.04)] hover:border-slate-300'}`}>
              <p className={`text-[10px] font-black tracking-widest uppercase mb-2 ${isDarkMode ? 'text-[#F97316]' : 'text-[#EA580C]'}`}>Active Now</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                </div>
                <p className={`text-2xl font-black leading-none tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.engagement?.studentEngagement?.activeStudents ?? stats?.dailyActiveUsers ?? 0}</p>
              </div>
              <p className={`text-[11px] font-medium mt-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Users live right now</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${
        statsConfig.length === 5 ? 'xl:grid-cols-5' : 
        statsConfig.length === 4 ? 'xl:grid-cols-4' : 
        statsConfig.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
      } gap-6`}>
        {statsConfig.map((stat, i) => (
          <SmartCard 
            key={i} 
            title={stat.title} 
            value={stat.value} 
            icon={stat.icon} 
            accent={stat.accent}
            borderHover={stat.borderHover}
            shadowHover={stat.shadowHover}
            iconBg={stat.iconBg}
          />
        ))}
      </div>

      {/* 3. Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Widget: Essential Activities Gauges */}
        <Card hover={false} className={`lg:col-span-3 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col relative h-[400px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <h3 className={`font-black text-xs tracking-widest uppercase mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Essential Activities</h3>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 flex-1 items-center">
            {/* Student Engagement */}
            <div className="flex flex-col items-center group">
              <div className="relative w-16 h-16 mb-2.5 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="gaugeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#gaugeGrad1)"
                    strokeWidth="3"
                    strokeDasharray={`${gauge1}, 100`}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0px 3px 6px rgba(16, 185, 129, 0.35))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {gauge1}%
                  </span>
                </div>
              </div>
              <p className={`text-[10px] text-center font-bold tracking-tight uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Student Engagement</p>
            </div>

            {/* Course Completion */}
            <div className="flex flex-col items-center group">
              <div className="relative w-16 h-16 mb-2.5 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="gaugeGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#60A5FA" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#gaugeGrad2)"
                    strokeWidth="3"
                    strokeDasharray={`${gauge2}, 100`}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0px 3px 6px rgba(59, 130, 246, 0.35))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {gauge2}%
                  </span>
                </div>
              </div>
              <p className={`text-[10px] text-center font-bold tracking-tight uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Course Completion</p>
            </div>

            {/* Learning Activity */}
            <div className="flex flex-col items-center group">
              <div className="relative w-16 h-16 mb-2.5 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="gaugeGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#FBBF24" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#gaugeGrad3)"
                    strokeWidth="3"
                    strokeDasharray={`${gauge3}, 100`}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0px 3px 6px rgba(245, 158, 11, 0.35))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {gauge3}%
                  </span>
                </div>
              </div>
              <p className={`text-[10px] text-center font-bold tracking-tight uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Learning Activity</p>
            </div>

            {/* Community Activity */}
            <div className="flex flex-col items-center group">
              <div className="relative w-16 h-16 mb-2.5 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="gaugeGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#A78BFA" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#gaugeGrad4)"
                    strokeWidth="3"
                    strokeDasharray={`${gauge4}, 100`}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0px 3px 6px rgba(139, 92, 246, 0.35))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {gauge4}%
                  </span>
                </div>
              </div>
              <p className={`text-[10px] text-center font-bold tracking-tight uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Community Activity</p>
            </div>
          </div>
        </Card>

        {/* Right Widget: Line/Area Chart */}
        <Card hover={false} className={`lg:col-span-5 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[400px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex justify-between items-center mb-6 shrink-0 relative">
            <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{areaConfig.title}</h3>
            <div 
              onClick={(e) => { e.stopPropagation(); setShowRechartsMenu(!showRechartsMenu); }}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded cursor-pointer font-black uppercase tracking-wider ${isDarkMode ? 'text-[#00D4FF] bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20' : 'text-[#00B2D6] bg-[#00B2D6]/10 hover:bg-[#00B2D6]/20'}`}
            >
              Recharts <MoreHorizontal className="w-3 h-3" />
            </div>
            {showRechartsMenu && (
              <div className={`absolute top-8 right-0 w-36 rounded-xl shadow-2xl overflow-hidden z-20 border backdrop-blur-xl ${isDarkMode ? 'bg-slate-950/95 border-white/10' : 'bg-white border-slate-200'}`}>
                <button onClick={exportToCSV} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} cursor-pointer`}>Export to CSV</button>
                <button onClick={() => setShowRechartsMenu(false)} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} cursor-pointer`}>Refresh Data</button>
              </div>
            )}
          </div>
          
          <div className={`flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-wider mb-4 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
             {areaConfig.lines.map((line, i) => (
               <span key={i} className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: line.color, boxShadow: `0 0 8px ${line.color}80` }}></div> 
                 {line.name}
               </span>
             ))}
          </div>

          <div className="flex-1 w-full relative min-h-[220px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaConfig.data} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    {areaConfig.lines.map((line, i) => (
                      <linearGradient key={i} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={line.color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={line.color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff" : "#000000"} strokeOpacity={0.22} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  {areaConfig.lines.map((line, i) => (
                    <Area key={i} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2.5} fillOpacity={1} fill={`url(#color${i})`} activeDot={{ r: 5, fill: line.color, stroke: '#fff', strokeWidth: 2 }} />
                  ))}
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </Card>

         {/* Right Side Block: Top Courses for Admin, alternative widgets for others */}
         {userRole === 'admin' ? (
            <Card hover={false} className={`lg:col-span-4 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[400px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
                <div>
                  <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Top Courses</h3>
                  <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>This month’s best performers</p>
                </div>
                <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full border ${isDarkMode ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>{topCourseRankings.length} items</span>
              </div>
              <div className="space-y-3.5 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                {topCourseRankings.length ? topCourseRankings.map((course, index) => {
                  const colors = [
                    { border: 'hover:border-[#00D4FF]/30', rankBg: 'bg-[#00D4FF]/10 text-[#00D4FF]', bar: 'from-[#00D4FF] to-[#00A3CC]' },
                    { border: 'hover:border-[#8B5CF6]/30', rankBg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]', bar: 'from-[#8B5CF6] to-[#7C3AED]' },
                    { border: 'hover:border-[#F97316]/30', rankBg: 'bg-[#F97316]/10 text-[#F97316]', bar: 'from-[#F97316] to-[#EA580C]' },
                  ];
                  const cStyle = colors[index % colors.length];
                  
                  return (
                    <div key={course.id || index} className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-0.5 ${cStyle.border} ${isDarkMode ? 'border-white/5 bg-white/5/30' : 'border-slate-100 bg-slate-50/50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${cStyle.rankBg}`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.title || course.name || 'Untitled course'}</p>
                            <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{course.enrollments ?? 0} students</p>
                          </div>
                        </div>
                       <div className="text-right">
                         <p className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.completionRate ?? 0}%</p>
                         <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>completion</p>
                       </div>
                      </div>
                      <div className="mt-3.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${cStyle.bar}`} style={{ width: `${course.completionRate ?? 0}%` }} />
                      </div>
                    </div>
                  );
                }) : (
                  <div className={`rounded-3xl p-6 text-center text-sm font-medium ${isDarkMode ? 'bg-white/5 text-slate-400 border border-white/5' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                    No top course data available yet.
                  </div>
                )}
              </div>
            </Card>
         ) : (
            <div className="lg:col-span-4 h-full">
              {widgetConfig.type === 'agenda' && (
                <AgendaWidget 
                  events={agendaEvents} 
                  userRole={userRole} 
                  isAdmin={userRole === 'admin'} 
                  onDelete={deleteAgenda} 
                  onCreateClick={() => setIsAgendaModalOpen(true)} 
                />
              )}

              {widgetConfig.type === 'claim' && (
                <Card hover={false} className={`rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col min-h-[350px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/40 border-white/10' : 'bg-white/80 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{widgetConfig.title}</h3>
                    <MoreHorizontal className={`w-4 h-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 mb-6 opacity-90 transition-transform hover:scale-105 duration-300">
                      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="20" y="25" width="40" height="50" rx="4" fill={isDarkMode ? "#1E293B" : "#E2E8F0"} />
                        <rect x="30" y="15" width="45" height="55" rx="4" fill={isDarkMode ? "#334155" : "#CBD5E1"} />
                        <rect x="40" y="20" width="50" height="60" rx="4" fill={isDarkMode ? "#0F172A" : "#F8FAFC"} />
                        <circle cx="65" cy="50" r="12" fill="#00D4FF" />
                        <circle cx="65" cy="50" r="9" fill="#FDE047" />
                        <circle cx="65" cy="50" r="6" fill="#FEF08A" />
                        <path d="M57 60 L61 75 L65 70 L69 75 L73 60" fill="#00D4FF" />
                      </svg>
                    </div>
                    <button 
                      onClick={() => navigate('/dashboard/certificates')}
                      className="w-full py-3 bg-[#00D4FF] hover:bg-[#00A3CC] text-[#0B1120] font-bold rounded-xl transition-all text-sm shadow-[0_4px_12px_rgba(0,212,255,0.2)] hover:scale-[1.02] cursor-pointer"
                      style={{ borderRadius: '12px' }}
                    >
                      {widgetConfig.action}
                    </button>
                  </div>
                </Card>
              )}

              {widgetConfig.type === 'communication' && (
                <Card hover={false} className={`rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col min-h-[350px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/40 border-white/10' : 'bg-white/80 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{widgetConfig.title}</h3>
                    <MoreHorizontal className={`w-4 h-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-[#00D4FF]/10 to-[#00D4FF]/20 flex items-center justify-center border border-[#00D4FF]/30 transition-transform hover:scale-105 duration-300">
                      <Mail className="w-10 h-10 text-[#00D4FF]" />
                    </div>
                    <button 
                      onClick={() => navigate('/dashboard/messages')}
                      className="w-full py-3 border-2 border-[#00D4FF] text-[#00D4FF] hover:bg-[#00D4FF] hover:text-[#0B1120] font-bold rounded-xl transition-all text-sm shadow-[0_4px_12px_rgba(0,212,255,0.1)] hover:scale-[1.02] cursor-pointer"
                      style={{ borderRadius: '12px' }}
                    >
                      {widgetConfig.action}
                    </button>
                  </div>
                </Card>
              )}
            </div>
          )}
 
       </div>

        {/* 4. Category & Completion Analytics Row */}
        {userRole === 'admin' && (
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* Category Distribution PieChart */}
           <Card hover={false} className={`lg:col-span-6 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[400px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
             <h3 className={`font-black text-xs tracking-widest uppercase mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Course Category Distribution</h3>
             <div className="flex-grow flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex-1 w-full h-[250px] relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={[
                         { name: 'Tech & Programming', value: 35, color: '#00D4FF' },
                         { name: 'Math & Science', value: 25, color: '#F97316' },
                         { name: 'Social Science', value: 15, color: '#10B981' },
                         { name: 'Natural Language', value: 10, color: '#8B5CF6' },
                         { name: 'Business Hub', value: 10, color: '#EC4899' },
                         { name: 'Personal Growth', value: 5, color: '#F59E0B' },
                       ]}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={4}
                       dataKey="value"
                     >
                       {[
                         { name: 'Tech & Programming', value: 35, color: '#00D4FF' },
                         { name: 'Math & Science', value: 25, color: '#F97316' },
                         { name: 'Social Science', value: 15, color: '#10B981' },
                         { name: 'Natural Language', value: 10, color: '#8B5CF6' },
                         { name: 'Business Hub', value: 10, color: '#EC4899' },
                         { name: 'Personal Growth', value: 5, color: '#F59E0B' },
                       ].map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <RechartsTooltip content={<CustomTooltip />} />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="flex flex-col gap-2 shrink-0 pr-4 text-left">
                 {[
                   { name: 'Tech & Programming', value: '35%', color: '#00D4FF' },
                   { name: 'Math & Science', value: '25%', color: '#F97316' },
                   { name: 'Social Science', value: '15%', color: '#10B981' },
                   { name: 'Natural Language', value: '10%', color: '#8B5CF6' },
                   { name: 'Business Hub', value: '10%', color: '#EC4899' },
                   { name: 'Personal Growth', value: '5%', color: '#F59E0B' },
                 ].map((item, idx) => (
                   <div key={idx} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all duration-300 hover:translate-x-1 ${isDarkMode ? 'border-white/5 bg-white/5 shadow-sm hover:border-white/10 hover:bg-white/5' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}>
                     <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }}></span>
                     <span className={`text-[11px] font-bold truncate max-w-[120px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.name}</span>
                     <span className={`text-[11px] font-black ml-auto ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#00B2D6]'}`}>{item.value}</span>
                   </div>
                 ))}
               </div>
             </div>
           </Card>
 
           {/* Cumulative Exporter */}
           <Card hover={false} className={`lg:col-span-6 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[400px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
             <h3 className={`font-black text-xs tracking-widest uppercase mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cumulative Report Exporter</h3>
             <div className="flex-grow flex flex-col justify-between p-4">
               <div className="space-y-4 text-left">
                 <div className={`p-4 rounded-2xl border transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-[#00D4FF]/30' : 'bg-slate-50/50 border-slate-200 hover:border-[#00B2D6]/30'}`}>
                   <p className={`text-[11px] font-black uppercase tracking-wider mb-2 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#00B2D6]'}`}>System Metrics Health</p>
                   <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                     Active connection pools, cache lifetimes, and database replicas are fully operational. Last synchronization happened less than a minute ago.
                   </p>
                 </div>
                 <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                   Download the full structural platform audit report capturing active student demographics, course categories distribution, instructor assignment scores, and real-time financial logs.
                 </p>
               </div>
               <button
                 onClick={exportFullPlatformReport}
                 className="w-full py-4 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-white font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(0,212,255,0.3)] hover:shadow-[0_15px_35px_rgba(0,212,255,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                 style={{ borderRadius: '1rem' }}
               >
                 📥 Download Executive Platform Report (.txt)
               </button>
             </div>
           </Card>
         </div>
        )}

      {userRole === 'admin' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <Card hover={false} className={`xl:col-span-3 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[500px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
              <div>
                <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Recent Activities</h3>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Live platform feed</p>
              </div>
              <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full border ${isDarkMode ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>{recentActivities.length} activities</span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
              {recentActivities.length ? recentActivities.map((activity, index) => {
                const isJoined = activity.type === 'user_joined';
                const isPublished = activity.type === 'course_published';
                const borderAccent = isJoined ? 'border-l-4 border-l-[#10B981] border-t-4 border-t-[#10B981]' : isPublished ? 'border-l-4 border-l-[#3B82F6] border-t-4 border-t-[#3B82F6]' : 'border-l-4 border-l-[#8B5CF6] border-t-4 border-t-[#8B5CF6]';
                const iconBg = isJoined ? 'bg-[#10B981]/10 text-[#10B981]' : isPublished ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-[#8B5CF6]/10 text-[#8B5CF6]';
                
                return (
                  <div key={activity.id || index} className={`rounded-r-2xl rounded-l-md p-3 border transition-all duration-300 ${
                    isDarkMode 
                      ? 'border-y-white/5 border-r-white/5 bg-[#0B1120]/40 hover:bg-[#0B1120]/65 hover:border-white/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]' 
                      : 'border-slate-200/60 bg-[#F8FAFC] hover:bg-slate-100 hover:border-slate-350 shadow-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.03)]'
                  } ${borderAccent}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${iconBg}`}>
                        {isJoined ? '👤' : isPublished ? '📚' : '⚡'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{activity.title || 'Platform Log'}</p>
                        <p className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{activity.itemTitle || activity.studentName}</p>
                        <p className={`text-[10px] font-extrabold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'} mt-1`}>{new Date(activity.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className={`rounded-3xl p-6 text-center text-sm font-medium ${isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  No recent activities.
                </div>
              )}
            </div>
          </Card>
 
          <Card hover={false} className={`xl:col-span-3 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[500px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
              <div>
                <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Instructor Performance</h3>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Top teaching metrics</p>
              </div>
              <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full border ${isDarkMode ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>{instructorPerformance.length} instructors</span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
              {instructorPerformance.length ? instructorPerformance.map((inst) => {
                const coursesCount = Array.isArray(inst.coursesTaught) ? inst.coursesTaught.length : (inst.coursesTaught ?? 0);
                const studentCount = inst.studentCount ?? (Array.isArray(inst.coursesTaught) ? inst.coursesTaught.reduce((sum, c) => sum + (c.totalStudents || 0), 0) : 0);
                
                return (
                <div key={inst.id} className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.03)] ${isDarkMode ? 'border-white/5 bg-[#0B1120]/40 hover:border-white/10 hover:bg-[#0B1120]/60' : 'border-slate-200/60 bg-[#F8FAFC] hover:border-slate-350 hover:bg-slate-100/30 shadow-sm'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{inst.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); navigate('/courses'); }}
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-[#00D4FF] hover:bg-[#00B2D6] text-[#0B1120] rounded-full shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                        >
                          {coursesCount} courses
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); alert(`Instructor ${inst.name} has ${studentCount} enrolled students.`); }}
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                        >
                          {studentCount} students
                        </button>
                      </div>
                    </div>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${isDarkMode ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/25' : 'bg-[#00B2D6]/10 text-[#00B2D6] border-[#00B2D6]/20'}`}>{inst.performanceScore ?? 0}%</span>
                  </div>
                  <div className="mt-3.5 pt-3.5 border-t space-y-2 text-xs font-bold" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center justify-between">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Completion</span>
                      <span className={isDarkMode ? 'text-white font-black' : 'text-slate-950 font-black'}>{inst.completionRate ?? 0}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Attendance</span>
                      <span className={isDarkMode ? 'text-white font-black' : 'text-slate-950 font-black'}>{inst.attendanceRate ?? 0}%</span>
                    </div>
                  </div>
                </div>
                );
              }) : (
                <div className={`rounded-3xl p-6 text-center text-sm font-medium ${isDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  No instructor data yet.
                </div>
              )}
            </div>
          </Card>
 
          <Card hover={false} className={`xl:col-span-3 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[500px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
              <div>
                <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Student Engagement</h3>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Learning activity trends</p>
              </div>
              <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full border ${isDarkMode ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>This Week</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
              <div className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDarkMode ? 'border-white/5 bg-[#0B1120]/40 hover:border-[#00D4FF]/25 hover:bg-[#0B1120]/60 hover:shadow-[0_8px_24px_rgba(0,212,255,0.04)]' : 'border-slate-200/60 bg-[#F8FAFC] hover:border-slate-350 shadow-sm'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Active Students</p>
                <p className={`mt-2 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.engagement?.studentEngagement?.activeStudents ?? 0}</p>
                <p className={`text-xs font-bold mt-1 text-emerald-500`}>{stats?.engagement?.studentEngagement?.activeStudentsChange ?? '+0%'}</p>
              </div>
              <div className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDarkMode ? 'border-white/5 bg-[#0B1120]/40 hover:border-[#00D4FF]/25 hover:bg-[#0B1120]/60 hover:shadow-[0_8px_24px_rgba(0,212,255,0.04)]' : 'border-slate-200/60 bg-[#F8FAFC] hover:border-slate-350 shadow-sm'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Lessons Completed</p>
                <p className={`mt-2 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.engagement?.studentEngagement?.lessonsCompleted ?? 0}</p>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Cumulative study progress</p>
              </div>
              <div className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDarkMode ? 'border-white/5 bg-[#0B1120]/40 hover:border-[#00D4FF]/25 hover:bg-[#0B1120]/60 hover:shadow-[0_8px_24px_rgba(0,212,255,0.04)]' : 'border-slate-200/60 bg-[#F8FAFC] hover:border-slate-350 shadow-sm'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Study Hours</p>
                <p className={`mt-2 text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.engagement?.studentEngagement?.studyHours ?? 0}</p>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-655'}`}>Hours this month</p>
              </div>
            </div>
          </Card>

          <Card hover={false} className={`xl:col-span-3 rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl flex flex-col h-[500px] transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
              <div>
                <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quick Actions</h3>
                <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Fast access for admins</p>
              </div>
              <Bell className={`w-4.5 h-4.5 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#00B2D6]'}`} />
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  onClick={() => navigate('/dashboard/builder')} 
                  className="w-full text-white bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] font-bold text-[10px] uppercase tracking-wider py-3 px-1 transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-[#00D4FF]/25 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  Create Course
                </button>
                <button 
                  onClick={() => navigate('/dashboard/approvals')} 
                  className="w-full text-white bg-gradient-to-r from-[#10B981] to-[#059669] font-bold text-[10px] uppercase tracking-wider py-3 px-1 transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-[#10B981]/25 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  Approve Course
                </button>
                <button 
                  onClick={() => navigate('/dashboard/users')} 
                  className="w-full text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] font-bold text-[10px] uppercase tracking-wider py-3 px-1 transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-[#F97316]/25 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  Add Instructor
                </button>
                <button 
                  onClick={() => navigate('/dashboard/notice')} 
                  className="w-full text-white bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] font-bold text-[10px] uppercase tracking-wider py-3 px-1 transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-md hover:shadow-[#8B5CF6]/25 cursor-pointer"
                  style={{ borderRadius: '9999px' }}
                >
                  Broadcast Msg
                </button>
              </div>
              
              <div className="mt-6 relative pt-4 border-t dark:border-white/5 border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>System Notifications</h4>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setShowNotificationsMenu(!showNotificationsMenu); }}
                    className={`p-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5`}
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </div>
                  {showNotificationsMenu && (
                    <div className={`absolute top-10 right-0 w-40 rounded-xl shadow-2xl overflow-hidden z-20 border backdrop-blur-xl ${isDarkMode ? 'bg-slate-950/95 border-white/10' : 'bg-white border-slate-200'}`}>
                      <button onClick={() => { setClearedNotifications(false); setShowNotificationsMenu(false); }} className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-white/5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} cursor-pointer`}>Mark all as read</button>
                      <button onClick={() => { setClearedNotifications(true); setShowNotificationsMenu(false); }} className={`w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer`}>Clear notifications</button>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  {notifications.length > 0 ? notifications.slice(0, 2).map((note, idx) => (
                    <div key={`quick-note-${idx}`} className={`rounded-2xl p-3 border transition-all duration-300 hover:border-slate-200 dark:hover:border-white/10 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-100 bg-slate-50/50'}`}>
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{note.title || note.message || 'Notification'}</p>
                      <p className={`text-[10px] font-medium mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{note.time || note.date || note.createdAt || 'Recent update'}</p>
                    </div>
                  )) : (
                    <div className={`rounded-2xl p-4 text-center text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      You're all caught up!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Shared Global Block: Active Sections */}
      {['admin', 'instructor', 'student'].includes(userRole) && sectionsData.length > 0 && (
        <Card hover={false} className={`rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`font-black text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{userRole === 'admin' ? 'Active Sections' : 'Your Sections'}</h3>
              <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Groups and cohorts you are a part of</p>
            </div>
            <div className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${isDarkMode ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30' : 'bg-[#00B2D6]/10 text-[#00B2D6] border border-[#00B2D6]/20'}`}>
              {sectionsData.length} sections
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...sectionsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4).map((sec, idx) => {
              const hasMembers = sec.students && sec.students.length > 0;
              return (
                <div 
                  key={`global-sec-${idx}`} 
                  className={`group relative overflow-hidden rounded-[1.5rem] p-6 border backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between min-h-[220px] ${
                    hasMembers
                    ? (isDarkMode ? 'bg-gradient-to-br from-[#0B1120] to-[#00D4FF]/10 border-[#00D4FF]/50 hover:border-[#F97316]/50 shadow-[0_0_30px_rgba(0,212,255,0.15)] ring-1 ring-[#00D4FF]/50' : 'bg-gradient-to-br from-white to-[#00D4FF]/5 border-[#00D4FF]/50 hover:border-[#F97316]/50 shadow-lg ring-1 ring-[#00D4FF]/50') 
                    : (isDarkMode ? 'bg-[#0B1120]/80 border-[#F97316]/30 hover:border-[#00D4FF]/50 hover:bg-[#0B1120] shadow-md hover:shadow-[0_20px_40px_rgba(0,212,255,0.08)]' : 'bg-white border-[#F97316]/30 hover:border-[#00D4FF]/50 hover:shadow-xl shadow-sm')
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
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Course: <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>{sec.course?.title || 'Unknown'}</span></p>
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Instructor: <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>{sec.instructor?.name || 'Unassigned'}</span></p>
                </div>
                
                <div className="pt-3.5 border-t flex flex-wrap gap-1.5 items-center dark:border-white/5 border-slate-100 pl-2 relative z-10">
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
              className="text-sm font-bold text-[#00D4FF] hover:text-[#00A3CC] transition-colors flex items-center gap-1 cursor-pointer"
            >
              {userRole === 'admin' ? 'Manage All Sections' : 'View All Sections'} &rarr;
            </button>
          </div>
        </Card>
      )}

      {userRole === 'admin' && events.length > 0 && (
        <Card hover={false} className={`rounded-[2rem] p-6 md:p-8 border backdrop-blur-2xl shadow-xl transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,212,255,0.05)] ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className={`font-black text-xs tracking-widest uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Upcoming Events</h3>
              <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Scheduled platform activities</p>
            </div>
            <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-full border ${isDarkMode ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>{events.length} events</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {events.map((event, index) => (
              <div key={event.id || index} className={`rounded-3xl p-4 border transition-all duration-300 hover:-translate-y-1 ${isDarkMode ? 'border-white/5 bg-white/5 shadow-sm hover:border-[#00D4FF]/30' : 'border-slate-200/60 bg-slate-50/50 shadow-sm hover:border-[#00B2D6]/30'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-[#00D4FF]/10 border-[#00D4FF]/20 text-[#00D4FF]' : 'bg-cyan-50 border-cyan-100 text-cyan-600'} border`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{event.title || 'Event'}</p>
                    <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                </div>
                {event.description && (
                  <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} line-clamp-2`}>{event.description}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <AgendaCreationModal
        isOpen={isAgendaModalOpen}
        onClose={() => setIsAgendaModalOpen(false)}
        onAgendaCreated={(evt) => { onAgendaCreated(evt); setIsAgendaModalOpen(false); }}
      />
    </motion.div>
  );
}
