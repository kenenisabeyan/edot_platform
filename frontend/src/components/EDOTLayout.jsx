import React, { useState, useRef, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { 
  Home, 
  Users, 
  UserSquare, 
  ClipboardCheck, 
  Wallet, 
  BellRing, 
  CalendarDays, 
  BookOpen, 
  MessageSquare, 
  User, 
  Settings, 
  LogOut,
  ChevronDown,
  Search,
  Menu,
  X,
  Award,
  Plus,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  HeartHandshake,
  ShieldCheck,
  Target,
  Video,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import UserAvatar from './UserAvatar';
import CommandK from './CommandK';
const edotLogo = 'https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw';
import ThemeDropdown from './ThemeDropdown';

function NavItem({ item, metrics, role, sidebarCollapsed, onLinkClick, isDarkMode }) {
  let badgeCount = 0;
  let badgeColor = 'bg-blue-500/100 text-white';

  if (item.path.includes('/messages')) {
    badgeCount = metrics.unreadMessages;
  } else if (item.path.includes('/dashboard/users') && role === 'admin') {
    badgeCount = metrics.pendingUsers;
    badgeColor = 'bg-[#00D4FF] text-white';
  } else if (item.path.includes('/approvals')) {
    badgeCount = (metrics.pendingApprovals || 0) + (metrics.pendingEnrollments || 0);
    badgeColor = 'bg-[#00D4FF] text-white';
  } else if (item.path.includes('/my-courses')) {
    badgeCount = metrics.pendingCourses;
    badgeColor = 'bg-[#00D4FF]/100 text-white';
  } else if (item.path.includes('/certificates')) {
    if (metrics.readyToClaim > 0) {
      badgeCount = metrics.readyToClaim;
      badgeColor = 'bg-[#00D4FF]/100 text-white';
    } else if (metrics.newCertificates > 0) {
      badgeCount = metrics.newCertificates;
      badgeColor = 'bg-emerald-500/100 text-white';
    } else {
      badgeCount = metrics.totalCertificates;
      badgeColor = 'bg-slate-400/100 text-white';
    }
  }

  return (
    <NavLink
      to={item.path}
      end={item.exact}
      onClick={() => onLinkClick(false)}
      className={({ isActive }) =>
        `group relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 text-[13px] ${
          isActive
            ? isDarkMode 
              ? 'bg-[#22C55E]/10 text-[#22C55E] font-bold border-l-4 border-[#22C55E]' 
              : 'bg-[#EAF6ED] text-[#22C55E] font-bold border-l-4 border-[#22C55E]'
            : isDarkMode
              ? 'text-slate-400 font-semibold hover:bg-slate-800 hover:text-slate-200'
              : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      <div className="flex items-center gap-3">
        <item.icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110 duration-300" />
        {!sidebarCollapsed && <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.name}</span>}
      </div>
      {badgeCount > 0 && !sidebarCollapsed && (
        <span className={`${badgeColor} text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-in zoom-in duration-300`}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      {badgeCount > 0 && sidebarCollapsed && (
        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${badgeColor}`}></span>
      )}
    </NavLink>
  );
}

export default function EDOTLayout() {
  const isDarkMode = useThemeMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [financeOpen, setFinanceOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const quickActionsRef = useRef(null);
  
  // Live global search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  
  const { data: metricsData } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const { data } = await api.get('/users/dashboard-metrics');
      return data.success && data.metrics ? data.metrics : {
        unreadMessages: 0,
        pendingApprovals: 0,
        pendingCourses: 0,
        newCertificates: 0,
        totalCertificates: 0,
        readyToClaim: 0,
        pendingCertificateRequirements: 0,
        pendingUsers: 0
      };
    },
    refetchInterval: 30000,
    enabled: !!user
  });

  const metrics = metricsData || {
    unreadMessages: 0,
    pendingApprovals: 0,
    pendingCourses: 0,
    newCertificates: 0,
    totalCertificates: 0,
    readyToClaim: 0,
    pendingCertificateRequirements: 0,
    pendingUsers: 0
  };

  const handleClickOutside = (event) => {
    if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
      setProfileOpen(false);
    }
    if (quickActionsRef.current && !quickActionsRef.current.contains(event.target)) {
      setQuickActionsOpen(false);
    }
    if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
      setSearchOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced live search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      setSearchOpen(true);
      try {
        const { data } = await api.get(`/search/global?q=${encodeURIComponent(searchQuery)}`);
        if (data.success) {
          setSearchResults(data.data || []);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Close search on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const role = user?.role ? user.role.toLowerCase().trim() : 'student';
  const dashboardTitle =
    role === 'admin'
      ? 'Edot Admin Dashboard'
      : role === 'instructor'
      ? 'Edot Instructor Dashboard'
      : role === 'parent'
      ? 'Edot Parent Dashboard'
      : role === 'sponsor'
      ? 'Sponsor Dashboard'
      : 'Edot Student Dashboard';

  const roleNavConfig = {
    admin: {
      menu1: [
        { name: 'Dashboard', icon: Home, path: '/dashboard', exact: true },
        { name: 'Create Course', icon: BookOpen, path: '/dashboard/builder' },
        { name: 'Manage All Courses', icon: ClipboardCheck, path: '/dashboard/my-courses' },
        { name: 'Approvals', icon: ClipboardCheck, path: '/dashboard/approvals' },
        { name: 'All Users', icon: Users, path: '/dashboard/users' },
        { name: 'Teachers', icon: UserSquare, path: '/dashboard/teachers' },
        { name: 'Students', icon: Users, path: '/dashboard/students' },
        { name: 'Live Classes', icon: Video, path: '/dashboard/live-classes' },
        { name: 'Sections & Groups', icon: Users, path: '/dashboard/sections' },
        { name: 'Attendance', icon: ClipboardCheck, path: '/dashboard/attendance' },
      ],
      menu2: [
        { name: 'Notice', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Calendar', icon: CalendarDays, path: '/dashboard/calendar' },
        { name: 'Library', icon: BookOpen, path: '/dashboard/library' },
        { name: 'Message', icon: MessageSquare, path: '/dashboard/messages' },
        { name: 'Study Goal', icon: Target, path: '/dashboard/study-goal' },
        { name: 'Achievements', icon: Award, path: '/dashboard/achievements' },
        { name: 'Sponsorships', icon: HeartHandshake, path: '/dashboard/support' },
        { name: 'Ecosystem Nexus', icon: ShieldCheck, path: '/dashboard/ecosystem' },
      ],
      showFinance: true,
      quickActions: [
        { name: 'Add Student', icon: Users, path: '/dashboard/students' },
        { name: 'Send Announcement', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Manage Sections', icon: Users, path: '/dashboard/sections' }
      ]
    },
    instructor: {
      menu1: [
        { name: 'Dashboard', icon: Home, path: '/dashboard', exact: true },
        { name: 'Create Course', icon: BookOpen, path: '/dashboard/builder' },
        { name: 'Manage Courses', icon: ClipboardCheck, path: '/dashboard/my-courses' },
        { name: 'Students', icon: Users, path: '/dashboard/students' },
        { name: 'Sections', icon: Users, path: '/dashboard/sections' },
        { name: 'Attendance', icon: ClipboardCheck, path: '/dashboard/attendance' },
        { name: 'Live Classes', icon: Video, path: '/dashboard/live-classes' },
      ],
      menu2: [
        { name: 'Library', icon: BookOpen, path: '/dashboard/library' },
        { name: 'Notice', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Calendar', icon: CalendarDays, path: '/dashboard/calendar' },
        { name: 'Message', icon: MessageSquare, path: '/dashboard/messages' },
        { name: 'Study Goal', icon: Target, path: '/dashboard/study-goal' },
        { name: 'Achievements', icon: Award, path: '/dashboard/achievements' },
        { name: 'Ecosystem Nexus', icon: ShieldCheck, path: '/dashboard/ecosystem' },
      ],
      showFinance: false,
      quickActions: [
        { name: 'Create Course', icon: BookOpen, path: '/dashboard/builder' },
        { name: 'Mark Attendance', icon: ClipboardCheck, path: '/dashboard/attendance' },
        { name: 'Manage Sections', icon: Users, path: '/dashboard/sections' }
      ]
    },
    student: {
      menu1: [
        { name: 'Dashboard', icon: Home, path: '/dashboard', exact: true },
        { name: 'My Courses', icon: BookOpen, path: '/dashboard/courses' },
        { name: 'Attendance', icon: ClipboardCheck, path: '/dashboard/attendance' },
        { name: 'Study Goal', icon: Target, path: '/dashboard/study-goal' },
        { name: 'Live Classes', icon: Video, path: '/dashboard/live-classes' },
        { name: 'Achievements', icon: Award, path: '/dashboard/achievements' },
        { name: 'Schedule', icon: CalendarDays, path: '/dashboard/schedule' },
      ],
      menu2: [
        { name: 'Notice', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Library', icon: BookOpen, path: '/dashboard/library' },
        { name: 'Message', icon: MessageSquare, path: '/dashboard/messages' },
        { name: 'Certificates', icon: Award, path: '/dashboard/certificates' },
        { name: 'Study Tools', icon: Sparkles, path: '/dashboard/study-tools' },
        { name: 'Career Hub', icon: Briefcase, path: '/dashboard/career-hub' },
        { name: 'Ecosystem Nexus', icon: ShieldCheck, path: '/dashboard/ecosystem' },
      ],
      showFinance: false,
      quickActions: []
    },
    parent: {
      menu1: [
        { name: 'Dashboard', icon: Home, path: '/dashboard', exact: true },
        { name: 'My Child', icon: Users, path: '/dashboard/child' },
        { name: 'Progress Report', icon: ClipboardCheck, path: '/dashboard/progress' },
        { name: 'Schedule', icon: CalendarDays, path: '/dashboard/schedule' },
      ],
      menu2: [
        { name: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
        { name: 'Notifications', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Library', icon: BookOpen, path: '/dashboard/library' },
        { name: 'Sponsorships', icon: HeartHandshake, path: '/dashboard/support' },
        { name: 'Ecosystem Nexus', icon: ShieldCheck, path: '/dashboard/ecosystem' },
      ],
      quickActions: []
    },
    sponsor: {
      menu1: [
        { name: 'Dashboard', icon: Home, path: '/dashboard/sponsor', exact: true },
      ],
      menu2: [
        { name: 'Sponsorships', icon: HeartHandshake, path: '/dashboard/support' },
        { name: 'Notice', icon: BellRing, path: '/dashboard/notice' },
        { name: 'Library', icon: BookOpen, path: '/dashboard/library' },
        { name: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
        { name: 'Ecosystem Nexus', icon: ShieldCheck, path: '/dashboard/ecosystem' },
      ],
      showFinance: false,
      quickActions: []
    }
  };

  const currentConfig = roleNavConfig[role] || roleNavConfig.student;
  const navItemsMenu1 = currentConfig.menu1;
  const navItemsMenu2 = currentConfig.menu2;
  const showFinance = currentConfig.showFinance || false;
  const quickActions = currentConfig.quickActions || [];


  return (
    <div style={{ backgroundColor: isDarkMode ? '#0B1120' : '#F8FAFC' }} className={`h-screen w-full flex flex-col md:flex-row transition-colors duration-300 relative overflow-hidden ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      <CommandK />
      {/* Animated Background Mesh */}
      
      {/* Mobile Header */}
      <div 
        className={`md:hidden rounded-none p-3 flex items-center justify-between sticky top-0 z-50 transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}
        style={{ 
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'}`, 
          boxShadow: isDarkMode 
            ? '0 10px 30px -8px rgba(0, 0, 0, 0.8), 0 4px 12px -8px rgba(0, 212, 255, 0.3), 0 1px 0px rgba(255, 255, 255, 0.1)' 
            : '0 10px 30px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -8px rgba(15, 23, 42, 0.1), 0 1px 0px rgba(15, 23, 42, 0.06)'
        }}
      >
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`dark:text-slate-200 p-2 rounded-lg hover:bg-white/5/5 backdrop-blur-xl/30 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
          <Menu className="w-6 h-6" />
        </button>

        <p className="text-sm font-semibold text-slate-100 dark:text-white">{dashboardTitle}</p>

        {!mobileMenuOpen ? (
          <NavLink to="/"><img src={edotLogo} alt="EDOT Campaign Logo" className="h-8 w-8 rounded-full object-cover" /></NavLink>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>

      {/* Sidebar */}
      <aside 
        className={`dashboard-sidebar tilet-border-sidebar fixed md:sticky top-0 left-0 h-screen md:h-full z-60 transition-colors duration-300
        ${mobileMenuOpen ? 'translate-x-0 w-64 bg-[#0B1120]/95 text-white' : `-translate-x-full md:translate-x-0 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}
        ${sidebarCollapsed ? 'md:w-[88px] w-20' : 'w-64 md:w-56'}
      `}
        style={{ 
          borderRight: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'}`, 
          boxShadow: isDarkMode 
            ? '14px 0 44px -10px rgba(0, 0, 0, 0.9), 1px 0 0 rgba(255, 255, 255, 0.12)' 
            : '14px 0 44px -10px rgba(15, 23, 42, 0.28), 1px 0 0 rgba(15, 23, 42, 0.1)' 
        }}
      >
        {mobileMenuOpen && (
          <button onClick={() => setMobileMenuOpen(false)} className={`absolute top-3 right-3 md:hidden dark:text-slate-300 p-1.5 rounded-lg hover:bg-white/5/5 backdrop-blur-xl/40 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        )}
        <div 
          className={`p-4 pt-6 pb-3 flex flex-col items-center justify-center gap-2 relative ${mobileMenuOpen ? 'items-center' : ''}`}
          style={{
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'}`,
            boxShadow: isDarkMode
              ? '0 16px 32px -14px rgba(0, 0, 0, 0.9), inset 0 -1px 10px rgba(255, 255, 255, 0.12), 0 0 0 1px rgba(255,255,255,0.02)'
              : '0 16px 32px -14px rgba(15, 23, 42, 0.24), inset 0 -1px 10px rgba(255, 255, 255, 0.7), 0 0 0 1px rgba(15,23,42,0.04)'
          }}
        >
           <NavLink to="/">
             <div className="w-[50px] h-[50px] rounded-full bg-white flex items-center justify-center border-4 border-slate-100 overflow-hidden shadow-sm mx-auto">
               <img src={edotLogo} alt="Logo" className="w-full h-full object-cover" />
             </div>
           </NavLink>
           {!sidebarCollapsed && (
             <div className={`font-black text-[15px] leading-tight text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
               {dashboardTitle.split(' ').map((word, i) => (
                  <React.Fragment key={i}>
                    {word}
                    {i === 0 ? <br/> : ' '}
                  </React.Fragment>
               ))}
             </div>
           )}

          {!mobileMenuOpen && (
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg border transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-400'}`}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-3 space-y-6 flex-1 scrollbar-hide mt-3">
           
           {/* Section: MAIN */}
           <div>
             {!sidebarCollapsed && <p className={`text-[11px] font-bold mb-3 px-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>MAIN</p>}
             <nav className="space-y-2">
               {navItemsMenu1.map(item => (
                 <NavItem key={item.name} item={item} metrics={metrics} role={role} sidebarCollapsed={sidebarCollapsed} onLinkClick={setMobileMenuOpen} isDarkMode={isDarkMode} />
               ))}
               
               {/* Finance Accordion */}
               {showFinance && (
               <div>
                 <button 
                   onClick={() => setFinanceOpen(!financeOpen)}
                   className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium hover:bg-white/5/5 hover:text-white ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}
                 >
                   <div className="flex items-center gap-3">
                     <Wallet className="w-5 h-5 shrink-0 transition-transform hover:scale-110 duration-300" />
                     {!sidebarCollapsed && <span className="animate-in fade-in slide-in-from-left-2">Finance</span>}
                   </div>
                   {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform ${financeOpen ? 'rotate-180' : ''}`} />}
                 </button>
                 {financeOpen && !sidebarCollapsed && (
                   <div className="pl-10 pr-3 py-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                     <NavLink to="/dashboard/finance/fees" className={({isActive}) => `block py-2.5 text-sm transition-colors ${isActive ? 'text-[#00D4FF] font-semibold' : 'text-slate-200 hover:text-white font-medium'}`}>
                       Fees Collection
                     </NavLink>
                     <NavLink to="/dashboard/finance/expenses" className={({isActive}) => `block py-2.5 text-sm transition-colors ${isActive ? 'text-[#00D4FF] font-semibold' : 'text-slate-200 hover:text-white font-medium'}`}>
                       Expenses
                     </NavLink>
                   </div>
                 )}
               </div>
               )}
             </nav>
           </div>

           {/* Section: MANAGEMENT */}
           <div>
             {!sidebarCollapsed && <p className={`text-[11px] font-bold mb-3 px-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>MANAGEMENT</p>}
             <nav className="space-y-2">
               {navItemsMenu2.map(item => (
                 <NavItem key={item.name} item={item} metrics={metrics} role={role} sidebarCollapsed={sidebarCollapsed} onLinkClick={setMobileMenuOpen} isDarkMode={isDarkMode} />
               ))}
             </nav>
           </div>

           {/* Section: COMMUNICATION */}
           <div>
             {!sidebarCollapsed && <p className={`text-[11px] font-bold mb-3 px-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>SETTINGS</p>}
             <nav className="space-y-2">
               <NavItem item={{ name: 'Profile', icon: User, path: '/dashboard/profile' }} metrics={metrics} role={role} sidebarCollapsed={sidebarCollapsed} onLinkClick={setMobileMenuOpen} isDarkMode={isDarkMode} />
               <NavItem item={{ name: 'Setting', icon: Settings, path: '/dashboard/settings' }} metrics={metrics} role={role} sidebarCollapsed={sidebarCollapsed} onLinkClick={setMobileMenuOpen} isDarkMode={isDarkMode} />
             </nav>
           </div>
        </div>

        {/* Bottom area (Logout) */}
        <div 
          className="p-3 mt-auto"
          style={{
            borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'}`,
            boxShadow: isDarkMode
              ? '0 -16px 40px -18px rgba(0, 0, 0, 0.92), inset 0 1px 12px rgba(255, 255, 255, 0.14)'
              : '0 -16px 40px -18px rgba(15, 23, 42, 0.28), inset 0 1px 12px rgba(255, 255, 255, 0.85)'
          }}
        >
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-full hover:bg-rose-500/100/10 hover:text-rose-400 transition-colors font-medium shadow-md ${sidebarCollapsed ? 'md:px-0' : ''} ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="animate-in fade-in">Log out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#0B1120]/40 backdrop-blur-sm z-30 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen max-h-screen bg-transparent transition-colors duration-300">
        
        {/* Top Header */}
        <header 
          className={`h-[96px] px-8 flex items-center justify-between shrink-0 sticky top-0 z-20 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}
          style={{ 
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'}`, 
            boxShadow: isDarkMode 
              ? '0 18px 54px -14px rgba(0, 0, 0, 0.95), 0 6px 18px -10px rgba(0, 212, 255, 0.4), 0 1px 0px rgba(255, 255, 255, 0.12)' 
              : '0 18px 54px -14px rgba(15, 23, 42, 0.32), 0 6px 18px -10px rgba(15, 23, 42, 0.16), 0 1px 0px rgba(15, 23, 42, 0.08)'
          }}
        >
          
          <div className="hidden md:block w-96 relative" ref={searchContainerRef}>
             <Search className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
             <input 
                type="text" 
                placeholder="Search courses, lessons..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                className={`w-full !pl-12 pr-10 py-2.5 rounded-full text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-[#00D4FF]/50 ${isDarkMode ? 'bg-[#121A2F] text-white placeholder-slate-500' : 'bg-slate-100/50 text-slate-900 placeholder-slate-400 focus:bg-white'}`}
             />
             {searchQuery && (
               <button 
                 onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                 className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
               >
                 <X className="w-3.5 h-3.5" />
               </button>
             )}
             
             {searchOpen && (
               <div 
                 className={`absolute left-0 right-0 mt-3 w-[450px] max-h-[380px] overflow-y-auto z-[150] rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
                   isDarkMode 
                     ? 'bg-slate-950/95 border-white/10 shadow-black/85' 
                     : 'bg-white/95 border-slate-200 shadow-slate-200/50'
                 }`}
               >
                 {searchLoading ? (
                   <div className="p-6 flex items-center justify-center gap-3">
                     <svg className="animate-spin h-5 w-5 text-[#00D4FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Searching EDOT...</span>
                   </div>
                 ) : searchResults.length === 0 ? (
                   <div className="p-6 text-center">
                     <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                       No results found for <span className="font-bold text-[#00D4FF]">"{searchQuery}"</span>
                     </p>
                   </div>
                 ) : (
                   <div className="p-3 space-y-3">
                     {/* Group results by category */}
                     {['Course', 'Notice', 'User'].map((groupType) => {
                       const groupResults = searchResults.filter(item => {
                         if (groupType === 'User') {
                           return ['System', 'Instructor', 'Parent', 'Student'].includes(item.type);
                         }
                         return item.type === groupType;
                       });
                       
                       if (groupResults.length === 0) return null;
                       
                       return (
                         <div key={groupType} className="space-y-1">
                           <h4 className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                             {groupType === 'User' ? 'People' : groupType === 'Notice' ? 'Announcements' : 'Courses'}
                           </h4>
                           
                           {groupResults.map((item) => {
                             // Dynamic details based on group type
                             let icon = <BookOpen className="w-4 h-4" />;
                             let itemPath = item.path;
                             if (item.type === 'Notice') {
                               icon = <BellRing className="w-4 h-4" />;
                             } else if (['System', 'Instructor', 'Parent', 'Student'].includes(item.type)) {
                               icon = <User className="w-4 h-4" />;
                             }
                             
                             // If it's a course, navigate to /course/:id instead of a generic path
                             if (item.type === 'Course') {
                               itemPath = `/course/${item.id}`;
                             }
                             
                             return (
                               <button
                                 key={`${item.type}-${item.id}`}
                                 onClick={() => {
                                   setSearchQuery('');
                                   setSearchResults([]);
                                   setSearchOpen(false);
                                   navigate(itemPath);
                                 }}
                                 className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors group ${
                                   isDarkMode ? 'hover:bg-white/5 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                                 }`}
                               >
                                 <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                                   isDarkMode ? 'bg-[#121A2F] text-[#00D4FF] group-hover:bg-[#00D4FF] group-hover:text-white' : 'bg-slate-100 text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white'
                                 }`}>
                                   {icon}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                   <div className="flex items-center justify-between gap-2">
                                     <span className={`text-sm font-bold truncate group-hover:text-[#00D4FF] transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                       {item.title}
                                     </span>
                                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                                       item.type === 'Course'
                                         ? 'bg-blue-500/10 text-blue-500'
                                         : item.type === 'Notice'
                                         ? 'bg-amber-500/10 text-amber-500'
                                         : 'bg-emerald-500/10 text-emerald-500'
                                     }`}>
                                       {item.type}
                                     </span>
                                   </div>
                                   {item.subtitle && (
                                     <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                       {item.subtitle}
                                     </p>
                                   )}
                                 </div>
                               </button>
                             );
                           })}
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
             )}
          </div>
          
          {/* Right side actions */}
          <div className="flex items-center gap-7 ml-auto">
            
            {/* Quick Actions (Admin/Instructor) */}
            {quickActions.length > 0 && (
              <div className="relative hidden md:block" ref={quickActionsRef}>
                <button 
                  onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${role === 'admin' ? 'bg-[#FACC15] hover:bg-[#00D4FF] text-[#020617] shadow-glow-yellow' : 'bg-[#00D4FF] hover:bg-[#FACC15] shadow-glow-yellow'} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  <Plus className="w-4 h-4" />
                  Quick Action
                </button>
                
                {quickActionsOpen && (
                  <div className={`absolute right-0 mt-3 w-56 rounded-2xl shadow-xl shadow-black/40 border overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-slate-950/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                    <div className="p-2 space-y-1">
                      <p className={`px-3 py-1.5 text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Create New</p>
                      {quickActions.map(action => (
                        <button key={action.name} onClick={() => { setQuickActionsOpen(false); navigate(action.path); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 hover:text-[#00D4FF] transition-colors text-left group ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>
                           <div className={`p-1.5 rounded-lg text-[#00D4FF] group-hover:scale-110 transition-transform ${isDarkMode ? 'bg-[#0B1120]/10' : 'bg-slate-50'}`}>
                             <action.icon className="w-4 h-4" />
                           </div>
                           {action.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Theme Toggle */}
            {/* Theme Dropdown has custom layout spacing */}
            <ThemeDropdown />

            {/* Notifications */}
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className={`relative pl-6 border-l ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`} ref={profileDropdownRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 focus:outline-none cursor-pointer group"
              >
                <div className="hidden lg:block text-right">
                  <p className={`text-sm font-bold transition-colors !m-0 !leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user?.name || 'Test User'}</p>
                  <p className={`text-xs font-medium capitalize !m-0 !leading-tight !mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-500'}`}>{user?.role || role}</p>
                </div>
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#008A32] to-[#00D4FF] p-0.5 shadow-md shadow-[#008A32]/20 group-hover:shadow-[#00D4FF]/40 transition-shadow">
                  <UserAvatar user={user} className="w-full h-full text-base border-2 border-white" />
                </div>
              </button>

              {profileOpen && (
                <div className={`absolute right-0 mt-4 w-72 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-slate-950/95 border border-white/10 shadow-xl shadow-black/40' : 'bg-white/95 border border-slate-200 shadow-xl shadow-slate-900/10'}`}>
                  <div className={`p-5 border-b flex flex-col items-center gap-3 text-center ${isDarkMode ? 'bg-slate-950/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#008A32] to-[#00D4FF] p-0.5 shadow-sm">
                      <UserAvatar user={user} className="w-full h-full text-xl border-[3px] border-white" />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user?.name || 'Admin User'}</h3>
                      <p className="text-sm font-semibold text-[#00D4FF] mt-1 capitalize">{user?.role || 'Admin'}</p>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{user?.email || 'admin@edot.com'}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-1">
                    <button 
                      onClick={() => { setProfileOpen(false); navigate('/dashboard/profile'); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5/5 hover:text-[#00D4FF] transition-colors text-left ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}
                    >
                      <User className="w-4 h-4" /> My Profile
                    </button>
                    <button 
                      onClick={() => { setProfileOpen(false); navigate('/dashboard/settings'); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5/5 hover:text-[#00D4FF] transition-colors text-left ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}
                    >
                      <Settings className="w-4 h-4" /> Account Settings
                    </button>
                    <div className={`h-px my-2 mx-2 ${isDarkMode ? 'bg-[#0B1120]/10' : 'bg-slate-50'}`}></div>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-rose-400 hover:bg-rose-500/100/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
         <div className={`flex-1 overflow-y-auto overflow-x-hidden mb-16 md:mb-0 relative z-10 transition-colors duration-300 flex flex-col ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
           <div className={`flex-1 p-4 md:p-8 dashboard-main-content rounded-[32px] border transition-all duration-300 ${isDarkMode ? 'bg-[#0B1120]/95 border-white/10 shadow-[0_30px_80px_-26px_rgba(0,0,0,0.85)]' : 'bg-white/90 border-slate-200 shadow-[0_30px_80px_-26px_rgba(15,23,42,0.22)]'}`}>
             <Outlet />
           </div>
        </div>
      </main>
    </div>
  );
}
