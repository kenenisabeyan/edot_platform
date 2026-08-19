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

export default function ContinuousVoiceMentorDrawer({ isOpen = false, onClose = () => {}, courseId = null, lessonId = null, isDarkMode = true }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, LISTENING, PROCESSING, AI_SPEAKING, PAUSED
  const [activeMode, setActiveMode] = useState('EXPLAIN');
  const [messages, setMessages] = useState([]);
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
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-slate-900 text-white shadow-2xl border-l border-slate-800 flex flex-col font-sans animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">EDOT Voice Mentor</h2>
            <p className="text-[11px] text-slate-400">Continuous AI Learning Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Selector Bar */}
      <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-900/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
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
        <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Voice Preferences</span>
            <button onClick={() => setShowSettings(false)} className="text-cyan-400 text-xs">Done</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Tone</label>
              <select value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
                <option>Friendly</option>
                <option>Calm</option>
                <option>Professional</option>
                <option>Energetic</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Detail</label>
              <select value={explanationStyle} onChange={(e) => setExplanationStyle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
                <option>Normal</option>
                <option>Simple</option>
                <option>Detailed</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Speed</label>
              <select value={speakingSpeed} onChange={(e) => setSpeakingSpeed(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
                <option>Slow</option>
                <option>Normal</option>
                <option>Fast</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Language</label>
              <select value={speechLanguage} onChange={(e) => setSpeechLanguage(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
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
      <div className="p-4 bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 flex flex-col items-center justify-center min-h-[110px]">
        <div className="flex items-center gap-1.5 h-8 mb-2">
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-8 bg-cyan-400 animate-bounce' : status === 'LISTENING' ? 'h-6 bg-rose-400 animate-pulse' : 'h-2 bg-slate-700'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-6 bg-cyan-400 animate-bounce delay-75' : status === 'LISTENING' ? 'h-8 bg-rose-400 animate-pulse' : 'h-2 bg-slate-700'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-8 bg-cyan-400 animate-bounce delay-150' : status === 'LISTENING' ? 'h-5 bg-rose-400 animate-pulse' : 'h-2 bg-slate-700'}`} />
          <div className={`w-1.5 rounded-full transition-all duration-300 ${status === 'AI_SPEAKING' ? 'h-5 bg-cyan-400 animate-bounce delay-100' : status === 'LISTENING' ? 'h-7 bg-rose-400 animate-pulse' : 'h-2 bg-slate-700'}`} />
        </div>

        <span className="text-xs font-semibold tracking-wide text-slate-300 flex items-center gap-2">
          {status === 'AI_SPEAKING' && <span className="text-cyan-400 flex items-center gap-1">Speaking... (Tap mic to interrupt)</span>}
          {status === 'LISTENING' && <span className="text-rose-400 flex items-center gap-1">Listening to you...</span>}
          {status === 'PROCESSING' && <span className="text-amber-400 flex items-center gap-1">Thinking...</span>}
          {status === 'IDLE' && <span className="text-slate-400">Ready — Speak or Type below</span>}
        </span>
      </div>

      {/* Message Transcript View */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
            Start speaking or type a question to begin continuous mentorship.
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-cyan-500 text-slate-950 font-medium rounded-br-none'
                  : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-none'
              }`}>
                {m.content}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {m.role === 'user' ? 'You' : 'Mentor'} • {m.inputType || 'TEXT'}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls & Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`p-3.5 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              status === 'AI_SPEAKING'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                : isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-bounce'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
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
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />

          <button
            onClick={() => handleUserSubmit()}
            disabled={!inputText.trim()}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 disabled:opacity-40 rounded-2xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
