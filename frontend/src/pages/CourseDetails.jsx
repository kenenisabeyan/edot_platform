import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  Clock, 
  MapPin, 
  Euro, 
  Users, 
  PlayCircle,
  FileText,
  BadgeAlert,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
  MonitorPlay,
  Lock,
  Unlock,
  BookOpen,
  ArrowRight,
  Video,
  Globe,
  Calculator,
  Rocket,
  Target,
  UserCheck,
  Sparkles,
  Send,
  Loader2,
  BrainCircuit
} from 'lucide-react';
import useThemeMode from '../hooks/useThemeMode';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CourseFallbackThumbnail from '../components/CourseFallbackThumbnail';

const CAT_COLORS = {
  "Social Science": { main: "#F97316", dark: "#C2410C", banner: "from-orange-500 to-red-600" }, 
  "Mathematics & Natural Science": { main: "#3B82F6", dark: "#1D4ED8", banner: "from-blue-600 to-indigo-700" }, 
  "Natural Language": { main: "#A855F7", dark: "#7E22CE", banner: "from-purple-600 to-pink-700" }, 
  "Programming & Technology": { main: "#6366F1", dark: "#4338CA", banner: "from-indigo-600 to-violet-700" }, 
  "Business & Entrepreneurship": { main: "#FFD700", dark: "#CA8A04", banner: "from-amber-400 to-amber-600" }, 
  "Personal Development": { main: "#22C55E", dark: "#15803D", banner: "from-emerald-500 to-teal-600" }
};

const DEFAULT_COLOR = { main: "#3b82f6", dark: "#2563eb", banner: "from-slate-600 to-slate-800" };

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

export default function CourseDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const isDarkMode = useThemeMode();

  const { data: course, isLoading: loadingCourse, error: courseError } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const { data } = await api.get(`/courses/${id}`);
      return data.course;
    }
  });

  const { data: enrollmentStatusData, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['courseStatus', id],
    queryFn: async () => {
      if (!user) return { status: 'none' };
      try {
        const { data } = await api.get(`/student/courses/${id}/status`);
        return data;
      } catch (err) {
        return { status: 'none' };
      }
    },
    enabled: !!user
  });

  const loading = loadingCourse;
  const error = courseError ? (courseError.response?.data?.message || courseError.message || 'Unknown error') : '';
  const enrollmentStatus = enrollmentStatusData?.status || 'none';

  const handleEnroll = async () => {
    if (!user) return navigate('/login');
    if (user.status === 'blocked') return alert('Your account is blocked.');
    setEnrolling(true);
    try {
      await api.post(`/student/courses/${id}/enroll`);
      refetchStatus();
      alert('Enrollment successful. You can now access the course materials.');
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const handleAskAi = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setLoadingAi(true);
    try {
      const { data } = await api.post(`/v2/intelligence/courses/${id}/qa`, {
        question: aiQuestion
      });
      if (data.success && data.data?.answer) {
        setAiAnswer(data.data.answer);
      } else {
        setAiAnswer('I could not find specific details for this question in the course curriculum. Try asking about the syllabus or prerequisites.');
      }
    } catch {
      setAiAnswer('The AI Course Assistant is currently ready to answer curriculum inquiries. Please ask about the modules, skills, or prerequisites.');
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-[calc(100vh-80px)] flex justify-center items-center transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-[#FAFAFA]'}`}>
        <div className={`w-16 h-16 border-4 rounded-full animate-spin ${isDarkMode ? 'border-white/10 border-t-[#00D4FF] shadow-[0_0_15px_rgba(0,212,255,0.2)]' : 'border-slate-200 border-t-[#00D4FF] shadow-[0_0_15px_rgba(0,212,255,0.1)]'}`}></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className={`min-h-[calc(100vh-80px)] flex justify-center items-center p-4 text-center transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120]' : 'bg-[#FAFAFA]'}`}>
        <div className={`p-10 border rounded-3xl shadow-xl backdrop-blur-xl max-w-md ${isDarkMode ? 'bg-[#1E293B]/60 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
           <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-[#00D4FF] drop-shadow-[0_0_15px_rgba(0,212,255,0.4)]" />
           <p className="font-black text-lg mb-6 leading-relaxed">{error || 'Data Not Found'}</p>
           <Link to="/courses" className="inline-flex items-center justify-center gap-2 font-bold transition-all px-8 py-3 rounded-full text-xs text-[#0f172a] bg-gradient-to-r from-[#00D4FF] to-[#00b0d8] hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]">
             <ArrowLeft className="w-4 h-4" /> Back to Catalog
           </Link>
        </div>
      </div>
    );
  }

  const isEnrolled = enrollmentStatus === 'active';
  const totalDuration = course.lessons?.length ? course.lessons.length * 15 : 0;

  const normalized = normalizeCategory(course.mainCategory || course.category);
  const catInfo = CAT_COLORS[normalized] || DEFAULT_COLOR;
  const contrastTextColor = catInfo.main === "#FFD700" ? "#0F172A" : "#FFFFFF";
  const IconComponent = CAT_ICONS[normalized] || BookOpen;

  return (
    <div className={`min-h-[calc(100vh-80px)] w-full font-sans pb-20 relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#0B1120] text-slate-100' : 'bg-[#FAFAFA] text-slate-800'}`}>
      
      {/* Hero Section */}
      <div className="relative z-10 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <Link to="/courses" className={`inline-flex items-center justify-center min-w-[140px] gap-2 font-bold transition-colors px-8 py-2.5 rounded-full border shadow-md text-white bg-[#1e48bc] hover:bg-[#295ce8] border-transparent mb-10`}>
            <ArrowLeft className="w-4 h-4" /> Back to Catalog
          </Link>

          <div className="flex flex-col lg:flex-row gap-16 lg:items-center">
              {/* Left Hero */}
             <div className="lg:w-7/12">
                 <div className="mb-4 flex flex-wrap items-center gap-2 font-black text-[10px] sm:text-xs" style={{ color: catInfo.main }}>
                    <span>{course.mainCategory || 'SaaS Application'}</span>
                    {course.subCategory && (
                      <>
                         <ChevronRight className="w-4 h-4" style={{ color: `${catInfo.main}60` }} />
                         <span>{course.subCategory}</span>
                      </>
                    )}
                 </div>
                 <h1 
                   className="text-5xl md:text-7xl font-black mb-6 leading-tight text-transparent bg-clip-text drop-shadow-[0_0_20px_rgba(0,0,0,0.15)]"
                   style={{
                     backgroundImage: isDarkMode 
                       ? `linear-gradient(to right, #FFFFFF, #F1F5F9, ${catInfo.main})` 
                       : `linear-gradient(to right, #0F172A, #334155, ${catInfo.main})`
                   }}
                 >
                   {course.title}
                 </h1>
                 <p className={`text-lg md:text-xl font-medium leading-relaxed max-w-2xl mb-10 border-l-2 pl-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} style={{ borderColor: `${catInfo.main}80` }}>
                    {course.description}
                 </p>
                 <div className={`flex flex-wrap items-center gap-8 text-xs font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5" style={{ color: catInfo.main }} />
                      Instructor: <span className={`ml-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.instructor?.name || 'Kenenisa'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MonitorPlay className="w-5 h-5" style={{ color: catInfo.main }} />
                      Delivery: <span className={`ml-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hybrid / Online</span>
                    </div>
                 </div></div>

             {/* Right Hero (Floating Mockup Container) */}
             <div className="hidden lg:block lg:w-5/12">
                 <div className="relative group w-full transition-transform duration-500 hover:-translate-y-2">
                     <div className={`relative border rounded-2xl p-4 shadow-2xl ${isDarkMode ? 'border-white/10 bg-[#151a26]/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
                        <div 
                          className="w-full aspect-[4/3] relative overflow-hidden rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: '#030303' }}
                        >
                          {course.thumbnail && course.thumbnail !== 'default-course.jpg' ? (
                            <img 
                              src={course.thumbnail.startsWith('http') ? course.thumbnail : `http://localhost:5000${course.thumbnail.startsWith('/') ? '' : '/'}${course.thumbnail}`} 
                              alt="Course Preview" 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                            />
                          ) : (
                            <CourseFallbackThumbnail 
                              color={catInfo.main} 
                              darkColor={catInfo.dark || catInfo.main} 
                              ribbon={course.mainCategory} 
                              fallbackId={course.id} 
                            />
                          )}

                          {/* Status Badge in lowercase pill border shape */}
                          <div className="absolute top-4 right-4 z-20">
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-normal text-white border border-white/40 bg-white/10 backdrop-blur-md">
                              {(course.status || 'published').toLowerCase()}
                            </span>
                          </div>
                        </div>
                     </div>
                 </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content & Sidebar Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 relative z-10 pb-20">
        <div className="flex flex-col lg:flex-row gap-12">
           
           {/* Primary Content Column */}
           <div className="w-full lg:w-7/12">
              
              {/* Tab Navigation Navigation */}
              <div className="flex overflow-x-auto scrollbar-hide mb-12 gap-4">
                 {['Overview', 'Curriculum', 'AI Assistant', 'Instructor'].map(tabLabel => {
                    const tab = tabLabel.toLowerCase().replace(' ', '-');
                    return (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 min-w-fit py-4 px-8 font-black text-sm transition-all duration-300 rounded-2xl whitespace-nowrap border tracking-wide uppercase ${
                        activeTab === tab 
                        ? 'scale-[1.02]' 
                        : (isDarkMode ? 'border-white/5 bg-[#0B1120]/60 text-slate-400 hover:border-white/20 hover:text-white hover:bg-[#0B1120]/80' : 'border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:text-slate-800 hover:bg-white')
                      }`}
                      style={activeTab === tab ? {
                        borderColor: `${catInfo.main}50`,
                        backgroundColor: `${catInfo.main}15`,
                        color: catInfo.main,
                        boxShadow: `0 0 25px ${catInfo.main}20`
                      } : {}}
                    >
                      {tabLabel}
                    </button>
                    );
                 })}
              </div>

              {/* Tab: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-12 animate-in fade-in duration-500 slide-in-from-bottom-4">
                  <div className={`relative p-[1px] rounded-3xl bg-gradient-to-b ${isDarkMode ? 'from-slate-800' : 'from-slate-200'} to-transparent shadow-lg`}>
                     <div className={`backdrop-blur-2xl p-10 md:p-14 rounded-3xl h-full border ${isDarkMode ? 'bg-[#0B1120]/90 border-white/5' : 'bg-white/95 border-slate-100'}`}>
                        <h2 className={`text-3xl font-black mb-8 flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                           <FileText className="w-8 h-8" style={{ color: catInfo.main }} /> 
                           Program Details
                        </h2>
                        <div className={`prose max-w-none text-base md:text-lg leading-loose whitespace-pre-wrap font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {course.description}
                        </div>
                     </div>
                  </div>

                  <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-transparent to-transparent shadow-lg">
                     <div className={`backdrop-blur-2xl p-10 md:p-14 rounded-3xl h-full border relative overflow-hidden ${isDarkMode ? 'bg-[#0B1120]/90 text-white border-white/5' : 'bg-white/95 text-slate-900 border-slate-100'}`} style={{ borderTopColor: `${catInfo.main}40` }}>
                        <h3 className="text-3xl font-black flex items-center gap-4 mb-10 relative z-10">
                          <CheckCircle className="w-8 h-8" style={{ color: catInfo.main }} /> 
                          What You'll Learn
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                           {[
                             'Understand core industry-standard methodologies.',
                             'Build and deploy production-ready projects.',
                             'Analyze performance metrics with modern tooling.',
                             'Receive a formalized digital certification upon passing.',
                           ].map((point, i) => (
                              <div key={i} className={`flex gap-4 group ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                 <ChevronRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" style={{ color: catInfo.main }} />
                                 <span className="font-bold text-sm leading-relaxed">{point}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* Tab: Curriculum */}
              {activeTab === 'curriculum' && (
                <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-transparent to-transparent animate-in fade-in duration-500 slide-in-from-bottom-4 shadow-lg">
                  <div className={`backdrop-blur-2xl p-10 md:p-14 rounded-3xl shadow-xl border ${isDarkMode ? 'bg-[#0B1120]/90 border-white/5' : 'bg-white/95 border-slate-200'}`} style={{ borderTopColor: `${catInfo.main}40` }}>
                     <div className="flex items-center justify-between mb-12">
                        <h2 className={`text-3xl font-black flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                           <BookOpen className="w-8 h-8" style={{ color: catInfo.main }} /> 
                           Syllabus
                        </h2>
                        <div className="text-[10px] font-black px-4 py-2 rounded-full border shadow-sm" style={{ color: catInfo.main, backgroundColor: `${catInfo.main}15`, borderColor: `${catInfo.main}30` }}>
                          {course.lessons?.length || 0} Modules
                        </div>
                     </div>

                     <div className="space-y-8">
                       {course.lessons && course.lessons.length > 0 ? (
                         (() => {
                           const phases = [...new Set(course.lessons.map(l => l.phase || 'General Content'))];
                           return phases.map((phase, pIdx) => {
                             const phaseLessons = course.lessons.filter(l => (l.phase || 'General Content') === phase);
                             return (
                                <div key={pIdx} className="space-y-6">
                                 <h3 className="text-2xl font-black border-b pb-4 mb-8" style={{ color: catInfo.main, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>{phase}</h3>
                                 {phaseLessons.map((lesson) => (
                                   <div key={lesson.id} className={`w-full border rounded-3xl p-6 transition-all flex flex-col md:flex-row gap-8 items-start md:items-center group ${isDarkMode ? 'bg-[#0B1120]/60 border-white/5 hover:bg-[#0B1120]' : 'bg-slate-50 border-slate-200 hover:bg-white shadow-sm'}`} style={{ borderLeftColor: catInfo.main, borderLeftWidth: '4px' }}>
                                      <div className={`shrink-0 w-24 h-24 rounded-2xl border flex flex-col items-center justify-center p-2 shadow-inner transition-colors ${isDarkMode ? 'bg-[#05070A] border-white/10' : 'bg-white border-slate-200'}`}>
                                         <span className="text-xs font-black text-slate-500 mb-1 uppercase tracking-wider">Module</span>
                                         <span className="text-3xl font-black leading-none" style={{ color: catInfo.main }}>{course.lessons.findIndex(l => l.id === lesson.id) + 1}</span>
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                         <h4 className={`font-bold text-xl leading-tight mb-3 transition-colors tracking-tight ${isDarkMode ? 'text-white group-hover:text-indigo-300' : 'text-slate-800 group-hover:text-indigo-600'}`}>{lesson.title}</h4>
                                         <div className={`flex flex-wrap items-center gap-3 text-xs font-black ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                           <span className="flex items-center gap-1.5"><PlayCircle className="w-3 h-3" style={{ color: catInfo.main }} /> {lesson.duration}m Video</span>
                                           {lesson.readingMaterials && <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" style={{ color: catInfo.main }} /> Docs</span>}
                                           {lesson.quiz?.length > 0 && <span className="flex items-center gap-1.5"><BadgeAlert className="w-3 h-3 text-rose-500" /> Audit</span>}
                                         </div>
                                      </div>

                                      <div className={`shrink-0 hidden md:flex items-center justify-center p-3 rounded-full border ${isDarkMode ? 'border-white/5 bg-[#0B1221] text-slate-400' : 'border-slate-200 bg-white text-slate-400'}`}>
                                         {isEnrolled ? <Unlock className="w-5 h-5 text-emerald-500" /> : <Lock className="w-5 h-5" />}
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             );
                           });
                         })()
                       ) : (
                         <p className={`text-center py-12 font-black border border-dashed rounded-2xl bg-[#0B1120]/30 ${isDarkMode ? 'text-slate-400 border-white/10' : 'text-slate-500 border-slate-200'}`}>System modules currently under construction.</p>
                       )}
                     </div>
                  </div>
                </div>
              )}

               {/* Tab: AI Assistant */}
               {activeTab === 'ai-assistant' && (
                 <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-transparent to-transparent animate-in fade-in duration-500 slide-in-from-bottom-4 shadow-lg">
                   <div className={`backdrop-blur-2xl p-10 md:p-14 rounded-3xl border shadow-xl ${isDarkMode ? 'bg-[#0B1120]/90 border-white/5' : 'bg-white/95 border-slate-200'}`} style={{ borderTopColor: `${catInfo.main}40` }}>
                     <div className="flex items-center justify-between mb-8">
                       <div>
                         <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] mb-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                           <BrainCircuit className="h-3.5 w-3.5" />
                           Course Intelligence Q&A
                         </div>
                         <h2 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                           Grounded Course Assistant
                         </h2>
                         <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                           Ask any questions about this course's syllabus, prerequisites, and learning outcomes.
                         </p>
                       </div>
                     </div>

                     <form onSubmit={handleAskAi} className="space-y-4 mb-8">
                       <div className="relative">
                         <input
                           type="text"
                           placeholder="e.g. What prerequisites do I need? What will I build in Module 3?"
                           value={aiQuestion}
                           onChange={(e) => setAiQuestion(e.target.value)}
                           className={`w-full px-5 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 pr-24 ${isDarkMode ? 'bg-[#05070A] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                         />
                         <button
                           type="submit"
                           disabled={loadingAi}
                           className="absolute right-2.5 top-2.5 bottom-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-600 text-white transition-all flex items-center gap-1.5"
                         >
                           {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                           Ask
                         </button>
                       </div>
                     </form>

                     {aiAnswer && (
                       <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-200' : 'bg-cyan-50 border-cyan-200 text-slate-800'}`}>
                         <div className="flex items-center gap-2 font-bold text-sm text-cyan-400 mb-2">
                           <Sparkles className="w-4 h-4" /> AI Assistant Response:
                         </div>
                         <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
                       </div>
                     )}
                   </div>
                 </div>
               )}

              {/* Tab: Instructor */}
              {activeTab === 'instructor' && (
                <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-transparent to-transparent animate-in fade-in duration-500 slide-in-from-bottom-4 shadow-lg">
                  <div className={`backdrop-blur-2xl p-10 md:p-14 rounded-3xl flex flex-col md:flex-row items-center gap-12 text-center md:text-left border shadow-xl ${isDarkMode ? 'bg-[#0B1120]/90 border-white/5' : 'bg-white/95 border-slate-200'}`} style={{ borderTopColor: `${catInfo.main}40` }}>
                     <div className={`w-40 h-40 rounded-full overflow-hidden shrink-0 border-4 shadow-lg ${isDarkMode ? 'bg-[#05070A]' : 'bg-slate-100'}`} style={{ borderColor: catInfo.main }}>
                       <img src="https://ui-avatars.com/api/?name=Instructor&background=0B1120&color=FFFFFF" alt="Instructor" className="w-full h-full object-cover" />
                     </div>
                     <div>
                       <h2 className={`text-4xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{course.instructor?.name || 'Kenenisa'}</h2>
                       <p className="font-black text-xs mb-6 inline-block px-4 py-1.5 rounded-full border" style={{ color: catInfo.main, backgroundColor: `${catInfo.main}15`, borderColor: `${catInfo.main}30` }}>Lead Authority</p>
                       <p className={`font-medium leading-loose max-w-lg mx-auto md:mx-0 text-sm md:text-base ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          Instructor is a certified professional with extensive verifiable experience in building out large-scale technical systems and leading dynamic teams across the globe.
                       </p>
                     </div>
                  </div>
                </div>
              )}
           </div>

           {/* Sticky Interaction Sidebar (Order Box) */}
           <div className="w-full lg:w-5/12 lg:-mt-24 z-20">
               <div className="relative p-[1px] rounded-[32px] shadow-lg sticky top-32 border border-slate-200/50">
                  <div className={`p-8 lg:p-12 relative overflow-hidden rounded-[32px] border ${isDarkMode ? 'bg-[#0B1221]/95 border-white/10' : 'bg-white/95 border-slate-200 shadow-xl'}`}>
                     <div className={`text-center mb-8 border-b pb-8 relative z-10 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                       <h3 className={`font-black text-[11px] mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Program Value</h3>
                       <div className="text-5xl font-black drop-shadow-[0_0_15px_rgba(0,0,0,0.15)]" style={{ color: catInfo.main }}>
                         ETB {course.price || '4.94'}
                       </div>
                    </div>

                    <div className="space-y-6 mb-10 relative z-10">
                       <div className={`flex justify-between items-center text-xs font-black border-b pb-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <span className={`flex items-center gap-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><Clock className="w-4 h-4" style={{ color: catInfo.main }}/> Duration</span>
                          <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{totalDuration} Mins Runtime</span>
                       </div>
                       <div className={`flex justify-between items-center text-xs font-black border-b pb-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <span className={`flex items-center gap-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><BookOpen className="w-4 h-4" style={{ color: catInfo.main }}/> Syllabus Length</span>
                          <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{course.lessons?.length || 0} Modules</span>
                       </div>
                       <div className={`flex justify-between items-center text-xs font-black border-b pb-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <span className={`flex items-center gap-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}><MapPin className="w-4 h-4" style={{ color: catInfo.main }}/> Location</span>
                          <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>Global Digital</span>
                       </div>
                    </div>

                    {/* Action Button Logic */}
                    <div className="relative z-10 block">
                        {enrollmentStatus === 'active' ? (
                          <div className="space-y-4">
                            <Link 
                              to={`/lesson/${course.lessons[0]?.id}?courseId=${course.id}`}
                              className="w-full relative z-10 flex items-center justify-center font-black py-5 rounded-full hover:scale-[1.03] transition-all text-sm shadow-md"
                              style={{
                                backgroundColor: catInfo.main,
                                color: contrastTextColor,
                                boxShadow: `0 8px 25px -4px ${catInfo.main}50`
                              }}
                            >
                              Start Learning
                            </Link>
                            <Link 
                              to={`/dashboard/live-classes`}
                              className="w-full relative z-10 flex items-center justify-center font-black py-5 rounded-full hover:scale-[1.03] transition-all text-sm border"
                              style={{
                                borderColor: `${catInfo.main}50`,
                                backgroundColor: `${catInfo.main}15`,
                                color: catInfo.main
                              }}
                            >
                              <Video className="w-4 h-4 mr-2" /> Live Sessions
                            </Link>
                          </div>
                        ) : enrollmentStatus === 'pending' ? (
                          <div className="w-full relative z-10 flex items-center justify-center gap-3 border font-black py-5 rounded-2xl opacity-90 cursor-wait text-sm"
                            style={{
                              backgroundColor: `${catInfo.main}10`,
                              color: catInfo.main,
                              borderColor: `${catInfo.main}30`,
                              boxShadow: `inset 0 0 20px ${catInfo.main}10`
                            }}
                          >
                            <Clock className="w-5 h-5" /> Pending Approval
                          </div>
                        ) : enrollmentStatus === 'rejected' ? (
                          <div className="space-y-4">
                            <div className="w-full relative z-10 flex items-center justify-center gap-3 bg-rose-500/10 text-rose-500 border border-rose-500/30 font-black py-5 rounded-2xl cursor-not-allowed shadow-[inset_0_0_20px_rgba(244,63,94,0.1)] text-sm">
                              Access Denied
                            </div>
                            {enrollmentStatusData?.rejectionReason && (
                              <div className={`p-5 rounded-2xl border flex flex-col gap-2 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 ${isDarkMode ? 'border-rose-500/20 bg-rose-500/5' : 'border-rose-200 bg-rose-50/50'}`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-[30px] pointer-events-none"></div>
                                <div className="flex items-center gap-2 text-xs font-black text-rose-500">
                                  <BadgeAlert className="w-4 h-4" /> Rejection Reason:
                                </div>
                                <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {enrollmentStatusData.rejectionReason}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={handleEnroll}
                            disabled={enrolling}
                            className="w-full flex items-center justify-center gap-3 border font-semibold py-5 rounded-full transition-all disabled:opacity-50 hover:scale-[1.03] text-sm group shadow-md"
                            style={{
                              backgroundColor: `${catInfo.main}15`,
                              borderColor: catInfo.main,
                              color: catInfo.main,
                              boxShadow: `0 8px 25px -4px ${catInfo.main}20`
                            }}
                          >
                            {enrolling ? 'Processing...' : 'Enroll Now'}
                            <span className="flex items-center justify-center w-6 h-6 rounded-full border border-current ml-1.5 transition-colors">
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </button>
                        )}
                    </div>

                    <div className="mt-8 text-center relative z-10">
                      <p className="text-[10px]  font-black text-slate-500 tracking-[0.2em] relative before:absolute before:left-0 before:top-1/2 before:w-10 before:h-[1px] before:bg-slate-600 after:absolute after:right-0 after:top-1/2 after:w-10 after:h-[1px] after:bg-slate-600 px-12">
                         Guaranteed Encrypted Processing
                      </p>
                    </div>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
