import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import libraryRoutes from './routes/libraryRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import parentRoutes from './routes/parentRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import achievementRoutes from './routes/achievementRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import sponsorRoutes from './routes/sponsorRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import materialRoutes from './routes/materialRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import liveClassRoutes from './routes/liveClassRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import learningProfileRoutes from './routes/learningProfileRoutes.js';
import mentorRoutes from './routes/mentorRoutes.js';
import courseIntelligenceRoutes from './routes/courseIntelligenceRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
import initializeIntelligenceCore from './src/intelligence/index.js';
import learningEventRoutes from './src/intelligence/events/eventRoutes.js';
import profileRoutes from './src/intelligence/profile/profileRoutes.js';
import analyticsRoutes from './src/intelligence/analytics/analyticsRoutes.js';
import mentorDomainRoutes from './src/intelligence/mentor/mentorRoutes.js';
import recommendationDomainRoutes from './src/intelligence/recommendations/recommendationRoutes.js';
import adaptiveDomainRoutes from './src/intelligence/adaptive/adaptiveRoutes.js';
import courseIntelligenceDomainRoutes from './src/intelligence/course/courseIntelligenceRoutes.js';
import opportunityDomainRoutes from './src/intelligence/opportunity/opportunityRoutes.js';
import healthDomainRoutes from './src/intelligence/monitoring/healthRoutes.js';
import passportDomainRoutes from './src/intelligence/passport/passportRoutes.js';
import careerDomainRoutes from './src/intelligence/career/careerRoutes.js';
import institutionDomainRoutes from './src/intelligence/institution/institutionRoutes.js';
import skillGraphDomainRoutes from './src/intelligence/skills/skillGraphRoutes.js';
import understandingDomainRoutes from './src/intelligence/understanding/understandingRoutes.js';
import practiceDomainRoutes from './src/intelligence/practice/practiceRoutes.js';
import assessmentDomainRoutes from './src/intelligence/assessment/assessmentRoutes.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/live-classes', liveClassRoutes);
app.use('/api/dashboard', dashboardRoutes); // Consolidated dashboard routes (replaces oldDashboardRoutes & newDashboardRoutes)
app.use('/api/expenses', expenseRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/learning-profile', learningProfileRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/course-intelligence', courseIntelligenceRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/learning/events', learningEventRoutes);
app.use('/learning/events', learningEventRoutes);
app.use('/intelligence/profile', profileRoutes);
app.use('/api/intelligence/profile', profileRoutes);
app.use('/intelligence/analytics', analyticsRoutes);
app.use('/instructor/analytics', analyticsRoutes);
app.use('/admin/analytics', analyticsRoutes);
app.use('/admin/learners', analyticsRoutes);
app.use('/intelligence/mentor', mentorDomainRoutes);
app.use('/api/intelligence/mentor', mentorDomainRoutes);
app.use('/intelligence/recommendations', recommendationDomainRoutes);
app.use('/api/intelligence/recommendations', recommendationDomainRoutes);
app.use('/intelligence/next-action', recommendationDomainRoutes);
app.use('/api/intelligence/next-action', recommendationDomainRoutes);
app.use('/intelligence/learning-plan', adaptiveDomainRoutes);
app.use('/api/intelligence/learning-plan', adaptiveDomainRoutes);
app.use('/intelligence/adaptive-path', adaptiveDomainRoutes);
app.use('/api/intelligence/adaptive-path', adaptiveDomainRoutes);
app.use('/intelligence/adaptive-plan', adaptiveDomainRoutes);
app.use('/api/intelligence/adaptive-plan', adaptiveDomainRoutes);
app.use('/intelligence/opportunities', opportunityDomainRoutes);
app.use('/api/intelligence/opportunities', opportunityDomainRoutes);
app.use('/intelligence/skill-passport', passportDomainRoutes);
app.use('/api/intelligence/skill-passport', passportDomainRoutes);
app.use('/intelligence/career', careerDomainRoutes);
app.use('/api/intelligence/career', careerDomainRoutes);
app.use('/intelligence/institution', institutionDomainRoutes);
app.use('/api/intelligence/institution', institutionDomainRoutes);
app.use('/intelligence/skills', skillGraphDomainRoutes);
app.use('/api/intelligence/skills', skillGraphDomainRoutes);
app.use('/intelligence/understanding', understandingDomainRoutes);
app.use('/api/intelligence/understanding', understandingDomainRoutes);
app.use('/intelligence/practice', practiceDomainRoutes);
app.use('/api/intelligence/practice', practiceDomainRoutes);
app.use('/intelligence/assessment', assessmentDomainRoutes);
app.use('/api/intelligence/assessment', assessmentDomainRoutes);
app.use('/intelligence', healthDomainRoutes);
app.use('/api/intelligence', healthDomainRoutes);
app.use('/', courseIntelligenceDomainRoutes);

// Mount EDOT Intelligence Core (Domain Architecture)
initializeIntelligenceCore(app, '/api/v2/intelligence');



app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to EDOT API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      users: '/api/users'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = Number(process.env.PORT) || 5000;

httpServer.on('error', (error) => {
  if (error.syscall !== 'listen') {
    console.error('Server error:', error);
    process.exit(1);
  }

  const bind = typeof PORT === 'string'
    ? `Pipe ${PORT}`
    : `Port ${PORT}`;

  if (error.code === 'EADDRINUSE') {
    console.error(`${bind} is already in use. Please stop the running process or set a different PORT.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

const serverInstance = httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with WebSockets`);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Closing server...`);
  serverInstance.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

