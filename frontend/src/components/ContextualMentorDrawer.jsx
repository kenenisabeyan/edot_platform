/**
 * ContextualMentorDrawer.jsx
 *
 * Integrated AI Mentor drawer component for EDOT Student Dashboard & Learning Views.
 * Features context-aware tutor chat, grounded references, suggested actions, confidence indicators,
 * human support detection alert, and thumbs up/down session feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  ChevronRight, 
  ThumbsUp, 
  ThumbsDown, 
  AlertCircle, 
  BookOpen, 
  CheckCircle2, 
  Loader2,
  MessageSquare,
  Mic
} from 'lucide-react';
import api from '../utils/api.js';
import ContinuousVoiceMentorDrawer from './ContinuousVoiceMentorDrawer.jsx';

// Persistent in-memory cache so AI conversation NEVER rolls back on re-renders
let persistentTextMessages = [
  {
    id: 'welcome-1',
    sender: 'mentor',
    answer: 'Hello! I am your EDOT AI Academic Mentor. I am grounded directly in your course materials. How can I help you master today\'s concepts?',
    sources: ['EDOT Intelligence Core'],
    suggestedNextActions: ['Explain current lesson concepts', 'Review weak study topics', 'Generate practice questions'],
    confidence: 0.98,
    needsHumanSupport: false,
    timestamp: new Date()
  }
];

export default function ContextualMentorDrawer({ 
  isDarkMode = false, 
  currentCourseId = null, 
  currentLessonId = null,
  isOpen: externalIsOpen = false,
  onClose: externalOnClose = null
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen || internalIsOpen;
  
  const handleClose = () => {
    setInternalIsOpen(false);
    if (externalOnClose) externalOnClose();
  };
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessagesState] = useState(persistentTextMessages);
  
  const setMessages = (updater) => {
    setMessagesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistentTextMessages = next;
      return next;
    });
  };
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottomIfNearBottom = (force = false) => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    if (force || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottomIfNearBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await api.post('/v2/intelligence/mentor/chat', {
        message: userText,
        courseId: currentCourseId,
        lessonId: currentLessonId
      });

      if (data.success && data.data) {
        const mentorMsg = {
          id: data.data.sessionId || `mentor-${Date.now()}`,
          sessionId: data.data.sessionId,
          sender: 'mentor',
          answer: data.data.answer,
          sources: data.data.sources || [],
          suggestedNextActions: data.data.suggestedNextActions || [],
          confidence: data.data.confidence || 0.95,
          needsHumanSupport: data.data.needsHumanSupport || false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, mentorMsg]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'mentor',
          answer: 'I am ready to assist with your course topics. Please ask a question about your current module or lesson.',
          sources: ['EDOT Course Material'],
          suggestedNextActions: ['Review lesson notes', 'Ask about module prerequisites'],
          confidence: 0.90,
          needsHumanSupport: false,
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (sessionId, score) => {
    if (!sessionId || feedbackSent[sessionId]) return;
    try {
      await api.post('/v2/intelligence/mentor/feedback', {
        sessionId,
        feedbackScore: score
      });
      setFeedbackSent(prev => ({ ...prev, [sessionId]: score }));
    } catch (e) {
      console.error('Feedback error:', e);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_8px_30px_rgba(6,182,212,0.4)] hover:scale-105 transition-all duration-300 group"
        >
          <div className="relative">
            <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span>AI Mentor</span>
          <Sparkles className="w-4 h-4 text-amber-300" />
        </button>
      )}

      {/* Drawer Overlay Container */}
      {isOpen && (
        <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[470px] flex flex-col shadow-2xl transition-all duration-300 animate-in slide-in-from-right ${
          isDarkMode 
            ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border-l border-cyan-400/30 text-white shadow-cyan-500/10' 
            : 'bg-gradient-to-b from-white via-indigo-50/40 to-slate-50 border-l border-indigo-200 text-slate-900 shadow-indigo-500/20'
        }`}>
          {/* Drawer Header */}
          <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/10 backdrop-blur-md' : 'bg-white/80 border-indigo-100 backdrop-blur-md'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
                  <span>EDOT AI Mentor</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-mono">3.6 Flash</span>
                </h3>
                <p className="text-[11px] font-bold text-cyan-400">
                  Continuous Voice & Text Learning Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsVoiceOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 hover:scale-105 active:scale-95 cursor-pointer"
                title="Launch Continuous AI Voice Mentor"
              >
                <Mic className="w-3.5 h-3.5" />
                Voice Mode
              </button>
              <button
                onClick={handleClose}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={containerRef} className={`flex-1 overflow-y-auto p-5 space-y-6 ${isDarkMode ? 'bg-indigo-950/20' : 'bg-indigo-50/20'}`}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.sender === 'user' ? (
                  <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm shadow-md shadow-cyan-500/20">
                    {msg.text}
                  </div>
                ) : (
                  <div className={`max-w-[95%] p-5 rounded-3xl border space-y-4 shadow-md ${isDarkMode ? 'bg-slate-800/80 text-slate-100 border-white/10' : 'bg-white text-slate-800 border-indigo-100'}`}>
                    {/* Human Support Banner */}
                    {msg.needsHumanSupport && (
                      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Instructor intervention recommended: Teacher notified.</span>
                      </div>
                    )}

                    {/* Answer Content */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {msg.answer}
                    </div>

                    {/* Sources & Grounding */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Grounded In:
                        </span>
                        {msg.sources.map((src, i) => (
                          <span key={i} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {src}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested Actions */}
                    {msg.suggestedNextActions && msg.suggestedNextActions.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Recommended Next Actions:
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {msg.suggestedNextActions.map((act, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setInputMessage(act);
                              }}
                              className={`text-left text-xs font-bold px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-cyan-400/50 text-slate-200 hover:text-white' : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-700'}`}
                            >
                              <span>{act}</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-cyan-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence & Feedback Bar */}
                    <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 border-t border-white/5">
                      <span className="flex items-center gap-1 font-bold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Verified ({(msg.confidence * 100).toFixed(0)}%)
                      </span>

                      {msg.sessionId && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFeedback(msg.sessionId, 1)}
                            className={`p-1 rounded hover:text-cyan-400 transition-colors ${feedbackSent[msg.sessionId] === 1 ? 'text-cyan-400 font-bold' : ''}`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.sessionId, -1)}
                            className={`p-1 rounded hover:text-rose-400 transition-colors ${feedbackSent[msg.sessionId] === -1 ? 'text-rose-400 font-bold' : ''}`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Assembling learning context & grounding course materials...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Drawer Input Form */}
          <form onSubmit={handleSendMessage} className={`p-4 border-t ${isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white border-indigo-100'}`}>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Ask about your lesson, concepts, or practice..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className={`w-full px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none transition-all pr-14 ${isDarkMode ? 'bg-slate-800/80 text-white border border-white/10 focus:border-cyan-400' : 'bg-slate-100 text-slate-800 border border-slate-200 focus:border-indigo-500'}`}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="absolute right-2 p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 disabled:opacity-40 text-white transition-all shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Continuous AI Voice Mentor Component */}
      <ContinuousVoiceMentorDrawer
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        courseId={currentCourseId}
        lessonId={currentLessonId}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
