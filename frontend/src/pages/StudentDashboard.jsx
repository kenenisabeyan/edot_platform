import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  BookOpen, CheckCircle2, Award, Search, LayoutDashboard, 
  Settings, LogOut, Target, Plus, Bell, Monitor, TrendingUp, MoreHorizontal,
  PlayCircle, Download, ShieldCheck, Globe, ShoppingCart, Users, Coins, Package, Banknote, Wallet, FileText, Moon, Sun, Clock, PanelLeftClose,
  Calculator, Rocket, UserCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
const edotLogo = 'https://res.cloudinary.com/dacck6udl/image/upload/f_auto,q_auto/v1/edot/frontend/images/jpw8g8m6spazsktyizdw';
import ProfileView from './ProfileView';
import ActivityFeed from '../components/ActivityFeed';
import EcosystemNexus from '../components/EcosystemNexus';

import PackageCard from '../components/student/PackageCard';
import StudentOverview from '../components/student/StudentOverview';
import ThemeDropdown from '../components/ThemeDropdown';
import useThemeMode from '../hooks/useThemeMode';
import CourseFallbackThumbnail from '../components/CourseFallbackThumbnail';
import { PACKAGES } from '../constants/packages';

import LibraryView from './LibraryView';
import MessagesView from './MessagesView';
import NoticeView from './NoticeView';
import SettingsView from './SettingsView';
import CertificatesView from './CertificatesView';
import LearningProfileCard from '../components/LearningProfileCard';
import IntelligentLearningAnalytics from '../components/IntelligentLearningAnalytics';
import RecommendationEnginePanel from '../components/RecommendationEnginePanel';

const DB_CATEGORY_MAP = {
  "Social Sciences": "Social Science",
  "Mathematics & Natural Sciences": "Mathematics & Natural Science",
  "Languages": "Natural Language",
  "Technology & Development": "Programming & Technology",
  "Business & Entrepreneurship": "Business & Entrepreneurship",
  "Personal Development": "Personal Development"
};
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

const EnrolledCourseCard = ({ enrolled, isDarkMode, navigate, handleSelfAttendance }) => {
  const [isHovered, setIsHovered] = useState(false);
  const normalized = normalizeCategory(enrolled.course?.mainCategory || enrolled.course?.category);
  const catInfo = CAT_COLORS[normalized] || DEFAULT_COLOR;
  const contrastTextColor = catInfo.main === "#FFD700" ? "#0F172A" : "#FFFFFF";
  const IconComponent = CAT_ICONS[normalized] || BookOpen;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`rounded-[32px] glass-panel border shadow-lg flex flex-col h-full transition-all relative group hover:-translate-y-1 overflow-hidden ${isDarkMode ? 'bg-[#0B1120] border-slate-700' : 'bg-white border-slate-200'}`}
      style={{ 
        borderColor: isHovered ? catInfo.main : undefined,
        boxShadow: isHovered ? `0 8px 30px ${catInfo.main}25` : undefined,
        borderTop: `6px solid ${catInfo.main}`
      }}
    >
      <div className="p-4 pb-0 shrink-0">
        <div 
          className="w-full h-[200px] relative flex items-center justify-center rounded-2xl overflow-hidden" 
          style={{ backgroundColor: '#030303' }}
        >
          {enrolled.course?.thumbnail && enrolled.course.thumbnail !== 'default-course.jpg' ? (
            <img 
              src={enrolled.course.thumbnail} 
              alt={enrolled.course.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          ) : (
            <CourseFallbackThumbnail 
              color={catInfo.main} 
              darkColor={catInfo.dark || catInfo.main} 
              ribbon={enrolled.course?.mainCategory || enrolled.course?.category} 
              fallbackId={enrolled.course?.id} 
            />
          )}

          {/* Status Badge in lowercase pill border shape */}
          <div className="absolute top-4 right-4 z-20">
            <span 
              className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border"
              style={{ backgroundColor: catInfo.main, color: contrastTextColor, borderColor: 'transparent' }}
            >
              {(enrolled.status || (enrolled.progress === 100 ? 'completed' : 'active')).toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 
          className={`text-lg font-bold mb-1 line-clamp-2 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
          style={{ color: isHovered ? catInfo.main : undefined }}
        >
          {enrolled.course?.title || 'Unknown Course'}
        </h3>

        {/* Enrolled Course Creator/Instructor Row */}
        <div className="flex items-center gap-2 mt-2 mb-2">
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            {enrolled.course?.instructor && enrolled.course.instructor.avatar && enrolled.course.instructor.avatar !== 'default-avatar.png' ? (
              <img 
                src={enrolled.course.instructor.avatar.startsWith('http') ? enrolled.course.instructor.avatar : `http://localhost:5000${enrolled.course.instructor.avatar.startsWith('/') ? '' : '/'}${enrolled.course.instructor.avatar}`} 
                alt={enrolled.course.instructor.name || 'Instructor'} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center w-full h-full">
              {enrolled.course?.instructor?.name ? enrolled.course.instructor.name.charAt(0) : '?'}
            </span>
          </div>
          <span className={`text-[12px] font-bold truncate ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>
            {enrolled.course?.instructor?.name || 'EDOT Instructor'}
          </span>
        </div>

        <div className="mt-auto pt-4 space-y-3">
          <div className="flex justify-between text-xs font-bold">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Progress</span>
            <span style={{ color: catInfo.main }}>{enrolled.progress || 0}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${enrolled.progress || 0}%`, backgroundColor: catInfo.main }}></div>
          </div>

          <div className="flex gap-2 mt-4 pt-1">
            <button 
              onClick={() => navigate(`/course/${enrolled.course?.id || enrolled.courseId}`)} 
              className="flex-1 py-2.5 font-bold text-xs rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-md"
              style={{
                backgroundColor: catInfo.main,
                color: contrastTextColor,
                boxShadow: isHovered ? `0 6px 15px -3px ${catInfo.main}50` : undefined
              }}
            >
              Continue Learning
            </button>
            <button 
              onClick={() => handleSelfAttendance(enrolled.course?.id || enrolled.courseId)} 
              className={`flex-1 py-2.5 font-bold text-xs rounded-xl border transition-colors ${isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500 hover:text-white' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-500 hover:text-white'}`}
            >
              Check In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



const CAT_DESCRIPTIONS = {
  "Social Science": "This curriculum path is designed to enable learners to travel inside human society, increasing awareness to grow understanding of history, behavior, and structural consciousness.",
  "Mathematics & Natural Science": "This training curriculum allows people to develop a step-by-step rigorous analytical system to build the required logic for the purpose, dreams, and advanced scientific goals they designed.",
  "Natural Language": "This language path is engineered to empower seamless global communication. The training lets learners balance their social, professional, and cultural interactions elegantly.",
  "Programming & Technology": "This curriculum is the track to tech mastery. It's designed to create 'Aha' moments and increase awareness to grow into highly sought-after software architectures and development mindsets.",
  "Business & Entrepreneurship": "This premium curriculum enables future leaders to navigate markets independently. It helps construct financial stability, leadership, and powerful entrepreneurial ecosystems.",
  "Personal Development": "This training empowers individuals to unlock self-mastery. Develop habits and physical, mental, and social goals that directly translate to long-term prosperity."
};

const handleDownloadCertificate = async (enrolled, userName, action = 'download') => {
  const courseName = enrolled.course?.title || 'Course';
  const duration = enrolled.course?.duration ? `${enrolled.course.duration} Hours` : 'Self-Paced';
  const level = enrolled.course?.level || 'Intermediate';
  const ceus = enrolled.course?.duration ? `${(enrolled.course.duration / 10).toFixed(1)} CEUs` : '3.0 CEUs';
  const dateCompleted = enrolled.issueDate || enrolled.updatedAt ? new Date(enrolled.issueDate || enrolled.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const instructorName = enrolled.course?.instructor?.name || 'EDOT Instructor';

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = edotLogo;
  await new Promise(resolve => {
    img.onload = resolve;
    img.onerror = resolve; // Continue even if logo fails
  });

  const getCircularLogo = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(image.width / 2, image.height / 2, Math.min(image.width, image.height) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return canvas.toDataURL('image/png');
  };

  const doc = new jsPDF('landscape', 'mm', 'a4');
  const certId = enrolled.verificationHash || enrolled.id || `EDOT-CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
  
  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 297, 210, 'F');
  
  // Outer Orange Border
  doc.setDrawColor(249, 115, 22); // #00D4FF
  doc.setLineWidth(1);
  doc.rect(5, 5, 287, 200);
  // Inner Orange Border
  doc.setLineWidth(0.3);
  doc.rect(7, 7, 283, 196);

  // Top Left Corner Polygon (Orange shadow and Dark Navy)
  doc.setFillColor(249, 115, 22);
  doc.triangle(0, 0, 95, 0, 0, 105, 'F');
  doc.setFillColor(11, 17, 32); // #0B1120
  doc.triangle(0, 0, 90, 0, 0, 100, 'F');
  
  // Bottom Right Corner
  doc.setFillColor(249, 115, 22);
  doc.triangle(297, 210, 207, 210, 297, 145, 'F');
  doc.setFillColor(11, 17, 32);
  doc.triangle(297, 210, 212, 210, 297, 150, 'F');

  // Ribbon Top Right
  doc.setFillColor(11, 17, 32);
  doc.rect(255, 0, 16, 45, 'F');
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.rect(256, 0, 14, 44);
  // Ribbon bottom cut (triangle)
  doc.setFillColor(255, 255, 255);
  doc.triangle(255, 45, 263, 38, 271, 45, 'F');

  // Seal on Ribbon
  doc.setFillColor(249, 115, 22);
  doc.circle(263, 40, 14, 'F');
  doc.setFillColor(11, 17, 32);
  doc.circle(263, 40, 11, 'F');
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.circle(263, 40, 9);
  
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('VERIFIED', 263, 37, {align: 'center'});
  doc.text('CERTIFICATE', 263, 43, {align: 'center'});

  // Logo & Top Left Text
  try {
    if (img.width > 0) {
      doc.addImage(getCircularLogo(img), 'PNG', 15, 15, 20, 20);
      // Orange border around circular logo
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.5);
      doc.circle(25, 25, 10, 'S');
    }
  } catch (e) {}
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(10);
  doc.text('EDOT', 25, 42, {align: 'center'});
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Learn. Teach. Support.', 25, 47, {align: 'center'});
  doc.text('Sponsor a Future.', 25, 50, {align: 'center'});

  // Certificate ID
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text('Certificate ID:', 240, 20, {align: 'right'});
  doc.setTextColor(11, 17, 32);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(certId, 240, 25, {align: 'right'});

  // MAIN TITLE
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 17, 32);
  doc.setFontSize(42);
  doc.text('CERTIFICATE', 148.5, 45, {align: 'center'});
  
  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(249, 115, 22);
  doc.text('OF COMPLETION', 148.5, 55, {align: 'center'});
  
  // Lines around OF COMPLETION
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(95, 53.5, 120, 53.5);
  doc.line(177, 53.5, 202, 53.5);
  doc.setFillColor(249, 115, 22);
  doc.circle(95, 53.5, 1, 'F');
  doc.circle(202, 53.5, 1, 'F');

  // Proudly presented
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('THIS IS PROUDLY PRESENTED TO', 148.5, 75, {align: 'center'});

  // Student Name
  doc.setFont('times', 'italic');
  doc.setTextColor(11, 17, 32);
  doc.setFontSize(45);
  doc.text(userName || 'Test User', 148.5, 98, {align: 'center'});

  // Line below name
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(90, 108, 207, 108);
  doc.setFillColor(249, 115, 22);
  // Draw a small diamond in the middle of the line
  doc.triangle(148.5, 106, 150.5, 108, 148.5, 110, 'F');
  doc.triangle(148.5, 106, 146.5, 108, 148.5, 110, 'F');

  // Course completion text
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.text('For successfully completing the course', 148.5, 122, {align: 'center'});

  // Course Name
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 17, 32);
  doc.setFontSize(26);
  doc.text(courseName.toUpperCase(), 148.5, 138, {align: 'center'});

  // Paragraph
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text('This course covered essential topics and practical applications of the subject matter.\nThe holder has demonstrated dedication, knowledge, and a commitment to learning.', 148.5, 150, {align: 'center', lineHeightFactor: 1.5});

  // Four Columns
  // DATE | DURATION | LEVEL | CREDIT EARNED
  const colY = 165;
  // Dividers
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(105, 158, 105, 173);
  doc.line(148.5, 158, 148.5, 173);
  doc.line(192, 158, 192, 173);

  // DATE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text('DATE OF COMPLETION', 75, colY, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text(dateCompleted, 75, colY + 5, {align: 'center'});

  // DURATION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text('DURATION', 126.5, colY, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text(duration, 126.5, colY + 5, {align: 'center'});

  // LEVEL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text('LEVEL', 170.5, colY, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text(level, 170.5, colY + 5, {align: 'center'});

  // CREDIT EARNED
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text('CREDIT EARNED', 222, colY, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text(ceus, 222, colY + 5, {align: 'center'});

  // Signatures
  const sigY = 192;
  
  // Left
  doc.setFont('times', 'italic');
  doc.setFontSize(22);
  doc.setTextColor(11, 17, 32);
  doc.text(instructorName, 100, sigY - 2, {align: 'center'});
  
  doc.setDrawColor(249, 115, 22);
  doc.line(75, sigY, 125, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text(instructorName, 100, sigY + 5, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Course Instructor', 100, sigY + 9, {align: 'center'});

  // Right
  doc.setFont('times', 'italic');
  doc.setFontSize(22);
  doc.setTextColor(11, 17, 32);
  doc.text('EDOT Administration', 197, sigY - 2, {align: 'center'});
  
  doc.setDrawColor(249, 115, 22);
  doc.line(172, sigY, 222, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(11, 17, 32);
  doc.text('EDOT Administration', 197, sigY + 5, {align: 'center'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Academic Director', 197, sigY + 9, {align: 'center'});

  // Center Gold Badge
  doc.setFillColor(249, 115, 22);
  doc.circle(148.5, sigY, 10, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(148.5, sigY, 8, 'F');
  doc.setFillColor(249, 115, 22);
  doc.circle(148.5, sigY, 6, 'F');
  
  // QR Code visual (Real)
  try {
    const verifyUrl = `${window.location.origin}/verify-certificate/${certId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 0,
      width: 300,
      color: { dark: '#0B1120', light: '#FFFFFF' }
    });
    doc.addImage(qrDataUrl, 'PNG', 260, 180, 16, 16);
  } catch (e) {
    console.error('Failed to generate QR code', e);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text('Verify Certificate', 268, 202, {align: 'center'});
  doc.text('edot.org/verify', 268, 205, {align: 'center'});

  if (action === 'view') {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } else {
    doc.save(`${courseName.replace(/\s+/g, '_')}_Certificate.pdf`);
  }
};

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const isDarkMode = useThemeMode();
  const [growthNote, setGrowthNote] = useState('');
  
  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: async () => {
      // Fetch the unified dashboard API
      const { data } = await api.get('/student/dashboard').catch(() => ({ data: { data: {} } }));
      
      const payload = data.data || {};
      
      return {
        profile: payload.profile || {},
        enrolledCourses: payload.enrollments || [],
        overview: payload.stats || {},
        progress: payload.progress || { percentile: 0, recentCourses: payload.recentCourses || [] },
        study: payload.weeklyStudy || {},
        certificates: payload.certificates || [],
        achievements: payload.achievements || [],
        sidebarCounts: payload.sidebarCounts || { messages: 0, certificates: 0, notices: 0 }
      };
    }
  });

  // Fetch certificates (critical for dashboard stats)
  const { data: certificatesData } = useQuery({
    queryKey: ['studentCertificates'],
    queryFn: async () => {
      const { data } = await api.get('/certificates').catch(() => ({ data: { data: [] } }));
      return data.data || [];
    }
  });

  // Fetch achievements
  const { data: achievementsData } = useQuery({
    queryKey: ['studentAchievements'],
    queryFn: async () => {
      const { data } = await api.get('/achievements').catch(() => ({ data: { data: [] } }));
      return data.data || [];
    }
  });

  const { data: allCoursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['allCourses'],
    queryFn: async () => {
      const { data } = await api.get('/courses', { params: { limit: 100 } });
      return data.courses || [];
    },
    enabled: activeTab === 'catalog'
  });

  const { data: privateLogsData } = useQuery({
    queryKey: ['privateLogs'],
    queryFn: async () => {
      const { data } = await api.get('/activity', { params: { limit: 20 } });
      return data.data.filter(log => log.visibility === 'private');
    },
    enabled: activeTab === 'growth'
  });

  const { data: unreadMessagesCount } = useQuery({
    queryKey: ['unreadMessagesCount'],
    queryFn: async () => {
      const { data } = await api.get('/messages/unread/count').catch(() => ({ data: { count: 0 } }));
      return data.count || 0;
    }
  });

  const loading = isLoadingDashboard;

  const enrolledCourses = dashboardData?.enrolledCourses || [];
  const dbCourses = allCoursesData || [];
  const achievements = dashboardData?.achievements || achievementsData || [];
  const certificates = dashboardData?.certificates || certificatesData || [];
  const privateLogs = privateLogsData || [];

  const dashboardStats = {
     weeklyStudyData: dashboardData?.study?.weeklyStudyData || [],
     studyGoal: dashboardData?.study?.studyGoal || 10,
     daysStudied: dashboardData?.study?.daysStudied || 0,
     percentile: dashboardData?.progress?.percentile || 0,
     recentCourses: dashboardData?.progress?.recentCourses || [],
     achievements: achievements,
     certificates: certificates,
     intelligence: dashboardData?.intelligence || {}
  };

  const totalEnrolled = dashboardData?.overview?.totalEnrolled || 0;
  const totalLessonsCompleted = dashboardData?.overview?.completedLessons || 0;
  const averageProgress = dashboardData?.overview?.averageProgress || 0;
  const completedCourses = useMemo(() => enrolledCourses.filter(c => c.progress === 100 || c.status === 'completed' || c.completed === true), [enrolledCourses]);

  const certificateCourseIds = useMemo(
    () => new Set((certificatesData || []).map(c => c.courseId)),
    [certificatesData]
  );

  const readyToClaimCertificates = useMemo(() => completedCourses.filter(enrolled => {
    const courseId = enrolled.course?.id || enrolled.courseId;
    const isPassed = !enrolled.course?.isExamRequired || enrolled.passedFinalExam;
    return !certificateCourseIds.has(courseId) && isPassed;
  }), [completedCourses, certificateCourseIds]);

  const certificateEarnedCount = certificatesData?.length || 0;
  const readyToClaimCount = readyToClaimCertificates.length;
  const totalCertificateProgress = certificateEarnedCount + readyToClaimCount;

  const handleConnectionRequest = async (id, action) => {
    if (window.confirm(`Are you sure you want to ${action} this explicit connection?`)) {
      try {
        await api.post(`/connections/${id}/${action}`);
        alert(`Connection definitively ${action}ed.`);
        queryClient.invalidateQueries(['supportConnections']);
      } catch (err) {
        alert("Action failed: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleSponsorship = async (id, action) => {
    if (window.confirm(`Are you sure you want to ${action} this proxy connection?`)) {
      try {
        await api.post(`/support/${id}/${action}`);
        alert(`Sponsorship definitively ${action}ed.`);
        queryClient.invalidateQueries(['supportConnections']);
      } catch (err) {
        alert("Authorization failed: " + (err.response?.data?.message || err.message));
      }
    }
  };

  // Query fetches logs and achievements automatically based on activeTab (handled by query configuration above)

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!growthNote.trim()) return;
    try {
      await api.post('/activity', {
        action: 'Set a new personal micro-goal',
        type: 'learning',
        visibility: 'private',
        metadata: { goal: growthNote }
      });
      setGrowthNote('');
      queryClient.invalidateQueries({ queryKey: ['privateLogs'] });
      alert('Goal logged successfully!');
    } catch(err) { 
      console.error('Failed to log personal goal', err); 
      alert('Failed to log goal');
    }
  };

  const handleClaimCertificate = async (courseId) => {
    try {
      await api.post('/progress/certificate', { courseId });
      queryClient.invalidateQueries({ queryKey: ['studentDashboard'] });
      alert('Certificate claimed successfully!');
    } catch(err) { 
      console.error('Failed to claim certificate', err); 
      alert(err.response?.data?.message || 'Failed to claim certificate');
    }
  };

  const handleSelfAttendance = async (courseId) => {
    try {
      const { data } = await api.post('/attendance/self', { courseId });
      if (data.success) {
        alert(data.message || 'Attendance marked successfully for today!');
      } else {
        alert(data.message || 'Could not mark attendance.');
      }
    } catch (err) {
      console.error('Failed to mark attendance', err);
      alert(err.response?.data?.message || 'Failed to mark attendance.');
    }
  };

  // useMemo replaced by dashboard data from the endpoint.

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };



  const renderContent = () => {

    switch (activeTab) {
      case 'overview': {
        const userCertificates = dashboardStats?.certificates || [];
        const claimedCourseIds = userCertificates.map(c => c.courseId);
        const unclaimedCourses = completedCourses.filter(c => !claimedCourseIds.includes(c.course?.id || c.courseId));

        return (
          <div className="space-y-6">
            <StudentOverview 
              user={user}
              enrolledCourses={enrolledCourses}
              completedCourses={unclaimedCourses}
              totalEnrolled={totalEnrolled}
              totalLessonsCompleted={totalLessonsCompleted}
              averageProgress={averageProgress}
              isDarkMode={isDarkMode}
              setActiveTab={setActiveTab}
              dashboardStats={dashboardStats}
              certificateSummary={{
                claimed: certificateEarnedCount,
                readyToClaim: readyToClaimCount,
                total: totalCertificateProgress
              }}
            />
            <div className="space-y-6">
              <IntelligentLearningAnalytics enrolledCourses={enrolledCourses} dashboardStats={dashboardStats} isDarkMode={isDarkMode} />
              <RecommendationEnginePanel isDarkMode={isDarkMode} />
              <LearningProfileCard />
            </div>
          </div>
        );
      }
      case 'catalog': {
        return (
          <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full font-sans">
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <Globe className="w-8 h-8 text-[#00D4FF]" />
                  Course Catalog
                  {loading && <div className={`w-5 h-5 border-2 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'} ml-3`}></div>}
                </h1>
                <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Explore our carefully curated course packages below.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-none w-full">
              {PACKAGES.map((pkg, idx) => {
                const pkgCategoryName = pkg.title.replace(' Courses', '');
                const dbCategoryName = DB_CATEGORY_MAP[pkgCategoryName] || pkgCategoryName;
                const matchedCourses = dbCourses.filter(c => c.mainCategory === dbCategoryName);
                
                // Only consider active/completed enrollments as "Unlocked" in the catalog
                const activeEnrollments = enrolledCourses.filter(e => e.status === 'active' || e.status === 'completed' || e.completed);
                const enrolledInPkg = activeEnrollments.filter(enrollment => 
                  matchedCourses.some(mc => mc.id === enrollment.course?.id) || 
                  pkg.category === enrollment.course?.category ||
                  pkg.title.includes(enrollment.course?.category)
                );
                
                const isPkgEnrolled = enrolledInPkg.length > 0;
                return <PackageCard key={idx} pkg={{...pkg, courses: matchedCourses}} isEnrolled={isPkgEnrolled} enrolledCoursesData={enrolledInPkg} isDarkMode={isDarkMode} />
              })}
            </div>
          </div>
        );
      }

      case 'courses': {
        return (
          <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full font-sans">
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <BookOpen className="w-8 h-8 text-[#00D4FF]" />
                  My Courses
                </h1>
                <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Continue learning and track your progress.</p>
              </div>
              <button onClick={() => setActiveTab('catalog')} className={`px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all`}>
                 Browse Catalog
              </button>
            </div>
            
            {enrolledCourses.length === 0 ? (
               <div className={`p-12 text-center rounded-[24px] glass-panel border shadow-lg flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${isDarkMode ? 'bg-[#00D4FF]/10 text-orange-400 border-[#00D4FF]/20' : 'bg-orange-50 text-[#00D4FF] border-orange-100'}`}>
                   <BookOpen className="w-8 h-8" />
                 </div>
                 <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>No enrolled courses</h3>
                 <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>You haven't enrolled in any courses yet. Check out the catalog!</p>
                 <button onClick={() => setActiveTab('catalog')} className={`px-6 py-3 bg-[#00D4FF] hover:bg-[#EA580C] font-bold text-sm rounded-xl shadow-md transition-colors text-white`}>
                   Explore Catalog
                 </button>
               </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolledCourses.map((enrolled) => (
                    <EnrolledCourseCard 
                      key={enrolled.id} 
                      enrolled={enrolled} 
                      isDarkMode={isDarkMode} 
                      navigate={navigate} 
                      handleSelfAttendance={handleSelfAttendance} 
                    />
                  ))}
                </div>
            )}
          </div>
        );
      }

      case 'certificates': {
        const userCertificates = dashboardStats?.certificates || [];
        const claimedCourseIds = new Set(userCertificates.map(c => c.courseId));
        const unclaimedCourses = completedCourses.filter(c => {
          const courseId = c.course?.id || c.courseId;
          const passedExam = !c.course?.isExamRequired || c.passedFinalExam;
          return !claimedCourseIds.has(courseId) && passedExam;
        });

        return (
          <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full font-sans">
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 pt-2 mb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <div>
                <h1 className={`text-4xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <Award className="w-8 h-8 text-[#00D4FF]" />
                  My Credentials
                </h1>
                <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>View, claim, and export your achieved course certificates.</p>
              </div>
            </div>
            
            {unclaimedCourses.length === 0 && userCertificates.length === 0 ? (
               <div className={`p-12 text-center rounded-[24px] glass-panel border shadow-lg flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>
                   <Award className="w-8 h-8" />
                 </div>
                 <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>No certificates yet</h3>
                 <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                   You do not have any certificates yet. Complete a course and claim it to see it in this section.
                 </p>
                 <button 
                  onClick={() => setActiveTab('courses')}
                  className={`px-6 py-3 bg-blue-500 hover:bg-blue-600 font-bold text-sm rounded-xl shadow-md transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                 >
                   Continue Learning
                 </button>
               </div>
            ) : (
                <div className="space-y-8">
                  {unclaimedCourses.length > 0 && (
                    <div>
                      <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Available to Claim</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {unclaimedCourses.map((enrolled) => (
                          <div 
                            key={`unclaimed-${enrolled.id || enrolled.course?.id}`} 
                            className={`rounded-[24px] glass-panel border shadow-lg p-6 flex flex-col h-full transition-all relative group hover:-translate-y-1 ${isDarkMode ? 'border-[#00D4FF]/30 hover:border-[#00D4FF]' : 'border-orange-200 hover:border-orange-400'}`}
                          >
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto border ${isDarkMode ? 'bg-[#00D4FF]/10 text-orange-400 border-[#00D4FF]/20' : 'bg-orange-50 text-[#00D4FF] border-orange-100'}`}>
                              <Award className="w-8 h-8" />
                            </div>
                            <h3 className={`text-lg font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {enrolled.course?.title || 'Unknown Course'}
                            </h3>
                            <p className={`text-[11px] font-medium text-center mb-8 flex-1 ${isDarkMode ? 'text-orange-400' : 'text-[#00D4FF]'}`}>
                              Ready to be claimed!
                            </p>
                            
                            <button 
                              onClick={() => handleClaimCertificate(enrolled.course?.id || enrolled.courseId)}
                              className={`w-full inline-flex justify-center items-center gap-2 px-6 py-3 font-bold text-sm rounded-xl transition-colors shadow-sm bg-[#00D4FF] hover:bg-[#EA580C] text-white`}
                            >
                              Claim Now
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userCertificates.length > 0 && (
                    <div>
                      <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>My Certificates</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {userCertificates.map((cert) => (
                          <div 
                            key={`claimed-${cert.id}`} 
                            className={`rounded-[24px] glass-panel border shadow-lg p-6 flex flex-col h-full transition-all relative group hover:-translate-y-1 ${isDarkMode ? 'border-slate-700 hover:border-blue-500/50' : 'border-slate-200 hover:border-blue-300'}`}
                          >
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto border ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>
                              <Award className="w-8 h-8" />
                            </div>
                            <h3 className={`text-lg font-bold text-center mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {cert.course?.title || 'Unknown Course'}
                            </h3>
                            <p className={`text-[11px] font-medium text-center mb-8 flex-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}>
                              Issued: {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : 'N/A'}
                            </p>
                            <div className="flex gap-3 w-full mt-auto">
                              <button 
                                onClick={() => handleDownloadCertificate(cert, user?.name, 'view')}
                                className={`flex-1 inline-flex justify-center items-center gap-2 py-3 font-bold text-[13px] rounded-xl border transition-colors shadow-sm ${isDarkMode ? 'bg-slate-700/50 hover:bg-slate-600 text-white border-slate-600' : 'bg-slate-50 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                              >
                                View
                              </button>
                              <button 
                                onClick={() => handleDownloadCertificate(cert, user?.name, 'download')}
                                className={`flex-1 inline-flex justify-center items-center gap-2 py-3 font-bold text-[13px] rounded-xl border transition-colors shadow-sm bg-blue-500 hover:bg-blue-600 text-white border-blue-500`}
                              >
                                <Download className="w-4 h-4" /> Export PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            )}
          </div>
        );
      }
      case 'growth':
         return (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
                <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Personal Growth Lab</h2>
                <div className={`p-6 rounded-[24px] glass-panel border mb-6 shadow-lg ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <p className={`mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Set isolated growth objectives away from course structures.</p>
                    <form onSubmit={handleAddGoal} className="flex gap-4">
                        <input 
                            type="text" value={growthNote} onChange={e => setGrowthNote(e.target.value)}
                            placeholder="Set a new objective..."
                            className={`flex-1 !px-5 !py-2 border !rounded-full outline-none focus:ring-2 focus:ring-[#00D4FF]/50 transition-all ${isDarkMode ? 'bg-[#0B1120] border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                        />
                        <button type="submit" className={`px-6 py-2 !rounded-full-full text-sm font-semibold bg-[#00D4FF] hover:bg-[#ea580c] shadow-md ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add</button>
                    </form>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="md:col-span-2 space-y-6">
                      <div className={`p-6 rounded-[24px] glass-panel border shadow-lg ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                         <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Recent Tasks & Activity</h3>
                         <ActivityFeed feedType="personal" limit={10} />
                      </div>
                   </div>
                   <div className="md:col-span-1 space-y-6">
                      <div className={`p-6 rounded-[24px] glass-panel border shadow-lg ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                         <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Private Logs</h3>
                         {privateLogs.length === 0 ? (
                           <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No private logs yet.</p>
                         ) : (
                           <ul className="space-y-3">
                             {privateLogs.map(log => (
                               <li key={log.id} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-[#121A2F] border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-700'} text-sm`}>
                                  <span className="font-bold mr-2 text-[#00D4FF]">Goal:</span>
                                  {log.metadata?.goal || log.details || log.action}
                               </li>
                             ))}
                           </ul>
                         )}
                      </div>
                   </div>
                </div>
             </div>
         );
      case 'settings':
        return <SettingsView />;
      case 'ecosystem':
        return <EcosystemNexus />;
      case 'library':
        return <div className="p-8 max-w-none w-full"><LibraryView /></div>;
      case 'message':
        return <div className="p-8 max-w-none w-full"><MessagesView /></div>;

      case 'notice':
        return <div className="p-8 max-w-none w-full"><NoticeView /></div>;
      case 'sponsorships':
        return (
           <div className={`p-12 text-center rounded-[24px] glass-panel border m-8 shadow-lg ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <ShieldCheck className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Sponsorships Portal</h2>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>This module is currently under construction. Please check back later.</p>
           </div>
        );
      case 'schedule':
        return (
           <div className={`p-12 text-center rounded-[24px] glass-panel border m-8 shadow-lg ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <Clock className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Schedule Manager</h2>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>This module is currently under construction. Please check back later.</p>
           </div>
        );
      default:
        return null;
    }
  };

  const mutedTextClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const navItemClass = (tabName, isActive) => `
    relative w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 font-bold text-[13px] rounded-xl mb-1 overflow-hidden
    ${isActive 
      ? isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#EAF6ED] text-slate-900' 
      : 'bg-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-300'
    }
  `;

  const NavItem = ({ tabName, icon: Icon, label, isActive, badge, onClick }) => (
    <button onClick={onClick} className={navItemClass(tabName, isActive)}>
      {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#22C55E] rounded-r-full" />}
      <Icon className="w-5 h-5 shrink-0 opacity-80" />
      <span className="flex-1 text-left">{label}</span>
      {typeof badge === 'number' && (
        <span className={`${badge > 0 ? 'bg-[#22C55E] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'} text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0`}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className={`min-h-screen flex flex-row font-sans h-screen ${isDarkMode ? 'bg-[#0B1120] text-slate-200' : 'bg-[#FAFAFA] text-slate-700'}`}>
      


      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header Bar */}
        <header className={`h-[80px] flex items-center justify-between px-8 shrink-0 z-50 border-b shadow-[0_4px_15px_rgba(0,0,0,0.1)] ${isDarkMode ? 'bg-[#0B1120] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
           <div className="relative w-full max-w-md">
             <Search className={`w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
             <input type="text" placeholder="Search courses, lessons..." 
               className={`w-full !pl-12 !pr-4 !py-3 !rounded-full-full text-xs font-bold outline-none transition-all focus:border-[#00D4FF]/50 ${isDarkMode ? 'bg-[#121A2F] border-slate-800 text-white placeholder:text-slate-500' : 'bg-[#F9FAFB] border-transparent text-slate-700 placeholder:text-slate-400'}`} />
           </div>

           <div className="flex items-center gap-4">
             <ThemeDropdown />
             
             <div className={`relative cursor-pointer hover:bg-slate-50 p-2.5 rounded-full transition-colors border shadow-sm ${isDarkMode ? 'bg-[#121A2F] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
               <Bell className="w-5 h-5" />
               <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white dark:border-slate-800">1</span>
             </div>

             <div className="flex items-center gap-4 cursor-pointer pl-6 border-l dark:border-slate-800 border-slate-200">
               <div className="flex flex-col items-end">
                 <span className={`text-[13px] font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Test User 
                 </span>
                 <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    student
                 </span>
               </div>
               <div className={`w-10 h-10 rounded-full flex items-center justify-center border-[2.5px] overflow-hidden shadow-sm ${isDarkMode ? 'bg-[#121A2F] border-emerald-500/50 text-emerald-400' : 'bg-white border-[#22C55E] text-[#22C55E]'}`}>
                 <span className="font-bold text-sm">T</span>
               </div>
             </div>
           </div>
        </header>
        
        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto relative ${isDarkMode ? 'bg-[#0B1120]' : 'bg-[#FAFAFA]'}`}>
          <div className="max-w-none w-full p-6 md:p-8 relative z-10">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
