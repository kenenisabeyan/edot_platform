import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Loader2, Trash2, QrCode, Maximize2, Minimize2, Mic, MicOff, Volume2, VolumeX, Video } from 'lucide-react';
import useThemeMode from '../hooks/useThemeMode';
import api from '../utils/api';
import Markdown from 'markdown-to-jsx';
import ChatbotQRScannerModal from './ChatbotQRScannerModal';
import { useAuth } from '../context/AuthContext';

export default function ChatbotWidget() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(true);
    const recognitionRef = useRef(null);

    const closeChat = () => {
        setIsOpen(false);
        setIsFullScreen(false);
    };
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const messagesEndRef = useRef(null);
    const isDarkMode = useThemeMode();
    const telegramUrl = 'https://t.me/edotplatform';

    // Compute dynamic greeting based on user role and name placeholder
    const dynamicGreeting = React.useMemo(() => {
        if (!user) {
            return "Hello there! Welcome to **EDOT Platform (FutureLearning)**. I am the *EDOT Assistant*. Are you looking to upgrade your tech/business skills, track a child's progress, or sponsor a student?";
        }
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
        const namePlaceholder = user.name || 'User';
        const roleName = capitalize(user.role || 'user');
        
        switch (user.role) {
            case 'student':
                return `Welcome back, **${namePlaceholder}**! I see you are logged in as a *Student*. How is your learning journey going today? Need help with courses or tracking your progress?`;
            case 'parent':
                return `Hello, **${namePlaceholder}**! As a registered *Guardian*, I am here to help you monitor your children's academic path. How can I assist you today?`;
            case 'instructor':
                return `Welcome back, Professor **${namePlaceholder}**! Thank you for teaching on EDOT. How can I assist with your classes or teaching portal today?`;
            case 'admin':
                return `Authorized Access: Welcome back, Admin **${namePlaceholder}**. Platform security and registry tools are ready. What administrative task shall we perform today?`;
            default:
                return `Welcome back, **${namePlaceholder}** (*${roleName}*)! How can I assist you today?`;
        }
    }, [user]);

    // Compute dynamic suggestions list based on user role
    const dynamicSuggestions = React.useMemo(() => {
        if (!user) {
            return [
                "What is EDOT Platform?",
                "What course packages are available?",
                "How can I sponsor a student?",
                "How do I start learning?"
            ];
        }
        switch (user.role) {
            case 'student':
                return [
                    "Check my dashboard progress",
                    "View my certificates",
                    "How do I join a live class?",
                    "Reset my study goal"
                ];
            case 'parent':
                return [
                    "Track child's grade progress",
                    "View attendance records",
                    "Message course instructors",
                    "Link another child account"
                ];
            case 'instructor':
                return [
                    "Manage my active classes",
                    "Check course review metrics",
                    "Publish a notice",
                    "View student rosters"
                ];
            case 'admin':
                return [
                    "Pending course approvals",
                    "Platform revenue statistics",
                    "Create a new user account",
                    "Database health report"
                ];
            default:
                return [
                    "What is EDOT Platform?",
                    "Browse course catalog",
                    "Reset my password",
                    "Sponsor a student"
                ];
        }
    }, [user]);

    // Update greeting when user authenticates or changes
    useEffect(() => {
        setMessages([
            { role: 'assistant', content: dynamicGreeting }
        ]);
    }, [dynamicGreeting]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        const handleTriggerChat = (e) => {
            setIsOpen(true);
            if (e.detail?.message) {
                sendMessage(e.detail.message);
            }
        };
        window.addEventListener('trigger-chatbot', handleTriggerChat);
        return () => {
            window.removeEventListener('trigger-chatbot', handleTriggerChat);
        };
    }, [messages]);

    const speakReply = (text) => {
        if (!isVoiceOutputEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = (text || '').replace(/[*_#`~]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.0;
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        } catch {
            // Non-critical fallback
        }
    };

    const toggleVoiceInput = () => {
        if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            alert('Voice speech recognition is not supported in your browser.');
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'en-US';

            rec.onstart = () => setIsListening(true);
            rec.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                if (transcript) {
                    setInput(transcript);
                    sendMessage(transcript);
                }
            };
            rec.onerror = () => setIsListening(false);
            rec.onend = () => setIsListening(false);

            recognitionRef.current = rec;
            rec.start();
        } catch (err) {
            console.error('Speech recognition error:', err);
            setIsListening(false);
        }
    };

    const sendMessage = async (userMessage) => {
        if (!userMessage.trim() || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const { data } = await api.post('/chatbot/message', {
                message: userMessage,
                history: messages
            });

            if (data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                speakReply(data.reply);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error. " + (data.message || "") }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = error.response?.data?.message || "I'm having trouble connecting to my servers right now. Please try again later.";
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        const userMsg = input.trim();
        setInput('');
        sendMessage(userMsg);
    };

    const handleSuggestionClick = (suggestion) => {
        sendMessage(suggestion);
    };

    const handleClearChat = () => {
        setMessages([
            { role: 'assistant', content: dynamicGreeting }
        ]);
    };

    // Beautiful grid gradient style config mirroring the EDOT platform's main landing page gradients
    const popupStyle = isDarkMode ? {
        background: 'linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(110deg, #082d38 0%, #3a1e0b 45%, #592408 65%, #040916 100%)',
        backgroundSize: '20px 20px, 20px 20px, 100% 100%',
    } : {
        background: 'linear-gradient(to right, rgba(0, 0, 0, 0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.025) 1px, transparent 1px), linear-gradient(110deg, #8CD6D5 0%, #F5CE9F 45%, #E98642 65%, #25337C 100%)',
        backgroundSize: '20px 20px, 20px 20px, 100% 100%',
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        style={popupStyle}
                        className={`transition-all duration-300 shadow-2xl overflow-hidden border flex flex-col ${
                            isFullScreen 
                                ? 'fixed inset-0 md:inset-6 z-50 w-auto h-auto max-h-none rounded-none md:rounded-3xl mb-0' 
                                : 'mb-2 w-80 sm:w-96 h-[520px] max-h-[80vh] rounded-2xl'
                        } ${isDarkMode ? 'border-white/10 text-white' : 'border-teal-500/20 text-slate-800'}`}
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center justify-between border-b backdrop-blur-md ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/5 bg-white/15'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-200 shadow-md">
                                    <img src="https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw" alt="EDOT Logo" className="w-7 h-7 object-contain" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">EDOT Assistant</h3>
                                    <p className="text-[10px] font-medium flex items-center gap-1.5 text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> Online
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={handleClearChat}
                                    title="Clear conversation"
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-600 hover:text-slate-900'}`}
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button 
                                    onClick={() => setIsFullScreen(!isFullScreen)}
                                    title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-600 hover:text-slate-900'}`}
                                >
                                    {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button 
                                    onClick={closeChat}
                                    className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-600 hover:text-slate-900'}`}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                            <div className={`space-y-4 ${isFullScreen ? 'max-w-3xl mx-auto w-full' : ''}`}>
                                {messages.map((msg, idx) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={idx} 
                                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-[#06b6d4] text-white' : 'bg-white border border-slate-200 overflow-hidden shadow-sm'}`}>
                                        {msg.role === 'user' ? (
                                            <User size={12} />
                                        ) : (
                                            <img src="https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw" alt="EDOT Logo" className="w-full h-full object-contain" />
                                        )}
                                    </div>

                                    <div className={`p-3 rounded-2xl max-w-[80%] text-sm shadow-md ${
                                        msg.role === 'user' 
                                            ? isDarkMode
                                                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-tr-sm border-transparent'
                                                : 'bg-gradient-to-tr from-teal-600 to-indigo-700 text-white rounded-tr-sm border-transparent'
                                            : isDarkMode
                                                ? 'bg-gradient-to-tr from-slate-900/95 to-cyan-950/80 text-cyan-50 rounded-tl-sm border border-cyan-500/10'
                                                : 'bg-gradient-to-tr from-teal-50/95 to-amber-50/90 text-slate-800 rounded-tl-sm border border-teal-500/15'
                                    }`}>
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : (
                                            <Markdown
                                                options={{
                                                    forceBlock: true,
                                                    overrides: {
                                                        h1: {
                                                            component: 'h1',
                                                            props: {
                                                                className: `font-extrabold text-base my-2 bg-gradient-to-r ${isDarkMode ? 'from-cyan-300 to-teal-300' : 'from-teal-800 to-indigo-800'} bg-clip-text text-transparent`
                                                            }
                                                        },
                                                        h2: {
                                                            component: 'h2',
                                                            props: {
                                                                className: `font-bold text-sm my-2 bg-gradient-to-r ${isDarkMode ? 'from-cyan-300 to-teal-300' : 'from-teal-800 to-indigo-800'} bg-clip-text text-transparent`
                                                            }
                                                        },
                                                        h3: {
                                                            component: 'h3',
                                                            props: {
                                                                className: `font-bold text-xs my-1.5 bg-gradient-to-r ${isDarkMode ? 'from-cyan-300 to-teal-300' : 'from-teal-800 to-indigo-800'} bg-clip-text text-transparent`
                                                            }
                                                        },
                                                        h4: {
                                                            component: 'h4',
                                                            props: {
                                                                className: `font-bold text-[11px] my-1 bg-gradient-to-r ${isDarkMode ? 'from-cyan-300 to-teal-300' : 'from-teal-800 to-indigo-800'} bg-clip-text text-transparent`
                                                            }
                                                        },
                                                        strong: {
                                                            component: 'strong',
                                                            props: {
                                                                className: `font-extrabold ${isDarkMode ? 'text-[#00D4FF]' : 'text-teal-700'}`
                                                            }
                                                        },
                                                        em: {
                                                            component: 'em',
                                                            props: {
                                                                className: `font-bold italic ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`
                                                            }
                                                        },
                                                        a: {
                                                            component: 'a',
                                                            props: {
                                                                className: `underline transition-colors break-all font-bold ${isDarkMode ? 'text-cyan-300 hover:text-cyan-100' : 'text-teal-700 hover:text-teal-900'}`,
                                                                target: '_blank',
                                                                rel: 'noopener noreferrer'
                                                            }
                                                        },
                                                        ul: {
                                                            component: 'ul',
                                                            props: {
                                                                className: 'list-disc pl-5 my-1.5 space-y-1'
                                                            }
                                                        },
                                                        ol: {
                                                            component: 'ol',
                                                            props: {
                                                                className: 'list-decimal pl-5 my-1.5 space-y-1'
                                                            }
                                                        },
                                                        li: {
                                                            component: 'li',
                                                            props: {
                                                                className: 'my-0.5'
                                                            }
                                                        },
                                                        p: {
                                                            component: 'p',
                                                            props: {
                                                                className: 'mb-1.5 last:mb-0 leading-relaxed'
                                                            }
                                                        },
                                                        code: {
                                                            component: 'code',
                                                            props: {
                                                                className: `px-1.5 py-0.5 rounded font-mono text-[11px] ${isDarkMode ? 'bg-black/30 text-cyan-300' : 'bg-teal-50 border border-teal-200/50 text-teal-800'}`
                                                            }
                                                        },
                                                        pre: {
                                                            component: 'pre',
                                                            props: {
                                                                className: `p-3 rounded-lg overflow-x-auto my-2 font-mono text-[11px] ${isDarkMode ? 'bg-black/40 border border-white/5' : 'bg-white/80 border border-teal-200/60 shadow-inner'}`
                                                            }
                                                        }
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </Markdown>
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Suggested Inquiries (Show when conversation is just the greeting) */}
                            {messages.length === 1 && !isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="pt-2 pl-8 pr-2 space-y-3"
                                >
                                    <h4 className={`text-[10px] font-bold tracking-wider uppercase ${isDarkMode ? 'text-cyan-400/90' : 'text-teal-800/90'}`}>
                                        Suggested Inquiries
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                        {dynamicSuggestions.map((suggestion, sIdx) => (
                                            <button
                                                key={sIdx}
                                                type="button"
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${isDarkMode ? 'bg-[#0a1424] border-white/5 text-slate-200 hover:bg-[#0f1d33] hover:border-cyan-500/30 hover:text-cyan-300' : 'bg-white/60 border border-white/90 text-slate-800 hover:bg-white/90 hover:border-teal-500/30 hover:text-teal-800 shadow-sm'}`}
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {isLoading && (
                                <div className="flex gap-2 flex-row">
                                    <div className="w-6 h-6 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                        <img src="https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw" alt="EDOT Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm rounded-tl-sm flex items-center gap-2 ${isDarkMode ? 'bg-white/6 border border-white/8 text-slate-200' : 'bg-white/75 backdrop-blur-sm border border-white text-slate-700 shadow-sm'}`}>
                                        <Loader2 size={14} className="animate-spin text-sky-500" />
                                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-500'}>Thinking...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                            </div>
                        </div>

                        <form onSubmit={handleSend} className={`p-3 border-t backdrop-blur-md ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-white/10 bg-white/15'}`}>
                            <div className={`flex items-center gap-2 ${isFullScreen ? 'max-w-3xl mx-auto w-full' : 'w-full'}`}>
                                <button
                                    type="button"
                                    onClick={() => setScannerOpen(true)}
                                    title="Scan QR Code"
                                    className={`p-2.5 rounded-full transition-all shrink-0 border ${
                                        isDarkMode 
                                            ? 'text-slate-400 hover:text-cyan-300 hover:bg-white/5 bg-white/5 border-white/10' 
                                            : 'text-slate-600 hover:text-teal-700 hover:bg-black/5 bg-black/5 border-black/10'
                                    }`}
                                >
                                    <QrCode size={18} />
                                </button>
                                <div className="relative flex-1 flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Message EDOT Assistant..."
                                    className={`w-full py-3 pl-4 pr-24 !rounded-full text-sm focus:outline-none transition-all ${
                                        isDarkMode 
                                            ? 'bg-gradient-to-r from-white/5 to-white/10 border border-white/20 focus:border-cyan-400 text-white placeholder-white/60' 
                                            : 'bg-gradient-to-r from-black/5 to-black/10 border border-black/15 focus:border-teal-600 text-slate-800 placeholder-slate-500 shadow-inner'
                                    }`}
                                />

                                <div className="absolute right-2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsVoiceOutputEnabled(!isVoiceOutputEnabled)}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${isVoiceOutputEnabled ? 'text-cyan-400 hover:bg-white/10' : 'text-slate-500 hover:bg-white/10'}`}
                                        title={isVoiceOutputEnabled ? 'Mute AI Voice' : 'Enable AI Voice'}
                                    >
                                        {isVoiceOutputEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={toggleVoiceInput}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-cyan-400 hover:bg-white/10'}`}
                                        title={isListening ? 'Stop Voice Recording' : 'Start Voice Input'}
                                    >
                                        {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${!input.trim() || isLoading ? 'bg-slate-700/30 text-slate-400 opacity-50 cursor-not-allowed' : 'bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-md hover:scale-105 active:scale-95'}`}
                                    >
                                        <Send size={13} />
                                    </button>
                                </div>
                            </div>
                            </div>
                        </form>

                        {/* Footer Info Bar */}
                        <div className={`px-4 pb-3 flex items-center justify-between text-[10px] font-medium tracking-wide backdrop-blur-md ${isDarkMode ? 'text-slate-500 bg-black/15' : 'text-slate-200/90 bg-white/10'}`}>
                            <span className="flex items-center gap-1">
                                <span className={`px-1 py-0.5 rounded border text-[9px] ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white/10 border border-white/25 text-slate-200'}`}>⏎</span> Enter to send
                            </span>
                            <span>Powered by EDOT AI</span>
                        </div>

                        {/* QR Scanner Modal */}
                        <ChatbotQRScannerModal 
                            isOpen={scannerOpen}
                            onClose={() => setScannerOpen(false)}
                            onScanSuccess={(decodedText) => sendMessage(decodedText)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Buttons Row */}
            {!isFullScreen && (
                <div className="flex flex-row items-center gap-3">
                {/* Telegram Link Button */}
                <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open EDOT on Telegram"
                    className="w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105"
                    style={{background: 'linear-gradient(135deg,#00D4FF,#19C2E8)', color: '#ffffff'}}
                >
                    {/* Telegram paper plane SVG */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.574-1.278-1.258z" fill="#ffffff" />
                    </svg>
                </a>

                {/* Toggle Button */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all bg-gradient-to-tr from-[#1E88E5] via-[#42A5F5] to-[#26C6DA] hover:shadow-sky-500/25"
                >
                    <svg width="28" height="28" viewBox="0 0 32 32" fill="currentColor" className="text-black">
                        {/* Left larger bubble (tail pointing down-left) */}
                        <path d="M 13,6.5 C 17.14,6.5 20.5,9.4 20.5,13 C 20.5,16.6 17.14,19.5 13,19.5 C 11.8,19.5 10.6,19.2 9.6,18.7 L 5.5,21.5 L 7,17.2 C 5.5,16.1 4.5,14.6 4.5,13 C 4.5,9.4 7.86,6.5 13,6.5 Z" />
                        {/* Right smaller bubble (tail pointing down-right) */}
                        <path d="M 19.5,12.5 C 22.8,12.5 25.5,14.7 25.5,17.5 C 25.5,18.7 24.8,19.8 23.7,20.6 L 24.8,23.8 L 21.6,21.9 C 20.9,22.3 20.2,22.5 19.5,22.5 C 16.2,22.5 13.5,20.3 13.5,17.5 C 13.5,14.7 16.2,12.5 19.5,12.5 Z" />
                    </svg>
                </motion.button>
            </div>
            )}
        </div>
    );
}
