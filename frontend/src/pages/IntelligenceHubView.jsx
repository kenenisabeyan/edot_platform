import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useThemeMode from '../hooks/useThemeMode';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Sparkles, 
  TrendingUp, 
  Brain, 
  Target, 
  Bot, 
  Lightbulb, 
  Compass, 
  Flame, 
  Users, 
  Rocket, 
  Briefcase, 
  Globe, 
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Award,
  CheckCircle2,
  BookOpen,
  Zap,
  Clock,
  PlayCircle
} from 'lucide-react';

import PersonalizedIntelligenceDashboard from '../components/student/PersonalizedIntelligenceDashboard';
import IntelligentLearningAnalytics from '../components/IntelligentLearningAnalytics';
import SkillGraph from '../components/SkillGraph';
import RecommendationEnginePanel from '../components/RecommendationEnginePanel';
import StudyGoalView from './StudyGoalView';
import LiveClassesView from './LiveClassesView';
import CareerCenter from './CareerCenter';
import EcosystemNexus from '../components/EcosystemNexus';
import AdminIntelligenceDashboard from './AdminIntelligenceDashboard';
import ParentInsightGrid from '../components/ParentInsightGrid';
import CourseInsightsPanel from '../components/CourseInsightsPanel';
import StudyTools from './StudyTools';
import api from '../utils/api';

const NAV_ITEMS = [
  { id: 'next-step', label: 'Your Next Best Step', icon: Sparkles, color: 'from-amber-400 to-orange-500', path: '/dashboard/intelligence/next-step' },
  { id: 'progress', label: 'My Progress', icon: TrendingUp, color: 'from-emerald-400 to-teal-500', path: '/dashboard/intelligence/progress' },
  { id: 'mastery', label: 'My Mastery', icon: Brain, color: 'from-purple-400 to-indigo-500', path: '/dashboard/intelligence/mastery' },
  { id: 'skills', label: 'My Skills', icon: Target, color: 'from-sky-400 to-blue-500', path: '/dashboard/intelligence/skills' },
  { id: 'mentor', label: 'AI Mentor', icon: Bot, color: 'from-cyan-400 to-blue-600', path: '/dashboard/intelligence/mentor' },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, color: 'from-yellow-400 to-amber-500', path: '/dashboard/intelligence/recommendations' },
  { id: 'learning-path', label: 'Learning Path', icon: Compass, color: 'from-blue-400 to-indigo-600', path: '/dashboard/intelligence/learning-path' },
  { id: 'pulse', label: 'Learning Pulse', icon: Flame, color: 'from-rose-400 to-red-500', path: '/dashboard/intelligence/pulse' },
  { id: 'mentors', label: 'Mentors & Collaboration', icon: Users, color: 'from-teal-400 to-emerald-600', path: '/dashboard/intelligence/mentors' },
  { id: 'projects', label: 'Projects & Experience', icon: Rocket, color: 'from-violet-400 to-purple-600', path: '/dashboard/intelligence/projects' },
  { id: 'career', label: 'Career Readiness', icon: Briefcase, color: 'from-blue-500 to-cyan-600', path: '/dashboard/intelligence/career' },
  { id: 'opportunities', label: 'Opportunities', icon: Globe, color: 'from-emerald-500 to-sky-600', path: '/dashboard/intelligence/opportunities' },
  { id: 'insights', label: 'Insights', icon: BarChart3, color: 'from-indigo-400 to-purple-500', path: '/dashboard/intelligence/insights' }
];

export default function IntelligenceHubView() {
  const { user } = useAuth();
  const isDarkMode = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role ? user.role.toLowerCase().trim() : 'student';

  const [intelProfile, setIntelProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/intelligence/profile/me').catch(() => ({ data: { data: null } }));
        if (isMounted && data?.data) {
          setIntelProfile(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch intelligence profile', err);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  const activePath = location.pathname;

  return (
    <div className={`min-h-screen p-4 md:p-8 space-y-8 transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Top Banner Header */}
      <div className={`p-6 md:p-8 rounded-3xl relative overflow-hidden border backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl ${isDarkMode ? 'bg-[#0F172A]/80 border-slate-800' : 'bg-gradient-to-r from-emerald-900 via-slate-900 to-blue-950 text-white border-slate-700'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_30%_30%,#00D4FF,transparent_70%)]" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 uppercase tracking-widest flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> EDOT Intelligence Core
            </span>
            <span className="text-xs font-medium text-slate-300">Phase 0–21 Ecosystem</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
            <span>Intelligence Hub</span>
            <Sparkles className="w-6 h-6 text-[#00D4FF] animate-pulse" />
          </h1>
          <p className="text-sm text-slate-300 font-medium">
            {role === 'admin' ? 'Platform intelligence pipeline, learning analytics, and course health registry.' :
             role === 'instructor' ? 'Class learning health, student support signals, and course engagement insights.' :
             role === 'parent' ? 'Authorized learner progress summary, milestones, and support recommendations.' :
             role === 'sponsor' ? 'Aggregated program outcomes, skill acquisition trends, and impact metrics.' :
             'Your personalized command center for skill mastery, learning path growth, and next best steps.'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/intelligence')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md ${
              activePath === '/dashboard/intelligence' || activePath === '/dashboard/intelligence/'
                ? 'bg-[#22C55E] text-slate-950 hover:bg-[#16a34a]'
                : isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Brain className="w-4 h-4" /> Hub Overview
          </button>
        </div>
      </div>

      {/* Navigation Sub-Pills (Quick Access Scroll Bar) */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2.5 min-w-max">
          {NAV_ITEMS.map((nav) => {
            const Icon = nav.icon;
            const isActive = activePath.startsWith(nav.path);
            return (
              <NavLink
                key={nav.id}
                to={nav.path}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-2 border shadow-sm ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40 font-extrabold scale-105'
                      : 'bg-[#EAF6ED] text-[#16a34a] border-[#22C55E]/40 font-extrabold scale-105'
                    : isDarkMode
                      ? 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#22C55E]' : 'text-slate-400'}`} />
                <span>{nav.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Main Subviews Route Container */}
      <ErrorBoundary>
        <Routes>
          {/* Index Route: Calm Command Center Overview */}
          <Route path="/" element={<IntelligenceHubLanding role={role} isDarkMode={isDarkMode} intelProfile={intelProfile} />} />
          <Route path="next-step" element={<NextBestStepView isDarkMode={isDarkMode} user={user} />} />
          <Route path="progress" element={<ProgressView isDarkMode={isDarkMode} user={user} role={role} />} />
          <Route path="mastery" element={<MasteryView isDarkMode={isDarkMode} user={user} />} />
          <Route path="skills" element={<SkillsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="mentor" element={<AIMentorView isDarkMode={isDarkMode} user={user} />} />
          <Route path="recommendations" element={<RecommendationsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="learning-path" element={<LearningPathView isDarkMode={isDarkMode} user={user} />} />
          <Route path="pulse" element={<LearningPulseView isDarkMode={isDarkMode} user={user} />} />
          <Route path="mentors" element={<MentorsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="projects" element={<ProjectsView isDarkMode={isDarkMode} user={user} />} />
          <Route path="career" element={<CareerReadinessView isDarkMode={isDarkMode} user={user} />} />
          <Route path="opportunities" element={<OpportunitiesView isDarkMode={isDarkMode} user={user} />} />
          <Route path="insights" element={<InsightsView isDarkMode={isDarkMode} user={user} role={role} />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

/* =========================================================================
   SUBVIEW COMPONENTS (Using & Exposing Existing Intelligence Engines)
   ========================================================================= */

/** Landing Page Overview (Calm Command Center) */
function IntelligenceHubLanding({ role, isDarkMode, intelProfile }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Primary Highlight Card: ✨ Your Next Best Step */}
      <div className={`p-8 rounded-3xl border relative overflow-hidden transition-all duration-500 shadow-2xl ${
        isDarkMode
          ? 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0B1120] border-amber-500/30'
          : 'bg-gradient-to-r from-amber-50 via-white to-orange-50 border-amber-200'
      }`}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-bounce" /> Primary Recommendation
          </div>

          <h2 className={`text-2xl md:text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Your Next Best Step
          </h2>

          <p className={`text-sm md:text-base font-medium max-w-2xl leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {intelProfile?.nextAction?.description || 
             "Continue practicing your current course concepts to solidify momentum and unlock your next milestone badge."}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/intelligence/next-step')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105"
            >
              <span>Take Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard/intelligence/mentor')}
              className={`px-5 py-3 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 cursor-pointer ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bot className="w-4 h-4 text-cyan-500" />
              <span>Ask AI Mentor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Intelligence Snapshots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Progress Snapshot */}
        <SnapshotCard
          title="My Progress"
          subtitle="Continuous learning velocity & milestone completion"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/progress')}
        >
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold">
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Overall Completion</span>
              <span className="text-[#22C55E]">Continuous Growth</span>
            </div>
            <div className="w-full bg-slate-700/30 h-3 rounded-full overflow-hidden">
              <div className="bg-[#22C55E] h-full rounded-full w-[78%]" />
            </div>
            <p className="text-xs text-slate-400">Keep up your weekly study streak to maintain optimal retention.</p>
          </div>
        </SnapshotCard>

        {/* Mastery Snapshot */}
        <SnapshotCard
          title="My Mastery"
          subtitle="Concept comprehension & skill confidence"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/mastery')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black">High Retention</div>
              <div className="text-xs text-slate-400">Mastery engine active across enrolled courses</div>
            </div>
          </div>
        </SnapshotCard>

        {/* Skills Snapshot */}
        <SnapshotCard
          title="My Skills"
          subtitle="Verified abilities & practical competencies"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/skills')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black">Skill Graph Ready</div>
              <div className="text-xs text-slate-400">Explore domain strengths & improvement areas</div>
            </div>
          </div>
        </SnapshotCard>

        {/* Learning Pulse */}
        <SnapshotCard
          title="Learning Pulse"
          subtitle="Real-time telemetry & focus rhythm"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/pulse')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-lg font-black">Active Momentum</div>
              <div className="text-xs text-slate-400">Consistent weekly study rhythm logged</div>
            </div>
          </div>
        </SnapshotCard>

        {/* Career Readiness */}
        <SnapshotCard
          title="Career Readiness"
          subtitle="Industry skill match & portfolio progress"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/career')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black">Career Center</div>
              <div className="text-xs text-slate-400">Resume analyzer & market role alignment</div>
            </div>
          </div>
        </SnapshotCard>

        {/* Opportunities */}
        <SnapshotCard
          title="Opportunities"
          subtitle="Sponsorships, projects & ecosystem nexus"
          isDarkMode={isDarkMode}
          onAction={() => navigate('/dashboard/intelligence/opportunities')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-black">Ecosystem Nexus</div>
              <div className="text-xs text-slate-400">Discover scholarships & real-world projects</div>
            </div>
          </div>
        </SnapshotCard>

      </div>
    </div>
  );
}

function SnapshotCard({ title, subtitle, isDarkMode, children, onAction }) {
  return (
    <div className={`p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between gap-4 ${
      isDarkMode ? 'bg-[#0F172A]/70 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
    }`}>
      <div className="space-y-1">
        <h3 className={`font-black text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
      </div>

      <div className="py-2">{children}</div>

      <button
        type="button"
        onClick={onAction}
        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
        }`}
      >
        <span>Explore Details</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* --- 13 CHILD SUB-VIEWS (Exposing existing functionality) --- */

function NextBestStepView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <PersonalizedIntelligenceDashboard isDarkMode={isDarkMode} user={user} />
    </div>
  );
}

function ProgressView({ isDarkMode, user, role }) {
  return (
    <div className="space-y-6">
      <IntelligentLearningAnalytics isDarkMode={isDarkMode} user={user} role={role} />
    </div>
  );
}

function MasteryView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <SkillGraph isDarkMode={isDarkMode} />
    </div>
  );
}

function SkillsView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <SkillGraph isDarkMode={isDarkMode} />
    </div>
  );
}

function AIMentorView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <StudyTools isDarkMode={isDarkMode} />
    </div>
  );
}

function RecommendationsView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <RecommendationEnginePanel isDarkMode={isDarkMode} />
      <PersonalizedIntelligenceDashboard isDarkMode={isDarkMode} user={user} />
    </div>
  );
}

function LearningPathView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <PersonalizedIntelligenceDashboard isDarkMode={isDarkMode} user={user} />
    </div>
  );
}

function LearningPulseView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <StudyGoalView isDarkMode={isDarkMode} />
    </div>
  );
}

function MentorsView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <LiveClassesView isDarkMode={isDarkMode} />
    </div>
  );
}

function ProjectsView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <StudyTools isDarkMode={isDarkMode} />
    </div>
  );
}

function CareerReadinessView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <CareerCenter isDarkMode={isDarkMode} />
    </div>
  );
}

function OpportunitiesView({ isDarkMode, user }) {
  return (
    <div className="space-y-6">
      <EcosystemNexus isDarkMode={isDarkMode} />
    </div>
  );
}

function InsightsView({ isDarkMode, user, role }) {
  if (role === 'admin') {
    return <AdminIntelligenceDashboard isDarkMode={isDarkMode} />;
  }
  if (role === 'parent') {
    return <ParentInsightGrid isDarkMode={isDarkMode} />;
  }
  return (
    <div className="space-y-6">
      <CourseInsightsPanel isDarkMode={isDarkMode} />
      <PersonalizedIntelligenceDashboard isDarkMode={isDarkMode} user={user} />
    </div>
  );
}
