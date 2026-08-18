import React, { useEffect, useState, useCallback } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AgendaCreationModal from '../components/AgendaCreationModal';
import CustomDropdown from '../components/CustomDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Users, BookOpen, Clock, Settings, LogOut, CheckCircle2, XCircle, UserCog, AlertTriangle, ShieldCheck, Check, Activity, MessageSquare, UserPlus, Eye, ShieldOff, ArrowRightCircle, UserPlus as UserPlusIcon, Search, Bell, Layers, Library, Globe, Calculator, Rocket, Target, UserCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
const edotLogo = 'https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw';
import ActivityFeed from '../components/ActivityFeed';
import AgendaWidget from '../components/AgendaWidget';
import ProfileView from './ProfileView';
import FinanceFees from './FinanceFees';
import FinanceExpenses from './FinanceExpenses';
import { CircleDollarSign, ArrowDownRight } from 'lucide-react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import PremiumModal from '../components/PremiumModal';
import CourseFallbackThumbnail from '../components/CourseFallbackThumbnail';
import AtRiskPanel from '../components/AtRiskPanel';

const CAT_COLORS = {
  "Social Science": { main: "#F97316", dark: "#C2410C" }, 
  "Mathematics & Natural Science": { main: "#3B82F6", dark: "#1D4ED8" }, 
  "Natural Language": { main: "#A855F7", dark: "#7E22CE" }, 
  "Programming & Technology": { main: "#6366F1", dark: "#4338CA" }, 
  "Business & Entrepreneurship": { main: "#FFD700", dark: "#CA8A04" }, 
  "Personal Development": { main: "#22C55E", dark: "#15803D" }
};

const DEFAULT_COLOR = { main: "#3b82f6", dark: "#2563eb" };

const CAT_ICONS = {
  "Social Science": Globe,
  "Mathematics & Natural Science": Calculator,
  "Natural Language": BookOpen,
  "Programming & Technology": Rocket,
  "Business & Entrepreneurship": Target,
  "Personal Development": UserCheck,
  "General Overview": BookOpen
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

export default function AdminDashboard() {
  const isDarkMode = useThemeMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserPassword, setSelectedUserPassword] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedUserActivities, setSelectedUserActivities] = useState([]);
  const [selectedUserCourses, setSelectedUserCourses] = useState([]);
  const [recentFamilyActivity, setRecentFamilyActivity] = useState([]);
  const [childSearch, setChildSearch] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: stats, isLoading: loadingStats } = useDashboardStats();

  const { data: analytics } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: async () => { const { data } = await api.get('/admin/analytics/detailed'); return data.data; }
  });

  const { data: usersList = [], refetch: fetchUsers } = useQuery({
    queryKey: ['adminUsersList'],
    queryFn: async () => { const { data } = await api.get('/admin/users'); return data.data || []; }
  });

  const { data: pendingCourses = [], refetch: fetchPendingCourses } = useQuery({
    queryKey: ['adminPendingCourses'],
    queryFn: async () => { const { data } = await api.get('/admin/courses/pending'); return data.data || []; }
  });

  const { data: pendingEnrollments = [], refetch: fetchPendingEnrollments } = useQuery({
    queryKey: ['adminPendingEnrollments'],
    queryFn: async () => { const { data } = await api.get('/admin/enrollments/pending'); return data.data || []; }
  });

  const { data: allCourses = [], refetch: fetchAllCourses } = useQuery({
    queryKey: ['adminAllCourses'],
    queryFn: async () => { const { data } = await api.get('/courses?limit=100'); return data.courses || []; }
  });

  const { data: agendaEvents = [], refetch: fetchAgendaEvents } = useQuery({
    queryKey: ['adminAgendaEvents'],
    queryFn: async () => { const { data } = await api.get('/calendar'); return Array.isArray(data.data) ? data.data : []; }
  });

  const loading = loadingStats;

  const updateRole = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const updateUserStatus = async (userId, status) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user status', err);
    }
  };

  const assignInstructor = async (studentId, instructorId) => {
    if (!instructorId) return;
    try {
      await api.put(`/admin/student/${studentId}/assign`, { instructorId });
      fetchUsers();
    } catch (err) {
      console.error('Failed to assign instructor', err);
    }
  };

  const fetchUserActivities = useCallback(async (userId, role = '', children = []) => {
    try {
      const { data } = await api.get('/activity/all', { params: { limit: 40 } });
      const allActivities = Array.isArray(data.data) ? data.data : [];
      const userActivity = allActivities.filter((a) => {
        const ownerId = a.user?.id || a.user;
        return String(ownerId) === String(userId);
      }).slice(0, 40);
      setSelectedUserActivities(userActivity);

      if (role === 'parent' && children.length > 0) {
        const childIds = children.map((c) => String(c.id || c));
        const familyActivity = allActivities.filter((a) => childIds.includes(String(a.user?.id || a.user))).slice(0, 40);
        setRecentFamilyActivity(familyActivity);
      } else {
        setRecentFamilyActivity([]);
      }
    } catch (err) {
      console.error('Failed to fetch user activities', err);
      setSelectedUserActivities([]);
      setRecentFamilyActivity([]);
    }
  }, []);

  const openManagePanel = async (userId) => {
    try {
      const { data } = await api.get(`/admin/users/${userId}`);
      const user = data.data;
      setSelectedUser(user);
      setSelectedUserPassword('');
      setManageOpen(true);
      setChildSearch('');
      setSelectedChildId('');

      if (user) {
        await fetchUserActivities(userId, user.role, user.children || []);
        const userCourses = allCourses.filter((c) => String(c.instructor?.id || c.instructor) === String(userId));
        setSelectedUserCourses(userCourses);
      }
    } catch (err) {
      console.error('Failed to open manage panel', err);
    }
  };

  const closeManagePanel = () => {
    setSelectedUser(null);
    setManageOpen(false);
    setChildSearch('');
    setSelectedChildId('');
  };

  const saveUserUpdates = async () => {
    if (!selectedUser) return;
    try {
      const payload = {
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
        bio: selectedUser.bio,
        paymentStatus: selectedUser.paymentStatus,
        outstandingBalance: selectedUser.outstandingBalance,
        status: selectedUser.status
      };
      if (selectedUserPassword && selectedUserPassword.length >= 6) {
        payload.password = selectedUserPassword;
      }
      await api.put(`/admin/users/${selectedUser.id}`, payload);
      await fetchUsers();
      setManageOpen(false);
    } catch (err) {
      console.error('Failed to save user updates', err);
    }
  };

  const deleteAdminUser = async (userId) => {
    if (!window.confirm('This will permanently delete user and all associations. Continue?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
      if (selectedUser && selectedUser.id === userId) closeManagePanel();
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const addChildToParent = async (childId) => {
    if (!selectedUser || selectedUser.role !== 'parent' || !childId) return;
    try {
      await api.put(`/admin/users/${selectedUser.id}/link-child`, { childId });
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      setSelectedUser(data.data);
    } catch (err) {
      console.error('Failed to link child', err);
    }
  };

  const removeChildFromParent = async (childId) => {
    if (!selectedUser || selectedUser.role !== 'parent' || !childId) return;
    try {
      await api.put(`/admin/users/${selectedUser.id}/unlink-child`, { childId });
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      setSelectedUser(data.data);
    } catch (err) {
      console.error('Failed to unlink child', err);
    }
  };

  const manualEnrollment = async (courseId, status = 'active') => {
    if (!selectedUser || selectedUser.role !== 'student' || !courseId) return;
    try {
      await api.post('/admin/enrollments/manual', { studentId: selectedUser.id, courseId, status });
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      setSelectedUser(data.data);
      fetchUsers();
    } catch (err) {
      console.error('Failed to set manual enrollment', err);
    }
  };

  const removeEnrollment = async (courseId) => {
    if (!selectedUser || !courseId) return;
    try {
      await api.delete('/admin/enrollments', { data: { studentId: selectedUser.id, courseId } });
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      setSelectedUser(data.data);
      fetchUsers();
    } catch (err) {
      console.error('Failed to remove enrollment', err);
    }
  };

  const resetUserProgress = async () => {
    if (!selectedUser) return;
    try {
      await api.put(`/admin/users/${selectedUser.id}/reset-progress`);
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      setSelectedUser(data.data);
      await fetchUserActivities(selectedUser.id, selectedUser.role, data.data.children || []);
      fetchUsers();
    } catch (err) {
      console.error('Failed to reset progress', err);
    }
  };

  const blockService = async () => {
    if (!selectedUser) return;
    await updateUserStatus(selectedUser.id, 'blocked');
    await openManagePanel(selectedUser.id);
  };

  const toggleInstructorAccess = async () => {
    if (!selectedUser) return;
    const targetStatus = selectedUser.status === 'approved' ? 'rejected' : 'approved';
    await updateUserStatus(selectedUser.id, targetStatus);
    const { data } = await api.get(`/admin/users/${selectedUser.id}`);
    setSelectedUser(data.data);
  };

  const filterCandidates = React.useCallback(() => {
    if (!childSearch.trim()) return [];
    const lowercase = childSearch.toLowerCase();
    return usersList.filter((u) => u.role === 'student' && u.name.toLowerCase().includes(lowercase) && !(selectedUser?.children || []).some(c => c.id === u.id));
  }, [childSearch, usersList, selectedUser]);

  const updateCourseStatus = async (courseId, status) => {
    try {
      await api.put(`/admin/courses/${courseId}/status`, { status });
      fetchPendingCourses();
    } catch (err) {
      console.error('Failed to update course', err);
    }
  };

  const handleEnrollmentApproval = async (enrollmentId, status) => {
    try {
      if (status === 'active' || status === 'approved') {
        if (!window.confirm('Are you sure you want to approve this enrollment?')) return;
        await api.post(`/admin/enrollments/${enrollmentId}/approve`);
      } else {
        const rejectionReason = window.prompt('Please enter a rejection reason:', 'Rejected by admin');
        if (rejectionReason === null) return; // User cancelled prompt
        await api.post(`/admin/enrollments/${enrollmentId}/reject`, {
          rejectionReason: rejectionReason.trim() || 'Rejected by admin'
        });
      }
      fetchPendingEnrollments();
      fetchUsers();
    } catch (err) {
      console.error('Failed to update enrollment', err);
      alert('Failed to update enrollment status');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleAgendaCreated = (evt) => {
    queryClient.setQueryData(['adminAgendaEvents'], (old) => {
       const newList = old ? [...old, evt] : [evt];
       return newList.sort((a, b) => new Date(a.date) - new Date(b.date));
    });
  };

  const deleteAgenda = async (agendaId) => {
    try {
      await api.delete(`/calendar/${agendaId}`);
      queryClient.setQueryData(['adminAgendaEvents'], (old) => (old ? old.filter((item) => item.id !== agendaId) : []));
    } catch (err) {
      console.error('Failed to delete agenda', err);
    }
  };

  const getStatusBadgeClasses = (status) => {
    if (status === 'approved') return 'bg-emerald-500/100/20 text-emerald-300 border border-emerald-300';
    if (status === 'pending') return 'bg-[#00D4FF]/100/20 text-amber-300 border border-amber-300';
    if (status === 'rejected') return 'bg-rose-500/100/20 text-rose-300 border border-rose-300';
    if (status === 'blocked') return 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]';
    return 'bg-[#0B1120]/40 backdrop-blur-xl0/20 text-slate-200 border border-slate-400';
  };

  const selectedUserCompletion = React.useMemo(() => {
    return selectedUser?.enrolledCourses?.length ? Math.round(selectedUser.enrolledCourses.reduce((acc, ec) => acc + (ec.progress || 0), 0) / selectedUser.enrolledCourses.length) : 0;
  }, [selectedUser]);

  const instructorsCount = React.useMemo(() => usersList.filter(u => u.role === 'instructor').length, [usersList]);

  const instructorOptions = React.useMemo(() => {
    return usersList.filter(user => user.role === 'instructor').map(inst => ({
      label: inst.name,
      value: inst.id,
      render: (
        <div className="flex items-center gap-3 w-full py-0.5">
          <div className="w-8 h-8 rounded-full bg-[#00D4FF]/20 text-[#00D4FF] flex items-center justify-center font-bold text-xs shrink-0 border border-[#00D4FF]/30 shadow-sm ">
              {inst.name ? inst.name.charAt(0) : '?'}
          </div>
          <div className="flex flex-col text-left flex-1 min-w-0">
            <span className={`font-bold text-xs truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{inst.name}</span>
            <span className={`text-[10px] truncate mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{inst.email}</span>
          </div>
        </div>
      )
    }));
  }, [usersList]);

  const renderContent = () => {

    switch (activeTab) {
      case 'overview': {
        const revenueData = React.useMemo(() => stats?.analytics?.revenueData || [], [stats]);
        const userDistributionData = React.useMemo(() => stats?.analytics?.userDistribution || [
          { name: 'Students', value: stats?.dashboardStats?.totalStudents || 0, color: '#3b82f6' },
          { name: 'Instructors', value: stats?.dashboardStats?.totalInstructors || 0, color: '#a855f7' },
          { name: 'Admins', value: (user?.role === 'admin' ? 1 : 0), color: '#ef4444' }, // Just an estimate fallback if explicit admin count wasn't fetched
        ], [stats, user]);
        
        return (
          <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen -mx-4 md:-mx-8 lg:-mx-12 -mt-4 md:-mt-8 p-6 md:p-10">
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 rounded-[32px] transition-all duration-300 ${isDarkMode ? 'border-white/10 bg-[#0B1120]/90 shadow-[0_20px_60px_rgba(0,0,0,0.55)]' : 'border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.12)]'}`}>
              <div>
                <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <Activity className="w-8 h-8 text-[#00D4FF]" />
                  Admin Overview
                  {loading && <div className={`w-5 h-5 border-2 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'} ml-3`}></div>}
                </h1>
                <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Comprehensive summary of platform metrics and activities.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Users Card */}
              <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center gap-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                {/* Icon (centered top) */}
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center bg-transparent relative z-10 ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <Users className="w-6 h-6" />
                </div>
                {/* Content (centered) */}
                <div className="flex flex-col items-center relative z-10 w-full">
                  <p className="text-sm font-medium text-gray-500 mb-1.5">Total Users</p>
                  <h3 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.dashboardStats?.totalUsers ?? 0}</h3>
                </div>
              </div>

              {/* Pending Users Card */}
              <div className={`p-6 rounded-[24px] border border-rose-200/50 glass-panel shadow-lg relative overflow-hidden group hover:border-rose-300 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center gap-3`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                {/* Icon (centered top) */}
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center bg-transparent relative z-10 ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <UserPlus className="w-6 h-6" />
                </div>
                {/* Content (centered) */}
                <div className="flex flex-col items-center relative z-10 w-full">
                  <p className="text-sm font-medium text-gray-500 mb-1.5">Pending Users</p>
                  <h3 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.dashboardStats?.pendingUsers || 0}</h3>
                </div>
              </div>

              {/* Instructors Card */}
              <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center gap-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                {/* Icon (centered top) */}
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center bg-transparent relative z-10 ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <UserCog className="w-6 h-6" />
                </div>
                {/* Content (centered) */}
                <div className="flex flex-col items-center relative z-10 w-full">
                  <p className="text-sm font-medium text-gray-500 mb-1.5">Instructors</p>
                  <h3 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.dashboardStats?.totalInstructors ?? 0}</h3>
                </div>
              </div>

              {/* Pending Approvals Card */}
              <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center gap-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D4FF]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                {/* Icon (centered top) */}
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center bg-transparent relative z-10 ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                {/* Content (centered) */}
                <div className="flex flex-col items-center relative z-10 w-full">
                  <p className="text-sm font-medium text-gray-500 mb-1.5">Pending Approvals</p>
                  <h3 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats?.dashboardStats?.pendingApprovals ?? 0}</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Revenue Overview (YTD)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value}`} dx={-10} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`$${value}`, 'Revenue']}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>User Distribution</h3>
                <div className="h-[300px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {userDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className={`p-6 lg:p-8 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
               <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                 <Layers className="w-5 h-5 text-[#2563EB]" /> Quick Actions
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <button 
                  onClick={() => setActiveTab('users')} 
                  className={`flex items-center gap-3 p-4 rounded-xl border hover:border-blue-300 hover:bg-blue-500/10 hover:text-blue-700 transition-colors text-left group ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                 >
                   <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                     <Users className="w-5 h-5" />
                   </div>
                   <div>
                     <span className="block font-semibold">Manage Users</span>
                     <span className={`text-sm group-hover:text-blue-600 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{stats?.pendingUsers > 0 ? <span className="text-rose-500 font-bold">{stats.pendingUsers} awaiting approval</span> : 'Change roles, verify status'}</span>
                   </div>
                 </button>
                 <button 
                  onClick={() => setActiveTab('courses')} 
                  className={`flex items-center gap-3 p-4 rounded-xl border hover:border-amber-300 hover:bg-[#00D4FF]/10 hover:text-amber-700 transition-colors text-left group ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                 >
                   <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                     <BookOpen className="w-5 h-5" />
                   </div>
                   <div>
                     <span className="block font-semibold">Review Courses</span>
                     <span className={`text-sm group-hover:text-amber-600 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{stats?.pendingCourses ?? 0} awaiting approval</span>
                   </div>
                 </button>
                 <button 
                  onClick={() => navigate('/dashboard/sections')} 
                  className={`flex items-center gap-3 p-4 rounded-xl border hover:border-purple-300 hover:bg-purple-500/10 hover:text-purple-700 transition-colors text-left group ${isDarkMode ? 'border-white/10' : 'border-slate-200'} sm:col-span-2`}
                 >
                   <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                     <Users className="w-5 h-5" />
                   </div>
                   <div>
                     <span className="block font-semibold">Sections & Groups</span>
                     <span className={`text-sm group-hover:text-purple-600 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Manage cohorts and categories</span>
                   </div>
                 </button>
                 <button 
                  onClick={() => setActiveTab('fees')} 
                  className={`flex items-center gap-3 p-4 rounded-xl border hover:border-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-700 transition-colors text-left group ${isDarkMode ? 'border-white/10' : 'border-slate-200'} sm:col-span-2`}
                 >
                   <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                     <CircleDollarSign className="w-5 h-5" />
                   </div>
                   <div>
                     <span className="block font-semibold">Finance & Fees</span>
                     <span className={`text-sm group-hover:text-emerald-600 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Review gross computations & ledger</span>
                   </div>
                 </button>
                 <button 
                  onClick={() => setActiveTab('expenses')} 
                  className={`flex items-center gap-3 p-4 rounded-xl border hover:border-rose-300 hover:bg-rose-500/10 hover:text-rose-700 transition-colors text-left group ${isDarkMode ? 'border-white/10' : 'border-slate-200'} sm:col-span-2`}
                 >
                   <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                     <ArrowDownRight className="w-5 h-5" />
                   </div>
                   <div>
                     <span className="block font-semibold">Operating Expenses</span>
                     <span className={`text-sm group-hover:text-rose-600 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Manage outbound capital & payouts</span>
                   </div>
                 </button>
               </div>
            </div>

            <div className={`p-6 lg:p-8 rounded-[24px] border glass-panel shadow-lg mt-8 relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-bl-full -z-10"></div>
               <div className="flex justify-between items-center mb-6">
                 <h3 className={`text-xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                   <Activity className="w-5 h-5 text-indigo-500" /> Intervention Overview
                 </h3>
                 <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md  ">Live Support Monitor</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <div className={`p-4 rounded-xl border bg-transparent flex items-center gap-5 hover:shadow-sm transition-shadow ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                   <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                     <MessageSquare className="w-6 h-6"/>
                   </div>
                   <div>
                     <p className={`text-[13px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Active Parent Chats</p>
                     <h4 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>12</h4>
                   </div>
                 </div>
                 <div className={`p-4 rounded-xl border bg-rose-500/10 flex items-center gap-5 hover:shadow-sm transition-shadow ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                   <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                     <AlertTriangle className="w-6 h-6"/>
                   </div>
                   <div>
                     <p className="text-[13px] text-rose-500 font-bold   mb-1">Pending Flags</p>
                     <h4 className="text-3xl font-black text-rose-900">3</h4>
                   </div>
                 </div>
                 <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-500/10 flex items-center gap-5 hover:shadow-sm transition-shadow">
                   <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                     <CheckCircle2 className="w-6 h-6"/>
                   </div>
                   <div>
                     <p className="text-[13px] text-emerald-600 font-bold mb-1">Resolved Cases</p>
                     <h4 className="text-3xl font-black text-emerald-900">45</h4>
                   </div>
                 </div>
               </div>
            </div>

            <div className="mt-8">
              <AtRiskPanel isDarkMode={isDarkMode} />
            </div>

            <div className="mt-8">
               <AgendaWidget 
                 events={agendaEvents} 
                 userRole="admin" 
                 isAdmin={true} 
                 onDelete={deleteAgenda} 
                 onCreateClick={() => setShowAgendaModal(true)} 
               />
            </div>

            <AgendaCreationModal
              isOpen={showAgendaModal}
              onClose={() => setShowAgendaModal(false)}
              onAgendaCreated={(evt) => { handleAgendaCreated(evt); setShowAgendaModal(false); }}
            />

          </div>
        );
      }
      case 'users':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className={`text-2xl font-display font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                User Management
                {loading && <div className={`w-5 h-5 border-2 border-t-red-500 rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>}
              </h2>
              <div className={`px-4 py-2 rounded-lg border text-sm font-medium shadow-sm flex items-center gap-2 ${isDarkMode ? 'bg-[#0B1120] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Super Admin Access
              </div>
            </div>
            
            <div className={`rounded-[24px] border glass-panel shadow-lg overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className={`bg-transparent border-b text-sm font-semibold ${isDarkMode ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-500'}`}>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 text-center">Certificates</th>
                      <th className="px-6 py-4">Assign Instructor</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-sm font-normal">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-transparent/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full backdrop-blur-xl flex flex-shrink-0 items-center justify-center font-bold text-xs ${isDarkMode ? 'bg-[#0B1120]/5 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{u.name}</span>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{u.email}</td>
                        <td className={`px-6 py-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{new Date(u.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td className="px-6 py-4">
                          {u.status === 'pending' ? (
                            <div className="flex gap-2 relative z-10 w-max">
                               <button onClick={() => updateUserStatus(u.id, 'approved')} className="text-xs font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors shadow-sm">Approve</button>
                               <button onClick={() => updateUserStatus(u.id, 'rejected')} className="text-xs font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors shadow-sm">Reject</button>
                            </div>
                          ) : (
                            <span className={`inline-flex w-max items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold   border ${
                              u.status === 'approved' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' : 
                              u.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
                              'bg-transparent text-slate-200 border-white/10'
                            }`}>
                              {u.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : u.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> : null}
                              {u.status}
                            </span>
                          )}
                        </td>
                          {u.id === user?.id ? (
                            <div className="opacity-50 cursor-not-allowed">
                               <CustomDropdown value={u.role} onChange={() => {}} options={[{ label: u.role, value: u.role }]} />
                            </div>
                          ) : (
                            <CustomDropdown 
                              value={u.role} 
                              onChange={(val) => updateRole(u.id, val)}
                              options={[
                                { label: 'Student', value: 'student' },
                                { label: 'Instructor', value: 'instructor' },
                                { label: 'Admin', value: 'admin' }
                              ]}
                              className="w-32"
                            />
                          )}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center items-center">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-xs font-bold shadow-sm ${u.certificates && u.certificates.length > 0 ? 'bg-orange-100 text-orange-600 dark:bg-[#00D4FF]/20 dark:text-orange-400 border border-orange-200 dark:border-[#00D4FF]/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700'}`}>
                              {u.certificates ? u.certificates.length : 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           {u.role === 'student' ? (
                              <CustomDropdown 
                                value={u.assignedInstructor?.id || u.assignedInstructor || ''}
                                onChange={(val) => assignInstructor(u.id, val)}
                                options={instructorOptions}
                                placeholder="Select Inst..."
                                searchable={true}
                                className="w-44"
                              />
                           ) : (
                             <span className={`text-sm italic ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>N/A</span>
                           )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className={`px-3 py-1.5 rounded-full border text-sm font-semibold flex items-center gap-1 bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            onClick={() => openManagePanel(u.id)}
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'courses':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-display font-bold flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Course Approvals
                {loading && <div className={`w-5 h-5 border-2 border-t-red-500 rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>}
              </h2>
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full  ">
                {stats?.pendingCourses ?? 0} Pending
              </span>
            </div>

            {pendingCourses.length === 0 ? (
               <div className={`p-12 text-center rounded-[24px] border glass-panel shadow-lg flex flex-col items-center justify-center relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                 <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                   <CheckCircle2 className="w-10 h-10" />
                 </div>
                 <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>All Caught Up!</h3>
                 <p className={`max-w-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>There are no pending courses awaiting your review. Check back later.</p>
               </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                   {pendingCourses.map(c => {
                    const normalized = normalizeCategory(c.mainCategory || c.category);
                    const catInfo = CAT_COLORS[normalized] || DEFAULT_COLOR;
                    const IconComponent = CAT_ICONS[normalized] || BookOpen;
                    return (
                      <div key={c.id} className={`rounded-[24px] border glass-panel shadow-lg overflow-hidden flex flex-col md:flex-row group hover:-translate-y-1 transition-all duration-300 relative ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                           style={{ borderTopColor: catInfo.main, borderTopWidth: '4px' }}>
                        
                        <div 
                          className="w-full md:w-64 h-48 md:h-auto shrink-0 relative flex items-center justify-center overflow-hidden bg-[#030303]"
                        >
                          {c.thumbnail && c.thumbnail !== 'default-course.jpg' ? (
                            <img 
                              src={c.thumbnail} 
                              alt={c.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                          ) : (
                            <CourseFallbackThumbnail 
                              color={catInfo.main} 
                              darkColor={catInfo.dark || catInfo.main} 
                              ribbon={c.mainCategory} 
                              fallbackId={c.id} 
                            />
                          )}

                          {/* Status Badge in lowercase pill border shape */}
                          <div className="absolute top-4 right-4 z-20">
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-normal text-white border border-white/40 bg-white/10 backdrop-blur-md">
                              {(c.status || 'pending').toLowerCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-6 md:p-8 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-2 gap-4">
                            <h3 className={`text-xl font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`} style={{ color: catInfo.main }}>{c.title}</h3>
                          <span className="shrink-0 flex items-center gap-1.5 bg-[#00D4FF]/10 text-amber-700 px-3 py-1 rounded-full text-xs font-bold   border border-amber-200">
                             <Clock className="w-3 h-3" /> Pending Review
                          </span>
                        </div>
                        
                        <p className={`text-sm mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                          <span className="flex items-center gap-1"><UserCog className="w-4 h-4" /> Instructor: <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{c.instructor?.name || 'Unknown'}</span></span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>•</span>
                          <span>{c.duration} hours</span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>•</span>
                          <span>{c.lessons?.length || 0} lessons</span>
                        </p>
                        
                        <p className={`mb-6 flex-1 line-clamp-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{c.description}</p>
                        
                        <div className={`flex flex-col sm:flex-row gap-3 pt-4 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                           <button 
                            onClick={() => updateCourseStatus(c.id, 'approved')} 
                            className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 font-semibold rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                           >
                             <Check className="w-5 h-5" /> Approve & Publish
                           </button>
                           <button 
                            onClick={() => updateCourseStatus(c.id, 'rejected')} 
                            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-red-600 font-semibold rounded-xl border border-red-200 hover:bg-red-50 hover:-translate-y-0.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}
                           >
                             <XCircle className="w-5 h-5" /> Reject
                           </button>
                         </div>
                       </div>
                     </div>
                    );
                  })}
                </div>
            )}

            <div className={`mt-8 p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Enrollment Approval Queue</h3>
                <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{stats?.pendingEnrollments ?? 0} pending</span>
              </div>
              {!pendingEnrollments.length ? (
                <p className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>No pending enrollment requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingEnrollments.map((req) => (
                    <div key={req.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      <div>
                        <p><span className="font-semibold">Student:</span> {req.studentName} ({req.studentEmail})</p>
                        <p><span className="font-semibold">Course:</span> {req.courseTitle}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Requested at: {new Date(req.requestedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEnrollmentApproval(req.id, 'active')} className={`px-3 py-1.5 bg-emerald-600 rounded-lg text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Approve</button>
                        <button onClick={() => handleEnrollmentApproval(req.id, 'rejected')} className={`px-3 py-1.5 bg-rose-500/100 rounded-lg text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'fees':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <FinanceFees />
          </div>
        );
      case 'expenses':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <FinanceExpenses />
          </div>
        );
      case 'logs':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className={`text-2xl font-display font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>System Logs</h2>
            <div className={`p-6 rounded-[24px] border glass-panel shadow-lg relative overflow-hidden ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex justify-between items-center mb-6">
                  <span className={`font-semibold flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}><Activity className="w-5 h-5" /> All Platform Activity</span>
                  <button className={`text-sm font-semibold px-3 py-1.5 rounded-full transition-colors bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Export CSV</button>
                </div>
                <ActivityFeed isAdmin={true} limit={20} />
            </div>
          </div>
        );
      case 'settings':
        return <ProfileView />;
      default:
        return null;
    }
  };

  const navItemClass = (tabName) => `
    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm text-left
    ${activeTab === tabName 
      ? 'bg-[#0B1120] text-white shadow-sm' 
      : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white'
    }
  `;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0B1120]' : 'bg-[#FAFAFA]'} flex flex-col md:flex-row font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>


      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
        <div className="max-w-none w-full relative">
          
          {/* Top Header mapped from image requirements */}
          <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 w-full">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Global Search (Students, Courses, Messages)..." 
                className={`w-full pl-10 pr-20 py-2.5 border rounded-full text-xs outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-slate-500 shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-white/5 text-white' : 'bg-white border-slate-100 text-slate-900'}`} />
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 bg-[#1A1E26] text-[9px] px-2 py-1 rounded font-bold border ${isDarkMode ? 'text-slate-400 border-white/5' : 'text-slate-500 border-slate-100'}`}>
                CTRL + K
              </div>
            </div>
            
            <div className="flex items-center gap-6 w-full sm:w-auto justify-end">
              <div className="relative cursor-pointer hover:bg-white/5 p-2 rounded-full transition-colors">
                <Bell className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                <span className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#E30A17] rounded-full border-2 border-[#0B1120] text-[7px] flex items-center justify-center font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>1</span>
              </div>
              
              <div className="flex items-center gap-3 cursor-pointer p-1 pr-3 rounded-full hover:bg-white/5 transition-colors">
                 <div className="w-9 h-9 rounded-full bg-white text-[#0B1120] font-black flex items-center justify-center shadow-sm">
                   {user?.name?.charAt(0) || 'A'}
                 </div>
                 <div className="text-left hidden sm:block">
                   <div className={`text-sm font-bold leading-none mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user?.name || 'Administrator'}</div>
                   <div className={`text-[11px] font-medium leading-none capitalize ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{user?.role || 'Administrator'}</div>
                 </div>
              </div>
            </div>
          </header>

          {renderContent()}
        </div>

        <PremiumModal isOpen={manageOpen && !!selectedUser} onClose={closeManagePanel} maxWidth="max-w-6xl">
                 <div className="flex flex-col w-full h-full p-6 md:p-8">
                {/* Brand Background Decorative Elements */}
                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#00D4FF]/10 to-transparent pointer-events-none z-0"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00D4FF]/20 blur-[80px] pointer-events-none z-0"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00D4FF]/20 blur-[80px] pointer-events-none z-0"></div>

                <div className="flex justify-between items-start gap-4 mb-5 relative z-10 w-full">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border border-[#00D4FF] bg-gradient-to-br from-slate-700 via-slate-800 to-slate-600 overflow-hidden shadow-lg">
                      <img
                        src={selectedUser.avatar?.startsWith('http') ? selectedUser.avatar : selectedUser.avatar ? `/uploads/${selectedUser.avatar}` : 'https://via.placeholder.com/150'}
                        alt={selectedUser.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUser.name}</h3>
                      <p className="text-sm font-semibold   text-indigo-200">{selectedUser.role || 'Unknown Role'}</p>
                      <span className={`inline-flex items-center px-3 py-1.5 mt-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(selectedUser.status)}`}>
                        {selectedUser.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  <button onClick={closeManagePanel} className={`text-sm hover:text-white ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Close</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                  <div className={`p-4 rounded-[24px] border glass-panel shadow-lg bg-black/40 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Relationship Map</h4>
                    {selectedUser.role === 'student' && (
                      <div className="space-y-2">
                        <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Assigned Instructor</p>
                        {selectedUser.assignedInstructor ? (
                          <button onClick={() => openManagePanel(selectedUser.assignedInstructor.id)} className="text-sm font-semibold text-emerald-200 hover:text-emerald-100 transition-colors underline decoration-dashed">
                            {selectedUser.assignedInstructor.name}
                          </button>
                        ) : (
                          <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Unassigned</p>
                        )}

                        <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Linked Parents</p>
                        <div className="flex flex-wrap gap-2">
                          {(selectedUser.parents || []).length > 0 ?
                            selectedUser.parents.map((parent) => (
                              <button
                                key={parent.id}
                                onClick={() => openManagePanel(parent.id)}
                                className="px-2 py-1 text-xs font-semibold text-[#0B1120] bg-[#00D4FF] rounded-full hover:bg-cyan-400 transition-colors"
                              >
                                {parent.name}
                              </button>
                            )) : <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No parents connected</p>
                          }
                        </div>
                      </div>
                    )}
                    {selectedUser.role === 'instructor' && (
                      <div className="space-y-2">
                        <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Active Students</p>
                        <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUser.assignedStudents?.length || 0}</p>
                      </div>
                    )}
                    {selectedUser.role === 'parent' && (
                      <div className="space-y-2">
                        <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Watching Learners</p>
                        {(selectedUser.children || []).length > 0 ?
                          selectedUser.children.map((c) => (
                            <p key={c.id} className="text-sm text-emerald-200">{c.name}</p>
                          )) : <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No current children linked</p>
                        }
                      </div>
                    )}
                  </div>

                  <div className={`p-4 rounded-[24px] border glass-panel shadow-lg bg-black/40 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Activity Matrix (Recent)</h4>
                    <div className="max-h-48 overflow-auto space-y-2">
                      {(selectedUserActivities.length > 0) ? selectedUserActivities.map((activity) => (
                        <div key={activity.id} className="rounded-lg border border-slate-700 bg-[#0B1120]/70 p-2 text-xs">
                          <div className="flex justify-between items-start">
                             <p className={isDarkMode ? 'text-slate-200' : 'text-slate-600'}>{activity.action}</p>
                             {activity.metadata?.ip && <span className={`text-[9px] font-mono tracking-tighter bg-black/50 px-1 rounded ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{activity.metadata.ip}</span>}
                          </div>
                          <p className={`mt-0.5 text-[11px] ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{activity.type || 'action'} • {new Date(activity.createdAt).toLocaleString()} {activity.metadata?.userAgent?.includes('Mobi') ? '📱' : '💻'}</p>
                        </div>
                      )) : <p className={`text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No recent activity recorded.</p>}
                    </div>
                  </div>

                  <div className={`p-4 rounded-[24px] border glass-panel shadow-lg bg-black/40 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Extended Insights</h4>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className={`text-[10px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Total courses / Active Classes</p>
                        <p className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(selectedUser.role === 'student' ? (selectedUser.enrolledCourses || []).filter(en => en.status === 'active') : selectedUser.role === 'instructor' ? (selectedUser.taughtCourses || []).filter(c => c.status === 'approved') : []).length}</p>
                        <div className="flex flex-col gap-1 max-h-24 overflow-auto custom-scrollbar pr-2">
                           {selectedUser.role === 'student' ? (
                              (selectedUser.enrolledCourses || []).filter(en => en.status === 'active').map((en, idx) => (
                                 <div key={idx} className={`flex justify-between items-center bg-black/40 px-2 py-1.5 rounded-lg border ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                    <span className={`text-xs font-medium truncate mr-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{en.course?.title || 'Unknown Course'}</span>
                                    <span className="text-[9px] text-emerald-400 font-bold shrink-0">Active</span>
                                 </div>
                              ))
                           ) : (selectedUser.role === 'instructor') ? (
                              (selectedUser.taughtCourses || []).filter(c => c.status === 'approved').map((c, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-black/40 px-2 py-1.5 rounded-lg border border-emerald-500/10">
                                    <span className={`text-xs font-medium truncate mr-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.title}</span>
                                    <span className="text-[9px] font-bold shrink-0 text-emerald-400">Active</span>
                                 </div>
                              ))
                           ) : null}
                        </div>
                      </div>
                      
                      {(selectedUser.role === 'student' || selectedUser.role === 'parent' || selectedUser.role === 'instructor') && (
                      <div>
                        <p className={`text-[10px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Pending approvals</p>
                        <p className="text-xl font-bold text-rose-300 mb-2">{selectedUser.role === 'instructor' ? (selectedUser.taughtCourses || []).filter(c => c.status === 'pending').length : (selectedUser.enrolledCourses || []).filter((en) => en.status === 'pending').length}</p>
                        <div className="flex flex-col gap-1 max-h-24 overflow-auto custom-scrollbar pr-2">
                           {selectedUser.role === 'student' ? (
                               (selectedUser.enrolledCourses || []).filter(en => en.status === 'pending').map((en, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-rose-500/100/10 px-2 py-1.5 rounded-lg border border-rose-500/20">
                                    <span className="text-xs text-rose-200 font-medium truncate mr-2">{en.course?.title || 'Unknown Course'}</span>
                                    <span className="text-[9px] text-rose-400 font-bold shrink-0">Pending</span>
                                 </div>
                               ))
                           ) : selectedUser.role === 'instructor' ? (
                              (selectedUser.taughtCourses || []).filter(c => c.status === 'pending').map((c, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-[#00D4FF]/100/10 px-2 py-1.5 rounded-lg border border-[#00D4FF]/20">
                                    <span className="text-xs text-amber-200 font-medium truncate mr-2">{c.title}</span>
                                    <span className="text-[9px] font-bold shrink-0 text-amber-400">Needs Review</span>
                                 </div>
                              ))
                           ) : null}
                        </div>
                      </div>
                      )}

                      <div>
                        <p className={`text-[10px] font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Last activity</p>
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{selectedUserActivities[0] ? new Date(selectedUserActivities[0].createdAt).toLocaleString() : 'Never logged in'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-[24px] border glass-panel bg-black/40 shadow-lg ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Performance Snapshot</h4>
                    <div className="flex items-center justify-center mb-3">
                      <RadialBarChart width={200} height={200} cx="50%" cy="50%" innerRadius="62%" outerRadius="100%" barSize={12} data={[{ name: 'Progress', value: selectedUserCompletion, fill: '#00D4FF' }]}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background clockWise dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
                    </div>
                    <p className="text-center text-sm text-emerald-200 font-semibold">Average progress: {selectedUserCompletion}%</p>
                  </div>

                  <div className={`p-4 rounded-[24px] border glass-panel bg-black/40 shadow-lg ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    {(selectedUser.role === 'student') ? (
                      <>
                        <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Student Dossier</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-auto">
                          {(selectedUser.enrolledCourses || []).map((en, idx) => {
                            const courseId = en.course?.id || en.course;
                            const courseTitle = en.course?.title || (allCourses.find((c) => c.id === courseId)?.title) || 'Unknown';
                            return (
                              <div key={`${courseId}_${idx}`} className="rounded-lg border border-slate-700 bg-[#0B1120]/70 p-2 flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-3">
                                  <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{courseTitle}</p>
                                  <button onClick={() => removeEnrollment(courseId)} className="text-[11px] text-rose-300 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Remove</button>
                                </div>
                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                  <div style={{ width: `${en.progress || 0}%`, backgroundColor: '#00D4FF' }} className="h-full rounded-full transition-all duration-700" aria-valuenow={en.progress || 0} aria-valuemin="0" aria-valuemax="100" />
                                </div>
                                <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Progress: {en.progress || 0}% • {en.status}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => manualEnrollment(allCourses[0]?.id || '', 'active')} className={`px-3 py-2 bg-blue-600 rounded-lg text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Force Enroll</button>
                          <button onClick={resetUserProgress} className={`px-3 py-2 rounded-full text-sm bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Reset Progress</button>
                          {selectedUser.status === 'blocked' ? (
                            <button onClick={async () => { await updateUserStatus(selectedUser.id, 'approved'); await openManagePanel(selectedUser.id); }} className={`px-3 py-2 bg-emerald-600 rounded-lg text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Unblock Service</button>
                          ) : (
                            <button onClick={blockService} className={`px-3 py-2 rounded-full text-sm bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Block Service</button>
                          )}
                        </div>
                      </>
                    ) : selectedUser.role === 'instructor' ? (
                      <>
                        <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Instructor Performance</h4>
                        <div className="space-y-2">
                          <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Content Portfolio: {selectedUserCourses.length} courses</p>
                          {(selectedUserCourses.length === 0) ? <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No created content yet</p> : selectedUserCourses.map((c) => (
                            <div key={c.id} className="text-xs text-emerald-200 border border-slate-700 p-2 rounded-lg">{c.title}, {(c.status || 'unknown')}</div>
                          ))}
                          <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Student Reach: {selectedUser.assignedStudents?.length || 0}</p>
                          <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Admin Feedback Log</p>
                          {(selectedUser.adminFeedback || []).length > 0 ? selectedUser.adminFeedback.map((f, index) => (
                            <p key={index} className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>• {f}</p>
                          )) : <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No feedback yet</p>}
                          <button onClick={toggleInstructorAccess} className={`px-3 py-2 rounded-full text-sm bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUser.status === 'approved' ? 'Disable Upload/Edit' : 'Reactivate Instructor'}</button>
                        </div>
                      </>
                    ) : selectedUser.role === 'parent' ? (
                      <>
                        <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Guardian Insight</h4>
                        <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Linked Learners: {((selectedUser.children || []).length)}</p>
                        <div className="space-y-2">
                          {(selectedUser.children || []).length > 0 ?
                            selectedUser.children.map((c) => (
                              <div key={c.id} className="flex items-center justify-between px-2 py-1 bg-[#0B1120] rounded-lg">
                                <span className="text-xs text-emerald-200">{c.name}</span>
                                <button onClick={() => removeChildFromParent(c.id)} className="text-[10px] px-2 py-1 rounded bg-rose-600 hover:bg-rose-500/100">Remove</button>
                              </div>
                            )) : <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No current children linked</p>
                          }
                        </div>
                        <div className="mt-2">
                          <h5 className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Add/Remove Child</h5>
                          <div className="flex gap-2 mt-1">
                            <CustomDropdown 
                              value={selectedChildId} 
                              onChange={setSelectedChildId} 
                              options={filterCandidates().map(child => ({ 
                                label: child.name, 
                                value: child.id,
                                render: (
                                  <div className="flex items-center gap-3 w-full py-0.5">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/100/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30 shadow-sm ">
                                        {child.name ? child.name.charAt(0) : '?'}
                                    </div>
                                    <div className="flex flex-col text-left flex-1 min-w-0">
                                      <span className={`font-bold text-xs truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{child.name}</span>
                                      <span className={`text-[10px] truncate mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{child.email}</span>
                                    </div>
                                  </div>
                                )
                              }))}
                              placeholder="Select student"
                              searchable={true}
                              className="flex-1"
                            />
                            <button onClick={() => { if (selectedChildId) addChildToParent(selectedChildId); }} className={`px-2 py-1 bg-blue-600 rounded-lg text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add</button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <h5 className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Family Activity</h5>
                          <div className="max-h-28 overflow-auto space-y-1 mt-1">
                            {(recentFamilyActivity.length > 0) ? recentFamilyActivity.map((act) => (
                              <p key={act.id} className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{new Date(act.createdAt).toLocaleString()}, {act.action}</p>
                            )) : <p className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>No family insights yet</p>}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>General admin user info and can be managed in the profile panel below.</p>
                    )}
                  </div>
                </div>

                <div className={`mt-6 p-4 rounded-[24px] border glass-panel bg-black/40 shadow-lg ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                  <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Quick Admin Overrides</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Email</label>
                      <input
                        type="email"
                        value={selectedUser.email || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                        className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-black/60 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Role</label>
                      <CustomDropdown
                        value={selectedUser.role || ''}
                        onChange={(val) => setSelectedUser({ ...selectedUser, role: val })}
                        options={[
                          { label: 'Student', value: 'student' },
                          { label: 'Instructor', value: 'instructor' },
                          { label: 'Parent', value: 'parent' },
                          { label: 'Admin', value: 'admin' }
                        ]}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Password (min 6 chars)</label>
                      <input
                        type="password"
                        value={selectedUserPassword}
                        onChange={(e) => setSelectedUserPassword(e.target.value)}
                        placeholder="New password"
                        className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-black/60 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Account Status</label>
                      <CustomDropdown
                        value={selectedUser.status || ''}
                        onChange={(val) => setSelectedUser({ ...selectedUser, status: val })}
                        options={[
                          { label: 'Pending', value: 'pending' },
                          { label: 'Approved', value: 'approved' },
                          { label: 'Rejected', value: 'rejected' },
                          { label: 'Blocked', value: 'blocked' }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className={`mt-5 p-4 rounded-[24px] border glass-panel bg-black/40 shadow-lg grid grid-cols-1 md:grid-cols-2 gap-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                  <button onClick={saveUserUpdates} className={`px-4 py-2 rounded-full font-semibold text-sm bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Save changes</button>
                  <button onClick={() => deleteAdminUser(selectedUser.id)} className={`px-4 py-2 rounded-lg bg-rose-500/100 font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Delete user</button>
                </div>
                </div>
        </PremiumModal>
      </main>
    </div>
  );
}
