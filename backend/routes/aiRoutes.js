import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { protect, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { buildPersonalizedStudyContext, normalizeQuizQuestions } from '../services/studyToolsService.js';

const router = express.Router();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

/**
 * Helper to call Gemini and return raw text
 */
async function callGemini(systemInstruction, promptText) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
        throw new Error('Gemini API key is not configured.');
    }
    const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        systemInstruction: systemInstruction
    });
    const result = await model.generateContent(promptText);
    const response = await result.response;
    return response.text().trim();
}

/**
 * Helper to clean JSON markdown wrappers if returned by AI
 */
function cleanJsonString(str) {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
}

// ==================== 1. AI STUDY PLANNER ====================

router.post('/study-planner', protect, checkNotBlocked, async (req, res) => {
    try {
        const { subjects, examDate, dailyHours } = req.body;

        if (!subjects || !Array.isArray(subjects) || subjects.length === 0 || !examDate || !dailyHours) {
            return res.status(400).json({ success: false, message: 'Subjects, examDate, and dailyHours are required' });
        }

        const [profile, enrollments] = await Promise.all([
            prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
            prisma.userCourseProgress.findMany({
                where: { userId: req.user.id },
                include: { course: true },
                take: 6,
                orderBy: { enrolledAt: 'desc' }
            })
        ]);

        const studyContext = buildPersonalizedStudyContext({ profile, enrollments });

        const systemInstruction = "You are a professional academic planner and counselor. You generate structured revision schedules to help students prepare for upcoming exams.";
        const prompt = `Generate a personalized study plan for these subjects: ${subjects.join(', ')}. Target exam date: ${examDate}. Available daily hours: ${dailyHours}. Learner context: ${studyContext.personalizationSummary}. Current focus: ${studyContext.currentFocus}. Active courses: ${studyContext.activeCourses.join(', ') || 'none'}. 
        Return the schedule strictly as a JSON array of daily activities. Each day object must contain:
        - "day": string (e.g. "Day 1: Monday", "Day 2: Tuesday")
        - "hours": number (daily hours dedicated)
        - "focus": string (subject/topic of focus)
        - "activities": array of strings (specific steps, revision tasks, or modules to cover).
        Return ONLY the raw JSON array. Do not wrap it in markdown backticks or include any formatting text.`;

        const rawText = await callGemini(systemInstruction, prompt);
        const cleanedText = cleanJsonString(rawText);
        const parsedTimetable = JSON.parse(cleanedText);

        // Save in DB
        const savedPlan = await prisma.studyPlan.create({
            data: {
                userId: req.user.id,
                subjects,
                examDate: new Date(examDate),
                dailyHours: parseFloat(dailyHours),
                timetable: parsedTimetable
            }
        });

        res.status(201).json({ success: true, data: savedPlan });
    } catch (error) {
        console.error('Study Planner Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate study plan', error: error.message });
    }
});

router.get('/study-planner', protect, async (req, res) => {
    try {
        const plans = await prisma.studyPlan.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch study plans' });
    }
});

router.delete('/study-planner/:id', protect, async (req, res) => {
    try {
        await prisma.studyPlan.delete({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ success: true, message: 'Study plan deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete study plan' });
    }
});

// ==================== 2. AI FLASHCARD GENERATOR ====================

router.post('/flashcards', protect, checkNotBlocked, async (req, res) => {
    try {
        const { title, text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Source text/notes are required' });
        }

        const [profile, enrollments] = await Promise.all([
            prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
            prisma.userCourseProgress.findMany({
                where: { userId: req.user.id },
                include: { course: true },
                take: 6,
                orderBy: { enrolledAt: 'desc' }
            })
        ]);

        const studyContext = buildPersonalizedStudyContext({ profile, enrollments });

        const systemInstruction = "You are an AI study assistant. Your job is to extract key concepts from user notes and turn them into question-and-answer study flashcards.";
        const prompt = `Generate a list of 5-8 revision flashcards based on this text:\n"${text}"\n\nLearner context: ${studyContext.personalizationSummary}. Current focus: ${studyContext.currentFocus}. Suggested topics: ${studyContext.studyTopics.slice(0, 4).join(', ')}.\n\n
        Return the result strictly as a JSON array of objects. Each object must have:
        - "question": string (concept query or question)
        - "answer": string (concise explanation or answer)
        Return ONLY the raw JSON array. Do not wrap in markdown or add explanations.`;

        const rawText = await callGemini(systemInstruction, prompt);
        const cleanedText = cleanJsonString(rawText);
        const parsedCards = JSON.parse(cleanedText);

        // Save in DB
        const savedDeck = await prisma.flashcardDeck.create({
            data: {
                userId: req.user.id,
                title: title || 'AI Generated Cards',
                cards: parsedCards
            }
        });

        res.status(201).json({ success: true, data: savedDeck });
    } catch (error) {
        console.error('Flashcard Gen Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate flashcards', error: error.message });
    }
});

router.get('/flashcards', protect, async (req, res) => {
    try {
        const Decks = await prisma.flashcardDeck.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: Decks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch flashcard decks' });
    }
});

router.delete('/flashcards/:id', protect, async (req, res) => {
    try {
        await prisma.flashcardDeck.delete({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ success: true, message: 'Flashcard deck deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete flashcard deck' });
    }
});

// ==================== 3. AI QUIZ GENERATOR ====================

router.post('/quiz', protect, checkNotBlocked, async (req, res) => {
    try {
        const { text, difficulty } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Source text/notes are required' });
        }

        const [profile, enrollments] = await Promise.all([
            prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
            prisma.userCourseProgress.findMany({
                where: { userId: req.user.id },
                include: { course: true },
                take: 6,
                orderBy: { enrolledAt: 'desc' }
            })
        ]);

        const studyContext = buildPersonalizedStudyContext({ profile, enrollments });
        const diffStr = difficulty || 'Intermediate';
        const systemInstruction = "You are an AI teacher. You design self-evaluation quizzes based on notes provided by students.";
        const prompt = `Create a quiz with 5 questions based on this text:\n"${text}"\n\nDifficulty level: ${diffStr}. Learner context: ${studyContext.personalizationSummary}. Current focus: ${studyContext.currentFocus}. Suggested topics: ${studyContext.studyTopics.slice(0, 4).join(', ')}.\n
        Your output must be strictly a JSON array of objects.
        Each question object must contain:
        - "question": string (the question statement)
        - "type": string ("mcq", "true_false", or "short_answer")
        - "options": array of strings (for MCQ: exactly 4 choices. For True/False: exactly ["True", "False"]. For short_answer: an empty array)
        - "correctAnswer": string (for short_answer, provide the canonical answer; for MCQ/True-False, it must exactly match one of the options)
        - "acceptableAnswers": array of strings (only for short_answer; include 1-3 acceptable variations)
        - "explanation": string (brief detail on why this answer is correct)
        Return ONLY the raw JSON array. Do not wrap in markdown or add helper text.`;

        const rawText = await callGemini(systemInstruction, prompt);
        const cleanedText = cleanJsonString(rawText);
        const parsedQuiz = JSON.parse(cleanedText);
        const normalizedQuiz = normalizeQuizQuestions(parsedQuiz);

        res.json({ success: true, quiz: normalizedQuiz });
    } catch (error) {
        console.error('Quiz Gen Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate quiz', error: error.message });
    }
});

// ==================== 4. AI NOTES SUMMARIZER ====================

router.post('/summarize', protect, checkNotBlocked, async (req, res) => {
    try {
        const { text, format } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Text content is required' });
        }

        const [profile, enrollments] = await Promise.all([
            prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
            prisma.userCourseProgress.findMany({
                where: { userId: req.user.id },
                include: { course: true },
                take: 6,
                orderBy: { enrolledAt: 'desc' }
            })
        ]);

        const studyContext = buildPersonalizedStudyContext({ profile, enrollments });
        const formatType = format || 'bullet_points';
        const formatPrompts = {
            bullet_points: "summarized as brief, high-impact bullet points focusing on core key takeaways.",
            study_guide: "formatted as a structured study guide with definitions, key equations/theories, and brief concept breakdowns.",
            mind_map: "formatted as a textual hierarchial overview resembling nodes in a mind map concept directory."
        };

        const formatInstruction = formatPrompts[formatType] || formatPrompts.bullet_points;

        const systemInstruction = "You are an expert summary editor. You turn long textbooks and lecture notes into concise study files.";
        const prompt = `Please summarize the following notes. The summary must be ${formatInstruction}\n\nNotes:\n"${text}"\n\nLearner context: ${studyContext.personalizationSummary}. Current focus: ${studyContext.currentFocus}. Active courses: ${studyContext.activeCourses.join(', ') || 'none'}.\n\n
        Return the final summary formatted in clean, beautiful Markdown. Avoid dense paragraphs. Use headers and emojis where appropriate. Do not use horizontal lines ('---').`;

        const summary = await callGemini(systemInstruction, prompt);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('Summarizer Error:', error);
        res.status(500).json({ success: false, message: 'Failed to summarize notes', error: error.message });
    }
});

// ==================== 4.1. AI LESSON ASSISTANT ====================

router.post('/chat-lesson', protect, checkNotBlocked, async (req, res) => {
    try {
        const { question, lessonTitle, lessonContext, history } = req.body;

        if (!lessonTitle) {
            return res.status(400).json({ success: false, message: 'Lesson title is required' });
        }
        if (!question) {
            return res.status(400).json({ success: false, message: 'Question is required' });
        }

        const systemInstruction = `You are EDOT Mentor AI, a premium personal AI study mentor for the EDOT educational platform.
        You are helping a student with the lesson: "${lessonTitle}".
        Here is the context/reading material of the lesson to reference:
        "${lessonContext || 'No additional notes provided.'}"
        
        Guidelines:
        - Answer the student's question accurately, directly, and helpfully using the provided lesson context.
        - Keep your explanations concise, encouraging, and clear. Use formatting (bold, italic, list items, code blocks) to make your response highly readable.
        - Never use horizontal dividers ('---').
        - Break long explanations into short paragraphs (1-2 sentences per paragraph).
        - Use helpful learning emojis to make the response engaging.`;

        let chatPrompt = `Student's Question: "${question}"`;
        if (history && Array.isArray(history) && history.length > 0) {
            const formattedHistory = history.map(h => `${h.role === 'user' ? 'Student' : 'Mentor'}: ${h.content}`).join('\n');
            chatPrompt = `Here is the conversation history:\n${formattedHistory}\n\nStudent's new question: "${question}"\n\nMentor response:`;
        }

        const reply = await callGemini(systemInstruction, chatPrompt);
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Chat Lesson Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate mentor response', error: error.message });
    }
});

// ==================== 4.2. AI TUTOR ASSISTANT ====================

router.post('/tutor-helper', protect, checkNotBlocked, async (req, res) => {
    try {
        const { type, courseTitle, courseDescription, lessonTitle, lessonOverview } = req.body;

        if (type === 'syllabus') {
            if (!courseTitle) {
                return res.status(400).json({ success: false, message: 'Course title is required' });
            }
            const systemInstruction = "You are a professional curriculum designer and academic director. You generate syllabus structures.";
            const prompt = `Generate a structured, logical learning syllabus outline for a course named: "${courseTitle}".
            Course Description: "${courseDescription || 'Not specified'}"
            
            Return the outline strictly as a JSON array of phase objects. Each phase must contain:
            - "phase": string (e.g. "Phase 1: Foundations", "Phase 2: Core Architectures")
            - "lessons": array of strings (recommended lesson titles in that phase).
            
            Return ONLY the raw JSON array. Do not wrap in markdown code blocks or backticks.`;

            const rawText = await callGemini(systemInstruction, prompt);
            const cleanedText = cleanJsonString(rawText);
            const syllabus = JSON.parse(cleanedText);
            return res.json({ success: true, data: syllabus });
        } 
        
        else if (type === 'lesson_content') {
            if (!lessonTitle) {
                return res.status(400).json({ success: false, message: 'Lesson title is required' });
            }
            const systemInstruction = "You are a professional educator and academic copywriter. You write engaging, comprehensive study notes.";
            const prompt = `Generate comprehensive, structured reading materials/study notes for a lesson named: "${lessonTitle}" inside a course about: "${courseTitle || 'General Subject'}".
            Lesson Overview: "${lessonOverview || 'Not specified'}"
            
            Guidelines:
            - Provide clear definitions, theories, concept explanations, and practical examples.
            - Write in clean, beautiful Markdown formatting with clear headers, bold items, and lists.
            - Do not use horizontal lines ('---').
            - Keep paragraphs short and use helpful learning emojis.`;

            const content = await callGemini(systemInstruction, prompt);
            return res.json({ success: true, content });
        } 
        
        else {
            return res.status(400).json({ success: false, message: 'Invalid helper type' });
        }
    } catch (error) {
        console.error('Tutor Helper Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate content', error: error.message });
    }
});



// ==================== 5. CAREER ADVISOR AI ====================

router.post('/career-advisor', protect, checkNotBlocked, async (req, res) => {
    try {
        const { careerGoal, currentSkills } = req.body;

        if (!careerGoal) {
            return res.status(400).json({ success: false, message: 'Career goal is required' });
        }

        const systemInstruction = "You are an expert career placement officer and technical career coach. You build personalized skill roadmaps.";
        const prompt = `My career goal is to become: **${careerGoal}**. 
        My current skills are: ${currentSkills || 'None listed yet'}.
        
        Generate a detailed Career Roadmap including:
        1. 🚀 **Roadmap Summary**: Brief encouragement and explanation of the role's market value.
        2. 🛠️ **Missing Skills**: Clear technical and soft skills I need to acquire.
        3. 📚 **Recommended Course Path**: Suggest specific courses I should enroll in on EDOT (e.g. JavaScript Programming, Machine Learning foundations, TOEFL prep, MBA concepts, etc.) or standard industry certifications.
        4. 📈 **Job Prep Tips**: Brief action plan to stand out.
        
        Provide the output in clean, structured Markdown using bullet points, emojis, bold highlights, and italics. Do NOT use horizontal divider lines ('---').`;

        const advice = await callGemini(systemInstruction, prompt);
        res.json({ success: true, advice });
    } catch (error) {
        console.error('Career Advisor Error:', error);
        res.status(500).json({ success: false, message: 'Failed to get career advice', error: error.message });
    }
});

// ==================== 6. INTERVIEW COACH ====================

router.post('/interview-coach', protect, checkNotBlocked, async (req, res) => {
    try {
        const { role, history, message } = req.body;

        if (!role || !message) {
            return res.status(400).json({ success: false, message: 'Role and message are required' });
        }

        const systemInstruction = `You are a professional mock interviewer for the role: ${role}. 
        Your goal is to conduct an interactive mock interview. 
        Ask one interview question at a time, wait for the student's answer, and then provide a brief positive review and ask the next question.
        If the user says 'done', 'finish', or asks for final scores/evaluation, stop asking questions and generate a scorecard:
        - **Overall Score**: out of 100
        - **Technical Skills Evaluation**: feedback & score
        - **Communication Rating**: feedback & score
        - **Confidence Rating**: feedback & score
        - **Specific Tips to Improve**
        
        Format all responses in clean Markdown. Keep paragraphs short and use emojis. Do not use horizontal lines ('---').`;

        // Format history for chat
        const prompt = `Here is the interview chat history:\n${(history || []).map(h => `${h.role === 'user' ? 'Candidate' : 'Interviewer'}: ${h.content}`).join('\n')}\n\nCandidate's response: "${message}"\n\nRespond as the Interviewer:`;

        const reply = await callGemini(systemInstruction, prompt);
        res.json({ success: true, reply });
    } catch (error) {
        console.error('Interview Coach Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate interview response', error: error.message });
    }
});

// ==================== 7. RESUME ANALYZER ====================

router.post('/resume-analyzer', protect, checkNotBlocked, async (req, res) => {
    try {
        const { resumeText, targetRole } = req.body;

        if (!resumeText || !targetRole) {
            return res.status(400).json({ success: false, message: 'Resume text and target role are required' });
        }

        const systemInstruction = "You are an advanced ATS (Applicant Tracking System) scanner and professional resume writer.";
        const prompt = `Analyze this candidate's resume for the target role: **${targetRole}**.\n\nResume Text:\n"${resumeText}"\n\n
        Please provide a detailed review matching these criteria:
        1. 📊 **ATS Match Rating**: Score from 0 to 100 representing how well the resume matches the target role.
        2. 🔍 **Missing Keywords & Skills**: Bulleted list of crucial terms/skills missing from the resume.
        3. 💡 **Improvement Suggestions**: Detailed actionable tips to improve formatting, impact verbs, and wording.
        4. 📈 **Impact Bullet Rewrites**: Show 2-3 examples of rewritten resume bullets to sound more metrics-driven (using X-Y-Z formula: Accomplished [X] as measured by [Y], by doing [Z]).
        
        Provide the response in clean, beautiful Markdown. Use bold/italic highlights and emojis. Do not use horizontal dividers ('---').`;

        const analysis = await callGemini(systemInstruction, prompt);
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Resume Analyzer Error:', error);
        res.status(500).json({ success: false, message: 'Failed to analyze resume', error: error.message });
    }
});

// ==================== 8. AI LEARNING TWIN ====================

router.get('/twin', protect, checkNotBlocked, async (req, res) => {
    try {
        // Query user's current progress & dashboard stats
        const enrollments = await prisma.userCourseProgress.findMany({
            where: { userId: req.user.id },
            include: { course: true }
        });

        const activityLogs = await prisma.activity.findMany({
            where: { userId: req.user.id },
            take: 15,
            orderBy: { createdAt: 'desc' }
        });

        const systemInstruction = "You are the AI Learning Twin, a virtual cognitive profile representing the student's study personality, strengths, weaknesses, and educational goals.";
        const prompt = `Analyze this student's profile and progress to output their twin persona:
        Name: ${req.user.name}
        Enrolled Courses: ${enrollments.map(e => `${e.course.title} (Progress: ${e.progress}%, Completed: ${e.completed})`).join(', ') || 'No active courses enrolled yet'}
        Recent Activities: ${activityLogs.map(l => l.action).join(', ') || 'No activities logged yet'}
        
        Provide a customized, human-centered analysis strictly in JSON format.
        The JSON object must contain exactly:
        - "strengths": string (1-2 sentences on what they excel in based on enrollments/activities)
        - "weaknesses": string (1-2 sentences on what skills or areas they need to focus on)
        - "pace": string (e.g. "Fast-Paced Challenger", "Consistent Steady Learner", "In need of study goal triggers")
        - "recommendations": array of strings (3 suggested specific courses or actions they should take next on EDOT).
        
        Return ONLY the raw JSON object. Do not wrap in markdown code blocks or backticks.`;

        const rawText = await callGemini(systemInstruction, prompt);
        const cleanedText = cleanJsonString(rawText);
        const twinProfile = JSON.parse(cleanedText);

        res.json({ success: true, twinProfile });
    } catch (error) {
        console.error('Learning Twin Error:', error);
        // Fallback default twin profile if generation or parsing fails
        res.json({
            success: true,
            twinProfile: {
                strengths: "Ready to start! You are set up to explore programming, sciences, and business analytics.",
                weaknesses: "No active course statistics recorded. Enroll in a course to start tracking your strengths and skill gaps.",
                pace: "Fresh Challenger",
                recommendations: [
                    "Explore 'Programming & Technology' packages",
                    "Browse the complete Course Catalog",
                    "Configure a weekly study goal"
                ]
            }
        });
    }
});

export default router;
