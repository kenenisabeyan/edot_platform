import React, { useState, useRef, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'markdown-to-jsx';
import { 
  Briefcase, Send, Bot, User, Loader2, Sparkles, 
  Target, Award, FileText, CheckCircle2, ChevronRight, 
  AlertCircle, RefreshCw, BarChart2, Star, TrendingUp, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CareerCenter() {
  const isDarkMode = useThemeMode();
  const [activeTab, setActiveTab] = useState('advisor');
  const [isLoading, setIsLoading] = useState(false);

  const baseCardStyle = isDarkMode 
    ? 'bg-[#0F172A]/85 border-white/10 text-white shadow-xl shadow-black/30' 
    : 'bg-white border-slate-200 text-slate-800 shadow-lg shadow-slate-100/50';

  const goldText = isDarkMode ? 'text-amber-400' : 'text-amber-600';
  const goldBg = isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200';
  const goldBtn = 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20';

  // ==================== 1. CAREER ADVISOR STATE & HANDLERS ====================
  const [careerGoal, setCareerGoal] = useState('');
  const [currentSkills, setCurrentSkills] = useState('');
  const [advisorOutput, setAdvisorOutput] = useState('');

  const handleGetRoadmap = async (e) => {
    e.preventDefault();
    if (!careerGoal.trim()) {
      toast.error('Please enter a target career goal.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/career-advisor', {
        careerGoal,
        currentSkills
      });

      if (data.success) {
        setAdvisorOutput(data.advice);
        toast.success('Your personalized career roadmap is ready!');
      } else {
        toast.error('Failed to generate roadmap.');
      }
    } catch (error) {
      console.error('Advisor Error:', error);
      toast.error('Roadmap generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 2. RESUME ANALYZER STATE & HANDLERS ====================
  const [resumeText, setResumeText] = useState('');
  const [resumeTargetRole, setResumeTargetRole] = useState('');
  const [resumeAnalysis, setResumeAnalysis] = useState('');
  const [atsScore, setAtsScore] = useState(null);

  const handleAnalyzeResume = async (e) => {
    e.preventDefault();
    if (!resumeText.trim() || !resumeTargetRole.trim()) {
      toast.error('Please enter both resume text and target role.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/ai/resume-analyzer', {
        resumeText,
        targetRole: resumeTargetRole
      });

      if (data.success) {
        setResumeAnalysis(data.analysis);
        
        // Extract ATS score from the generated response markdown (e.g. search for numbers inside score header)
        const match = data.analysis.match(/Score[^\d]*(\d+)/i) || data.analysis.match(/Rating[^\d]*(\d+)/i) || data.analysis.match(/(\d+)\s*\/\s*100/);
        const score = match ? parseInt(match[1]) : 75;
        setAtsScore(score);
        
        toast.success('Resume parsing complete!');
      } else {
        toast.error('Failed to parse resume.');
      }
    } catch (error) {
      console.error('Analyzer Error:', error);
      toast.error('Resume analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 3. INTERVIEW COACH STATE & HANDLERS ====================
  const [interviewRole, setInterviewRole] = useState('');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartInterview = async (e) => {
    e.preventDefault();
    if (!interviewRole.trim()) {
      toast.error('Please enter the role you are preparing for.');
      return;
    }

    setIsLoading(true);
    try {
      const initialGreeting = `Hello candidate! Thanks for taking the time to interview today for the **${interviewRole}** position. Let's start with a basic introduction: can you tell me a little bit about yourself and why you're interested in this role?`;
      setMessages([{ role: 'assistant', content: initialGreeting }]);
      setInterviewStarted(true);
      toast.success('Mock interview initialized!');
    } catch (error) {
      toast.error('Failed to initialize interview coach.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResponse = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data } = await api.post('/ai/interview-coach', {
        role: interviewRole,
        history: messages,
        message: userMessage
      });

      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        toast.error('Failed to fetch evaluation response.');
      }
    } catch (error) {
      console.error('Coach Error:', error);
      toast.error('Response failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetCoach = () => {
    setInterviewStarted(false);
    setMessages([]);
    setInterviewRole('');
  };

  return (
    <div className="space-y-8 max-w-none w-full pb-10">
      
      {/* Header Banner */}
      <div className={`rounded-[2rem] p-8 md:p-10 relative overflow-hidden backdrop-blur-2xl border ${isDarkMode ? 'bg-[#0B1120]/45 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.35)]' : 'bg-white/60 border-slate-200 shadow-sm'}`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#00D4FF]/10 to-transparent rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
          <div>
            <h1 className={`text-3xl md:text-4xl font-black flex items-center gap-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <Briefcase className={`w-8 h-8 ${goldText}`} />
              Career Development Center
            </h1>
            <p className={`text-sm font-semibold mt-2 max-w-2xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Accelerate your transition from student to industry professional. Get tailored career advice, test resumes with ATS engines, and run interactive mock interviews.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#00D4FF]/5 w-max max-w-full">
        {[
          { id: 'advisor', label: 'Career Advisor AI', icon: Target },
          { id: 'resume', label: 'Resume Analyzer', icon: FileText },
          { id: 'coach', label: 'Interview Coach', icon: MessageSquare }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); handleResetCoach(); setAtsScore(null); setResumeAnalysis(''); setAdvisorOutput(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab.id
                ? isDarkMode
                  ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                  : 'bg-amber-500 text-white font-black shadow-lg shadow-amber-500/20'
                : isDarkMode
                  ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                  : 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Left Input/Output Column */}
        <div className="xl:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* Tab 1: CAREER ADVISOR */}
            {activeTab === 'advisor' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Target className={`w-5 h-5 ${goldText}`} /> Career Path Advisor
                </h3>

                <form onSubmit={handleGetRoadmap} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Career Goal</label>
                      <input 
                        type="text" 
                        placeholder="e.g. React Web Developer, Data Scientist, Product Manager"
                        value={careerGoal}
                        onChange={(e) => setCareerGoal(e.target.value)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Current Skills / Background</label>
                      <input 
                        type="text" 
                        placeholder="e.g. HTML, CSS, basic Python, high school physics"
                        value={currentSkills}
                        onChange={(e) => setCurrentSkills(e.target.value)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Map Out My Career Path'}
                  </button>
                </form>

                {advisorOutput && (
                  <div className={`p-6 md:p-8 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
                    <div className="flex justify-between items-center border-b pb-3 border-white/10 mb-4">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1"><Sparkles className="w-4 h-4" /> AI Generated Path Roadmap</span>
                    </div>
                    <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Markdown
                        options={{
                          overrides: {
                            h1: { component: 'h1', props: { className: 'text-xl font-bold my-4 text-amber-500' } },
                            h2: { component: 'h2', props: { className: 'text-base font-bold my-3 text-amber-500' } },
                            h3: { component: 'h3', props: { className: 'text-sm font-bold my-2 text-amber-500' } },
                            p: { component: 'p', props: { className: 'mb-3' } },
                            ul: { component: 'ul', props: { className: 'list-disc pl-5 mb-3 space-y-1' } },
                            li: { component: 'li', props: { className: 'my-0.5' } }
                          }
                        }}
                      >
                        {advisorOutput}
                      </Markdown>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 2: RESUME ANALYZER */}
            {activeTab === 'resume' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <FileText className={`w-5 h-5 ${goldText}`} /> Resume Parser & ATS Grader
                </h3>

                <form onSubmit={handleAnalyzeResume} className="space-y-4 mb-8">
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Job Role</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Junior Web Developer, Product Design Intern"
                      value={resumeTargetRole}
                      onChange={(e) => setResumeTargetRole(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Paste Resume / CV Details</label>
                    <textarea 
                      rows={8}
                      placeholder="Copy and paste the plain text of your resume here..."
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Evaluate Resume With ATS'}
                  </button>
                </form>

                {resumeAnalysis && (
                  <div className="space-y-6">
                    {atsScore !== null && (
                      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-3xl border border-white/10 bg-[#1E293B]/40">
                        {/* Circular Progress for ATS Match Score */}
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke={isDarkMode ? '#0B1120' : '#E2E8F0'} strokeWidth="8" fill="transparent" />
                            <circle 
                              cx="50" cy="50" r="40" 
                              stroke={atsScore >= 80 ? '#10B981' : atsScore >= 60 ? '#F59E0B' : '#EF4444'} 
                              strokeWidth="8" fill="transparent" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 40} strokeDashoffset={(2 * Math.PI * 40) - (atsScore / 100) * (2 * Math.PI * 40)}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                            <span className="text-2xl font-black">{atsScore}%</span>
                            <span className="text-[8px] font-black uppercase text-slate-400">Match</span>
                          </div>
                        </div>
                        <div className="text-left space-y-1">
                          <h4 className="font-bold text-sm">ATS Score Grading</h4>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {atsScore >= 80 
                              ? 'Excellent! Your resume matches the job profile requirements. Make final adjustments and apply!' 
                              : atsScore >= 60 
                              ? 'Good start, but missing several crucial industry keywords. Complete suggestions below to increase interview chances.'
                              : 'Poor score. Missing core skillsets or project descriptors. Follow guidance to rebuild resume.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className={`p-6 md:p-8 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900 border-white/5' : 'bg-slate-50 border-slate-100 shadow-inner'}`}>
                      <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        <Markdown
                          options={{
                            overrides: {
                              h1: { component: 'h1', props: { className: 'text-xl font-bold my-4 text-amber-500' } },
                              h2: { component: 'h2', props: { className: 'text-base font-bold my-3 text-amber-500' } },
                              h3: { component: 'h3', props: { className: 'text-sm font-bold my-2 text-amber-500' } },
                              p: { component: 'p', props: { className: 'mb-3' } },
                              ul: { component: 'ul', props: { className: 'list-disc pl-5 mb-3 space-y-1' } },
                              li: { component: 'li', props: { className: 'my-0.5' } }
                            }
                          }}
                        >
                          {resumeAnalysis}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 3: INTERVIEW COACH */}
            {activeTab === 'coach' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-[2.5rem] border p-6 md:p-8 flex flex-col ${baseCardStyle}`}
              >
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className={`w-5 h-5 ${goldText}`} /> AI Interactive Interview Coach
                </h3>

                {!interviewStarted ? (
                  <form onSubmit={handleStartInterview} className="space-y-4">
                    <div>
                      <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Interview Role</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Frontend React Engineer, Marketing Intern"
                        value={interviewRole}
                        onChange={(e) => setInterviewRole(e.target.value)}
                        className={`w-full px-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isDarkMode ? 'bg-[#121A2F] text-white border-white/10' : 'bg-slate-50 text-slate-800 border-slate-200'}`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${goldBtn} flex items-center gap-2`}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Begin Mock Interview'}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col h-[520px] max-h-[70vh] border border-white/10 rounded-[2rem] overflow-hidden bg-slate-900/30">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/20">
                      <div>
                        <h4 className="font-bold text-xs">Interview Prep: {interviewRole}</h4>
                        <span className="text-[10px] text-emerald-400 animate-pulse flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Session</span>
                      </div>
                      <button 
                        onClick={handleResetCoach}
                        className={`px-3 py-1.5 border border-white/10 rounded-xl text-[10px] font-bold uppercase transition-colors text-rose-400 hover:bg-rose-500/10`}
                      >
                        Reset / End Session
                      </button>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${msg.role === 'user' ? 'bg-[#00D4FF] border-[#00D4FF]/25 text-white' : 'bg-white border-slate-200'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-slate-800" />}
                          </div>
                          
                          <div className={`p-4 rounded-2xl max-w-[80%] text-xs shadow-md ${
                            msg.role === 'user'
                              ? 'bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-tr-sm'
                              : 'bg-[#1E293B]/70 border border-white/5 text-slate-200 rounded-tl-sm'
                          }`}>
                            <Markdown
                              options={{
                                overrides: {
                                  h1: { component: 'h1', props: { className: 'text-sm font-bold text-amber-500 my-2' } },
                                  h2: { component: 'h2', props: { className: 'text-xs font-bold text-amber-500 my-1' } },
                                  p: { component: 'p', props: { className: 'leading-relaxed mb-1.5 last:mb-0' } }
                                }
                              }}
                            >
                              {msg.content}
                            </Markdown>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex gap-3 items-start flex-row">
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                            <Bot size={14} className="text-slate-800" />
                          </div>
                          <div className="p-4 rounded-2xl bg-[#1E293B]/40 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin text-amber-500" /> Analyzing response...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Form */}
                    <form onSubmit={handleSendResponse} className="p-3 border-t border-white/10 bg-slate-950/20 flex gap-2">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your answer, or say 'Done' to finalize assessment..."
                        className="flex-1 px-4 py-3 rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-900 border border-white/10 text-white placeholder-slate-500"
                      />
                      <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isLoading}
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={14} />
                      </button>
                    </form>

                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Right Sidebar - Careers Directory */}
        <div className="space-y-6">
          
          {/* Active Recall Tip Card */}
          <div className={`p-6 rounded-[2rem] border relative overflow-hidden ${isDarkMode ? 'bg-[#1e293b]/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <h5 className="font-bold text-xs uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Career Growth Tips
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
              Did you know? Job postings average 250 resumes, and ATS systems filters out 75% of applicants before a human recruiter reads them. Use our resume parser to verify your match score!
            </p>
          </div>

          {/* Gamification Streak Hook */}
          <div className={`p-6 rounded-[2rem] border relative overflow-hidden ${isDarkMode ? 'bg-[#1e293b]/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
            <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Career Badges Unlocked
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
              Take mock interviews to earn +50 XP and unlock the **"Polished Professional"** milestone badge!
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
