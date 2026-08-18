import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import useThemeMode from './hooks/useThemeMode';

// Keep lightweight pages in main bundle
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import Contact from './pages/Contact';
import Impact from './pages/Impact';
import Sponsorship from './pages/Sponsorship';
import VerifyCertificate from './pages/VerifyCertificate';
import Courses from './pages/Courses';
import { useAuth } from './context/AuthContext';

import EDOTLayout from './components/EDOTLayout';

// Lazy load heavy dashboard and management pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'));
const InstructorCourseBuilder = lazy(() => import('./pages/InstructorCourseBuilder'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const CourseDetails = lazy(() => import('./pages/CourseDetails'));
const Lesson = lazy(() => import('./pages/Lesson'));
const QuizViewer = lazy(() => import('./pages/QuizViewer'));

// Lazy load dashboard management pages
const EDOTDashboard = lazy(() => import('./pages/EDOTDashboard'));
const TeachersList = lazy(() => import('./pages/TeachersList'));
const StudentsList = lazy(() => import('./pages/StudentsList'));
const FinanceFees = lazy(() => import('./pages/FinanceFees'));
const FinanceExpenses = lazy(() => import('./pages/FinanceExpenses'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const MessagesView = lazy(() => import('./pages/MessagesView'));
const StudentCourses = lazy(() => import('./pages/StudentCourses'));
const InstructorClasses = lazy(() => import('./pages/InstructorClasses'));
const InstructorManageCourses = lazy(() => import('./pages/InstructorManageCourses'));
const AdminCourseApprovals = lazy(() => import('./pages/AdminCourseApprovals'));
const CertificatesView = lazy(() => import('./pages/CertificatesView'));
const NoticeView = lazy(() => import('./pages/NoticeView'));
const LibraryView = lazy(() => import('./pages/LibraryView'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const ParentLearners = lazy(() => import('./pages/ParentLearners'));
const AttendanceManagement = lazy(() => import('./pages/AttendanceManagement'));
const Revenue = lazy(() => import('./pages/Revenue'));
const Performance = lazy(() => import('./pages/Performance'));
const TeachingActivity = lazy(() => import('./pages/TeachingActivity'));
const AnalyticsReport = lazy(() => import('./pages/AnalyticsReport'));
const SettingsView = lazy(() => import('./pages/SettingsView'));
const UsersManagement = lazy(() => import('./pages/UsersManagement'));
const SectionManagement = lazy(() => import('./pages/SectionManagement'));
const SupportDashboard = lazy(() => import('./pages/SupportDashboard'));
const SponsorDashboard = lazy(() => import('./pages/SponsorDashboard'));
const LiveClassesView = lazy(() => import('./pages/LiveClassesView'));
const EcosystemView = lazy(() => import('./pages/EcosystemView'));
const StudyGoalView = lazy(() => import('./pages/StudyGoalView'));
const AchievementsView = lazy(() => import('./pages/AchievementsView'));
const StudyTools = lazy(() => import('./pages/StudyTools'));
const CareerCenter = lazy(() => import('./pages/CareerCenter'));
const AdminIntelligenceDashboard = lazy(() => import('./pages/AdminIntelligenceDashboard'));



import ErrorBoundary from './components/ErrorBoundary';
import ChatbotWidget from './components/ChatbotWidget';

/**
 * Loading Fallback Component
 * Displayed while lazy-loaded routes are being loaded
 * Improves perceived performance with skeleton UI
 */
function LazyLoadingFallback() {
  const isDarkMode = useThemeMode();
  
  return (
    <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-transparent border-t-sky-500 rounded-full animate-spin"></div>
        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading page...
        </p>
      </div>
    </div>
  );
}

function MainLayout() {
  const isDarkMode = useThemeMode();
  return (
    <div className={`flex flex-col min-h-screen ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}>
      <Navbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

import CommandK from './components/CommandK';

function NotFound() {
  const isDarkMode = useThemeMode();
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-6 text-center ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`}>
      <h1 className="text-6xl font-black mb-4 text-sky-500">404</h1>
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className={`mb-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The page you are looking for doesn't exist or has been moved.</p>
      <button 
        onClick={() => window.history.back()}
        className="rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
      >
        Go Back
      </button>
    </div>
  );
}

export default function App() {
  const isDarkMode = useThemeMode();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const getSocketUrl = () => {
      const apiEnv = import.meta.env.VITE_API_URL;
      if (apiEnv) {
        return apiEnv.replace(/\/api$/, '').replace(/\/$/, '');
      }
      return import.meta.env.PROD ? 'https://edotplatform.onrender.com' : 'http://localhost:5005';
    };
    const SOCKET_BASE_URL = getSocketUrl();

    const socket = io(SOCKET_BASE_URL, {
      withCredentials: true
    });

    // Join room for direct direct alert push
    socket.emit('join_room', `user_${user.id}`);

    // Listen for direct direct alert events
    socket.on('notification', (data) => {
      toast.custom((t) => (
        <div className={`p-4 max-w-sm w-full shadow-2xl rounded-2xl flex flex-col gap-2 border pointer-events-auto backdrop-blur-xl transition-all duration-500 hover:scale-[1.02] ${
          t.visible ? 'animate-enter' : 'animate-leave'
        } ${isDarkMode ? 'bg-[#0B1120]/95 border-white/10 text-white' : 'bg-white/95 border-slate-200 text-slate-900'}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">🔔</span>
            <div className="flex-1 text-left min-w-0">
              <span className="text-sm font-black block truncate leading-snug">{data.title}</span>
              <span className={`text-[11.5px] font-medium leading-relaxed block mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{data.message}</span>
            </div>
          </div>
        </div>
      ), {
        duration: 8000,
        position: 'top-right'
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, isDarkMode]);

  return (
    <>
      <ScrollToTop />
      <CommandK />
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
             background: isDarkMode ? 'rgba(11, 17, 32, 0.85)' : 'rgba(255, 255, 255, 0.85)',
             backdropFilter: 'blur(16px)',
             WebkitBackdropFilter: 'blur(16px)',
             color: isDarkMode ? '#fff' : '#0f172a',
             border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
             boxShadow: isDarkMode ? '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 20px rgba(0, 212, 255, 0.15)' : '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 20px rgba(0,0,0,0.05)',
             padding: '16px 20px',
             borderRadius: '20px',
             fontSize: '14px',
             fontWeight: '600',
             maxWidth: '450px',
             lineHeight: '1.6',
          },
          success: {
             iconTheme: { primary: '#10B981', secondary: isDarkMode ? '#0B1120' : '#fff' },
             style: { borderLeft: '4px solid #10B981' }
          },
          error: {
             iconTheme: { primary: '#EF4444', secondary: isDarkMode ? '#0B1120' : '#fff' },
             style: { borderLeft: '4px solid #EF4444' }
          }
        }} 
      />
      <Routes>
      {/* Immersive Pages (No Nav/Footer) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/lesson/:id" element={
          <ErrorBoundary>
            <Suspense fallback={<LazyLoadingFallback />}>
              <Lesson />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/quiz/:id" element={
          <ErrorBoundary>
            <Suspense fallback={<LazyLoadingFallback />}>
              <QuizViewer />
            </Suspense>
          </ErrorBoundary>
        } />
      </Route>

      {/* Standalone Authentication Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Register />} />
      <Route path="/register" element={<Register />} />

      {/* Public / Landing Pages with Navbar & Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/course/:id" element={
          <Suspense fallback={<LazyLoadingFallback />}>
            <CourseDetails />
          </Suspense>
        } />
        <Route path="/about" element={<About />} />
        <Route path="/impact" element={<Impact />} />
        <Route path="/sponsorship" element={<Sponsorship />} />
        <Route path="/verify-certificate/:hash" element={<VerifyCertificate />} />
        <Route path="/contact" element={<Contact />} />
        
        {/* Old Standalone routes mapping to null or removed to force dashboard usage */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        <Route element={<ProtectedRoute allowedRoles={['instructor']} />}>
          <Route path="/instructor/*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="/student/*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* New EDOT Dashboard Layout (Full UI, no main Navbar/Footer) */}
      <Route path="/dashboard" element={
        <ErrorBoundary>
          <ProtectedRoute />
        </ErrorBoundary>
      }>
        <Route element={<Suspense fallback={<LazyLoadingFallback />}><EDOTLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<LazyLoadingFallback />}><EDOTDashboard /></Suspense>} />
          
          {/* Admin Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="users" element={<Suspense fallback={<LazyLoadingFallback />}><UsersManagement /></Suspense>} />
            <Route path="teachers" element={<Suspense fallback={<LazyLoadingFallback />}><TeachersList /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<LazyLoadingFallback />}><AdminCourseApprovals /></Suspense>} />
            <Route path="revenue" element={<Suspense fallback={<LazyLoadingFallback />}><Revenue /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<LazyLoadingFallback />}><AnalyticsReport /></Suspense>} />
            <Route path="finance/fees" element={<Suspense fallback={<LazyLoadingFallback />}><FinanceFees /></Suspense>} />
            <Route path="finance/expenses" element={<Suspense fallback={<LazyLoadingFallback />}><FinanceExpenses /></Suspense>} />
            <Route path="intelligence" element={<Suspense fallback={<LazyLoadingFallback />}><AdminIntelligenceDashboard /></Suspense>} />
          </Route>

          {/* Admin & Instructor Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'instructor']} />}>
            <Route path="classes" element={<Suspense fallback={<LazyLoadingFallback />}><InstructorClasses /></Suspense>} />
            <Route path="my-courses" element={<Suspense fallback={<LazyLoadingFallback />}><InstructorManageCourses /></Suspense>} />
            <Route path="builder" element={<Suspense fallback={<LazyLoadingFallback />}><InstructorCourseBuilder /></Suspense>} />
            <Route path="builder/:id" element={<Suspense fallback={<LazyLoadingFallback />}><InstructorCourseBuilder /></Suspense>} />
            <Route path="teaching" element={<Suspense fallback={<LazyLoadingFallback />}><TeachingActivity /></Suspense>} />
          </Route>

          {/* Admin, Instructor, Student (Shared with internal logic vs strict role blocks) */}
          <Route path="students" element={<Suspense fallback={<LazyLoadingFallback />}><StudentsList /></Suspense>} />
          <Route path="attendance" element={<Suspense fallback={<LazyLoadingFallback />}><AttendanceManagement /></Suspense>} />
          <Route path="performance" element={<Suspense fallback={<LazyLoadingFallback />}><Performance /></Suspense>} />
          <Route path="sections" element={<Suspense fallback={<LazyLoadingFallback />}><SectionManagement /></Suspense>} />
          
          {/* Parent Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route path="child" element={<Suspense fallback={<LazyLoadingFallback />}><ParentLearners /></Suspense>} />
            <Route path="progress" element={<Suspense fallback={<LazyLoadingFallback />}><ParentLearners /></Suspense>} />
          </Route>

          {/* Student Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="courses" element={<Suspense fallback={<LazyLoadingFallback />}><StudentCourses /></Suspense>} />
          </Route>

          {/* General Dashboard Routes available to anyone logged in */}
          <Route path="support" element={<Suspense fallback={<LazyLoadingFallback />}><SupportDashboard /></Suspense>} />
          <Route path="notice" element={<Suspense fallback={<LazyLoadingFallback />}><NoticeView /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LazyLoadingFallback />}><CalendarView /></Suspense>} />
          <Route path="schedule" element={<Suspense fallback={<LazyLoadingFallback />}><CalendarView /></Suspense>} />
          <Route path="library" element={<Suspense fallback={<LazyLoadingFallback />}><LibraryView /></Suspense>} />
          <Route path="messages" element={<Suspense fallback={<LazyLoadingFallback />}><MessagesView /></Suspense>} />
          <Route path="certificates" element={<Suspense fallback={<LazyLoadingFallback />}><CertificatesView /></Suspense>} />
          <Route path="study-goal" element={<Suspense fallback={<LazyLoadingFallback />}><StudyGoalView /></Suspense>} />

          <Route path="achievements" element={<Suspense fallback={<LazyLoadingFallback />}><AchievementsView /></Suspense>} />
          <Route path="study-tools" element={<Suspense fallback={<LazyLoadingFallback />}><StudyTools /></Suspense>} />
          <Route path="career-hub" element={<Suspense fallback={<LazyLoadingFallback />}><CareerCenter /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<LazyLoadingFallback />}><ProfileView /></Suspense>} />
          <Route path="live-classes" element={<Suspense fallback={<LazyLoadingFallback />}><LiveClassesView /></Suspense>} />

          {/* Sponsor Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={['sponsor']} />}>
            <Route path="sponsor" element={<Suspense fallback={<LazyLoadingFallback />}><SponsorDashboard /></Suspense>} />
          </Route>

          <Route path="settings" element={<Suspense fallback={<LazyLoadingFallback />}><SettingsView /></Suspense>} />
          <Route path="ecosystem" element={<Suspense fallback={<LazyLoadingFallback />}><EcosystemView /></Suspense>} />
        </Route>
      </Route>

      {/* Global 404 Catch-All */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    <ChatbotWidget />
    </>
  );
}

function DashboardRouter() {
  const { user } = useAuth();
  
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'instructor') return <Navigate to="/instructor" replace />;
  return <Navigate to="/student" replace />; // Default to student
}
