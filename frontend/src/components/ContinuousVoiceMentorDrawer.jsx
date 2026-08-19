import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, RefreshCw, X, Play, Square, 
  Send, Settings, HelpCircle, BookOpen, CheckCircle, ShieldAlert, Sliders, Layers 
} from 'lucide-react';
import { startVoiceSession, changeVoiceMode, processVoiceInteraction, cancelVoiceResponse, resumeVoiceSession } from '../services/voiceMentorApi';

const MODES = [
  { id: 'EXPLAIN', label: 'Explain Mode', icon: BookOpen, desc: 'Simple step-by-step conceptual explanations' },
  { id: 'SOCRATIC', label: 'Socratic Mode', icon: HelpCircle, desc: 'Guiding questions to discover answers' },
  { id: 'PRACTICE', label: 'Practice Mode', icon: Play, desc: 'Interactive verbal practice & feedback' },
  { id: 'QUIZ', label: 'Quiz Mode', icon: CheckCircle, desc: 'Interactive voice assessment' },
  { id: 'STUDY', label: 'Study Mode', icon: Layers, desc: 'Structured walk-through of course material' },
  { id: 'EXAM_PREPARATION', label: 'Exam Prep Mode', icon: ShieldAlert, desc: 'Targeted exam practice & weak area detection' },
  { id: 'PROJECT_COACH', label: 'Project Coach', icon: Sparkles, desc: 'Hands-on project guidance & architecture' },
  { id: 'DEBUG_UNDERSTANDING', label: 'Debug Understanding', icon: RefreshCw, desc: 'Fix mental model misconceptions' },
  { id: 'MOTIVATION', label: 'Motivation Mode', icon: Sparkles, desc: 'Supportive learning encouragement' }
];

// Persistent in-memory cache for continuous voice/chat messages across re-renders
let persistentVoiceMessages = [];

export default function ContinuousVoiceMentorDrawer({ isOpen = false, onClose = () => {}, courseId = null, lessonId = null, isDarkMode = true }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, LISTENING, PROCESSING, AI_SPEAKING, PAUSED
  const [activeMode, setActiveMode] = useState('EXPLAIN');
  const [messages, setMessagesState] = useState(persistentVoiceMessages);

  const setMessages = (updater) => {
    setMessagesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistentVoiceMessages = next;
      return next;
    });
  };
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeResponseId, setActiveResponseId] = useState(null);
  
  // Settings
  const [voiceStyle, setVoiceStyle] = useState('Friendly');
  const [explanationStyle, setExplanationStyle] = useState('Normal');
  const [speakingSpeed, setSpeakingSpeed] = useState('Normal');
  const [speechLanguage, setSpeechLanguage] = useState('en-US');
  const [showSettings, setShowSettings] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis || null);
  const messagesEndRef = useRef(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = speechLanguage;

      rec.onstart = () => {
        setIsListening(true);
        setStatus('LISTENING');
      };

      rec.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          handleUserSubmit(finalTranscript, 'VOICE');
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatus('IDLE');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [speechLanguage]);

  // Start voice learning session when opened
  useEffect(() => {
    if (isOpen && !session) {
      initSession();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initSession = async () => {
    try {
      setStatus('PROCESSING');
      const data = await startVoiceSession({
        courseId,
        lessonId,
        mode: activeMode,
        voiceStyle,
        explanationStyle,
        speakingSpeed,
        speechLanguage
      });
      setSession(data.session);
      setStatus('IDLE');
    } catch (err) {
      console.error('Session Init Error:', err);
      setStatus('IDLE');
    }
  };

  // BARGE-IN / INTERRUPTION HANDLER
  const interruptAiSpeech = async () => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    if (activeResponseId && session) {
      await cancelVoiceResponse({ sessionId: session.id, responseId: activeResponseId }).catch(() => {});
    }
    setStatus('LISTENING');
  };

  const toggleMic = () => {
    if (status === 'AI_SPEAKING') {
      interruptAiSpeech();
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setStatus('IDLE');
    } else {
      try {
        recognitionRef.current?.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleModeChange = async (newMode) => {
    setActiveMode(newMode);
    if (session) {
      await changeVoiceMode(session.id, newMode).catch(() => {});
    }
  };

  const speakText = (text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage;
    utterance.rate = speakingSpeed === 'Slow' ? 0.85 : speakingSpeed === 'Fast' ? 1.25 : 1.0;

    utterance.onstart = () => setStatus('AI_SPEAKING');
    utterance.onend = () => setStatus('IDLE');
    utterance.onerror = () => setStatus('IDLE');

    synthRef.current.speak(utterance);
  };

  const handleUserSubmit = async (textInput, inputType = 'TEXT') => {
    const text = textInput || inputText;
    if (!text || !text.trim()) return;

    if (status === 'AI_SPEAKING') {
      interruptAiSpeech();
    }

    const userMsg = { role: 'user', content: text.trim(), inputType };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setStatus('PROCESSING');

    try {
      const data = await processVoiceInteraction({
        sessionId: session?.id,
        conversationId: session?.conversationId,
        transcript: text.trim(),
        inputType,
        courseId,
        lessonId,
        mode: activeMode,
        voiceStyle,
        explanationStyle,
        speakingSpeed,
        speechLanguage
      });

      setActiveResponseId(data.responseId);
      const aiMsg = { role: 'assistant', content: data.mentorReply, outputType: inputType };
      setMessages((prev) => [...prev, aiMsg]);

      // Speak response aloud
      speakText(data.mentorReply);
    } catch (err) {
      console.error('Voice Interaction Error:', err);
      setStatus('IDLE');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-full sm:w-[450px] z-50 transition-all duration-300 shadow-2xl flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${
        isDarkMode 
          ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border-l border-cyan-400/30 text-white shadow-cyan-500/10' 
          : 'bg-gradient-to-b from-white via-indigo-50/50 to-slate-50 border-l border-indigo-200 text-slate-900 shadow-indigo-500/20'
      }`}
    >
      {/* Header Bar */}
      <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-white/10 bg-white/5 backdrop-blur-md' : 'border-indigo-100 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </span>
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 ${isDarkMode ? 'border-slate-900' : 'border-white'} ${status === 'AI_SPEAKING' ? 'bg-cyan-400 animate-ping' : isListening ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
          </div>
          <div>
            <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>EDOT Continuous Voice Mentor</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-mono">3.6 Flash</span>
            </h3>
            <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              Real-Time Conversational Tutor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Voice Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Selector Bar */}
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 overflow-x-auto scrollbar-none ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-indigo-100 bg-indigo-50/40'}`}>
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 scale-[1.02]'
                  : isDarkMode
                  ? 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label.replace(' Mode', '')}
            </button>
          );
        })}
      </div>

      {/* Settings Overlay Drawer */}
      {showSettings && (
        <div className={`p-4 border-b space-y-3 animate-in fade-in ${isDarkMode ? 'bg-slate-900/90 border-white/10 text-white' : 'bg-white border-indigo-100 text-slate-900'}`}>
          <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-400">
            <span>Voice Preferences</span>
            <button onClick={() => setShowSettings(false)} className="text-cyan-500 font-extrabold text-xs cursor-pointer">Done</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className={`block mb-1 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Tone</label>
              <select value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} className={`w-full rounded-xl p-2 font-semibold outline-none ${isDarkMode ? 'bg-slate-800 border border-white/10 text-white' : 'bg-slate-100 border border-slate-200 text-slate-900'}`}>
                <option>Friendly</option>
                <option>Calm</option>
                <option>Professional</option>
                <option>Energetic</option>
              </select>
            </div>
            <div>
              <label className={`block mb-1 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Detail</label>
              <select value={explanationStyle} onChange={(e) => setExplanationStyle(e.target.value)} className={`w-full rounded-xl p-2 font-semibold outline-none ${isDarkMode ? 'bg-slate-800 border border-white/10 text-white' : 'bg-slate-100 border border-slate-200 text-slate-900'}`}>
                <option>Normal</option>
                <option>Simple</option>
                <option>Detailed</option>
              </select>
            </div>
            <div>
              <label className={`block mb-1 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Speed</label>
              <select value={speakingSpeed} onChange={(e) => setSpeakingSpeed(e.target.value)} className={`w-full rounded-xl p-2 font-semibold outline-none ${isDarkMode ? 'bg-slate-800 border border-white/10 text-white' : 'bg-slate-100 border border-slate-200 text-slate-900'}`}>
                <option>Slow</option>
                <option>Normal</option>
                <option>Fast</option>
              </select>
            </div>
            <div>
              <label className={`block mb-1 font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Language</label>
              <select value={speechLanguage} onChange={(e) => setSpeechLanguage(e.target.value)} className={`w-full rounded-xl p-2 font-semibold outline-none ${isDarkMode ? 'bg-slate-800 border border-white/10 text-white' : 'bg-slate-100 border border-slate-200 text-slate-900'}`}>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Visual Speech Wave & Status Banner */}
      <div className={`p-4 border-b flex flex-col items-center justify-center min-h-[110px] ${isDarkMode ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900/60 border-white/10' : 'bg-gradient-to-b from-sky-50 to-indigo-50/50 border-indigo-100'}`}>
        <div className="flex items-center gap-1.5 h-8 mb-2">
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-8 bg-cyan-400 animate-bounce' : status === 'LISTENING' ? 'h-6 bg-rose-500 animate-pulse' : 'h-2 bg-slate-400/40'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-6 bg-cyan-400 animate-bounce delay-75' : status === 'LISTENING' ? 'h-8 bg-rose-500 animate-pulse' : 'h-2 bg-slate-400/40'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-8 bg-cyan-400 animate-bounce delay-150' : status === 'LISTENING' ? 'h-5 bg-rose-500 animate-pulse' : 'h-2 bg-slate-400/40'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-5 bg-cyan-400 animate-bounce delay-100' : status === 'LISTENING' ? 'h-7 bg-rose-500 animate-pulse' : 'h-2 bg-slate-400/40'}`} />
        </div>

        <span className="text-xs font-bold tracking-wide flex items-center gap-2">
          {status === 'AI_SPEAKING' && <span className="text-cyan-400 flex items-center gap-1 font-extrabold">Speaking... (Tap mic to interrupt)</span>}
          {status === 'LISTENING' && <span className="text-rose-500 flex items-center gap-1 font-extrabold">Listening to you...</span>}
          {status === 'PROCESSING' && <span className="text-amber-400 flex items-center gap-1 font-extrabold">Thinking...</span>}
          {status === 'IDLE' && <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Ready — Speak or Type below</span>}
        </span>
      </div>

      {/* Message Transcript View */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className={`text-center py-12 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-60 text-cyan-400 animate-pulse" />
            Start speaking or type a question to begin continuous mentorship.
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed font-medium shadow-md ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-none shadow-cyan-500/20'
                  : isDarkMode
                  ? 'bg-slate-800/90 text-slate-100 border border-white/10 rounded-bl-none'
                  : 'bg-white text-slate-900 border border-indigo-100 rounded-bl-none shadow-sm'
              }`}>
                {m.content}
              </div>
              <span className={`text-[10px] font-bold mt-1 px-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {m.role === 'user' ? 'You' : 'Mentor'} • {m.inputType || 'TEXT'}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls & Input */}
      <div className={`p-4 border-t space-y-3 ${isDarkMode ? 'border-white/10 bg-slate-900/90' : 'border-indigo-100 bg-white'}`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-2xl flex items-center justify-center transition-all shadow-xl cursor-pointer ${
              status === 'AI_SPEAKING'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white animate-pulse'
                : isListening
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white animate-bounce'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-105 active:scale-95 shadow-cyan-500/25'
            }`}
            title={status === 'AI_SPEAKING' ? 'Interrupt AI' : isListening ? 'Stop Listening' : 'Start Voice Input'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserSubmit()}
            placeholder="Type your message..."
            className={`flex-1 rounded-2xl px-4 py-3.5 text-xs font-semibold outline-none transition-all ${
              isDarkMode 
                ? 'bg-slate-800/80 border border-white/10 text-white placeholder-slate-400 focus:border-cyan-400' 
                : 'bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-500 focus:border-indigo-500 focus:bg-white'
            }`}
          />

          <button
            onClick={() => handleUserSubmit()}
            disabled={!inputText.trim()}
            className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
              !inputText.trim() 
                ? 'opacity-40 bg-slate-200 text-slate-400' 
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:scale-105 active:scale-95'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
