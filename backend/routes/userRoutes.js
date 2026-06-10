import express from 'express';
import { protect } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import dashboardService from '../services/dashboardService.js';

const router = express.Router();

router.get('/public/recent', async (req, res) => {
    try {
        // Fetch 4 diverse recent users (excluding admins for public display)
        const recentUsers = await prisma.user.findMany({
            where: {
                role: { not: 'admin' },
                NOT: [
                    { name: { contains: 'test', mode: 'insensitive' } },
                    { name: { contains: 'Test', mode: 'insensitive' } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 4,
            select: { 
                id: true, 
                name: true, 
                avatar: true,
                role: true
            }
        });

        // Generate default avatars using UI Avatars service if not set
        const users = recentUsers.map(user => ({
            ...user,
            avatar: user.avatar && user.avatar !== 'default-avatar.png' 
                ? user.avatar 
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`
        }));

        const totalCount = await prisma.user.count({
            where: { role: { not: 'admin' } }
        });

        res.json({
            success: true,
            users,
            totalCount
        });
    } catch (error) {
        console.error('Get recent public users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/public/verify-certificate/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const certificate = await prisma.certificate.findFirst({
            where: {
                OR: [
                    { id: hash },
                    { verificationHash: hash }
                ]
            },
            include: {
                user: { select: { name: true, email: true, avatar: true } },
                course: { select: { title: true, level: true, duration: true, rating: true } }
            }
        });

        if (!certificate) {
            return res.status(404).json({
                success: false,
                message: 'Certificate not found in the registry.'
            });
        }

        // Retrieve associated sponsorship campaign details securely
        let sponsorship = null;
        try {
            sponsorship = await prisma.sponsorship.findFirst({
                where: {
                    targetStudentId: certificate.userId,
                    courseId: certificate.courseId
                }
            });
        } catch (e) {
            console.error('Failed to fetch certificate sponsorship details:', e);
        }

        res.json({
            success: true,
            certificate,
            sponsorship: sponsorship ? {
                id: sponsorship.id,
                category: sponsorship.category,
                sponsorName: sponsorship.isAnonymous ? 'Anonymous Supporter (Privacy Protected 🔒)' : (sponsorship.sponsorName || 'EDOT Supporter'),
                isAnonymous: sponsorship.isAnonymous,
                amount: sponsorship.amount,
                status: sponsorship.status
            } : null
        });
    } catch (error) {
        console.error('Public certificate verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying certificate.'
        });
    }
});

router.get('/profile', protect, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                enrollments: {
                    include: {
                        course: {
                            include: { instructor: { select: { name: true } } }
                        }
                    }
                },
                parent: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
                children: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
                sponsorships: { 
                    include: { 
                        sponsor: { select: { id: true, name: true, email: true, avatar: true } },
                        targetStudent: { select: { id: true, name: true, email: true, avatar: true } }
                    } 
                },
                sponsoredStudents: { 
                    include: { 
                        targetStudent: { select: { id: true, name: true, email: true, avatar: true } }
                    } 
                },
                learnerGroups: true
            }
        });
        
        if (user) {
            delete user.password;
            // Map singular 'parent' to 'parents' array for frontend compatibility
            user.parents = user.parent ? [user.parent] : [];
            delete user.parent;
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/notifications', protect, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Fetch notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/notifications/read-all', protect, async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Mark notifications read failed:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const { 
            name, bio, avatar, coverPhoto, phone,
            gender, dateOfBirth, address, emergencyContact, department, specialization, occupation 
        } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (coverPhoto !== undefined) updateData.coverPhoto = coverPhoto;
        if (phone !== undefined) updateData.phone = phone;
        if (gender !== undefined) updateData.gender = gender;
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
        if (address !== undefined) updateData.address = address;
        if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
        if (department !== undefined) updateData.department = department;
        if (specialization !== undefined) updateData.specialization = specialization;
        if (occupation !== undefined) updateData.occupation = occupation;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                bio: updatedUser.bio,
                avatar: updatedUser.avatar,
                coverPhoto: updatedUser.coverPhoto,
                phone: updatedUser.phone,
                gender: updatedUser.gender,
                dateOfBirth: updatedUser.dateOfBirth,
                address: updatedUser.address,
                emergencyContact: updatedUser.emergencyContact,
                department: updatedUser.department,
                specialization: updatedUser.specialization,
                occupation: updatedUser.occupation
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/mycourses', protect, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                enrollments: {
                    include: {
                        course: {
                            include: {
                                instructor: { select: { name: true } },
                                lessons: true
                            }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            enrolledCourses: user?.enrollments || []
        });
    } catch (error) {
        console.error('Get my courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/dashboard-stats', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const [recentCourses, allProgress, userSettings, recentLogs, recentActivities, achievementsData, userCertificates] = await Promise.all([
            prisma.userCourseProgress.findMany({
                where: { userId },
                select: {
                    id: true,
                    courseId: true,
                    progress: true,
                    status: true,
                    passedFinalExam: true,
                    completedLessons: true,
                    enrolledAt: true,
                    course: { select: { id: true, title: true } }
                },
                orderBy: { enrolledAt: 'desc' },
                take: 3
            }),
            prisma.userCourseProgress.findMany({
                where: { userId },
                select: { progress: true }
            }),
            prisma.userSetting.findUnique({
                where: { userId },
                select: { weeklyStudyGoal: true }
            }),
            prisma.progressLog.findMany({
                where: {
                    userId,
                    updatedAt: { gte: startOfWeek }
                },
                select: { updatedAt: true, videoSegments: true }
            }),
            prisma.activity.findMany({
                where: {
                    userId,
                    createdAt: { gte: startOfWeek }
                },
                select: { createdAt: true, action: true }
            }),
            prisma.achievement.findUnique({
                where: { userId },
                select: { badges: true }
            }),
            prisma.certificate.findMany({
                where: { userId },
                select: { courseId: true }
            })
        ]);

        let recentCoursesData = recentCourses;

        if (recentCoursesData.length === 0) {
            const enrollments = await prisma.enrollment.findMany({
                where: { studentId: userId },
                select: {
                    id: true,
                    courseId: true,
                    status: true,
                    createdAt: true,
                    course: { select: { id: true, title: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 3
            });

            const certCourseIds = new Set(userCertificates.map(c => c.courseId));

            recentCoursesData = enrollments.map(e => ({
                id: e.id,
                courseId: e.courseId,
                course: e.course,
                progress: certCourseIds.has(e.courseId) ? 100 : 0,
                completedLessons: [],
                status: certCourseIds.has(e.courseId) ? 'completed' : e.status
            }));
        }

        const studyGoal = userSettings?.weeklyStudyGoal || 10;

        const weeklyDataMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        recentLogs.forEach(log => {
            const dayName = dayNames[log.updatedAt.getDay()];
            let segments = 0;
            if (log.videoSegments) {
                segments = Array.isArray(log.videoSegments) ? log.videoSegments.length : 1;
            }
            const hours = (segments * 30) / 3600;
            weeklyDataMap[dayName] += hours;
        });

        // Add 0.5 hours for every activity done (like completing a quiz, posting, etc) to reflect real progress
        recentActivities.forEach(act => {
            const dayName = dayNames[act.createdAt.getDay()];
            weeklyDataMap[dayName] += 0.5;
        });

        const weeklyStudyData = Object.keys(weeklyDataMap).map(day => ({
            name: day,
            hours: Math.round(weeklyDataMap[day] * 10) / 10
        }));

        const daysStudied = weeklyStudyData.filter(d => d.hours > 0).length;

        const avg = allProgress.length > 0 ? allProgress.reduce((sum, p) => sum + p.progress, 0) / allProgress.length : 0;
        const percentile = Math.min(99, Math.floor(30 + (avg * 0.6)));

        const badges = Array.isArray(achievementsData?.badges) ? achievementsData.badges : [];
        const certificatesCount = userCertificates.length;
        const completedCoursesCount = recentCoursesData.filter(c => c.progress === 100 || c.status === 'completed').length;

        const generatedBadges = [];
        if (certificatesCount > 0) {
            generatedBadges.push({
                id: 'cert_1',
                title: 'Certified Scholar',
                icon: 'Award',
                date: new Date().toISOString(),
                description: `Earned ${certificatesCount} platform certificates`
            });
        }
        if (completedCoursesCount > 0) {
            generatedBadges.push({
                id: 'comp_1',
                title: 'Course Finisher',
                icon: 'Star',
                date: new Date().toISOString(),
                description: `Completed ${completedCoursesCount} full courses`
            });
        }
        if (daysStudied >= 3) {
            generatedBadges.push({
                id: 'streak_1',
                title: 'Consistent Learner',
                icon: 'Zap',
                date: new Date().toISOString(),
                description: `Studied ${daysStudied} days this week`
            });
        }

        const finalBadges = [...badges];
        generatedBadges.forEach(gb => {
            if (!finalBadges.find(b => b.title === gb.title)) {
                finalBadges.push(gb);
            }
        });

        res.json({
            success: true,
            data: {
                recentCourses: recentCoursesData,
                studyGoal,
                weeklyStudyData,
                daysStudied,
                percentile,
                achievements: finalBadges,
                certificates: userCertificates
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/ecosystem', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. Get real user with relationships
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                parent: true,
                assignedInstructor: true,
                enrollments: {
                    include: {
                        course: {
                            include: { instructor: true }
                        }
                    }
                },
                sponsorships: {
                    include: {
                        sponsor: true
                    }
                }
            }
        });

        // Collect parents
        const parents = [];
        if (user.parent) {
            parents.push({
                id: user.parent.id,
                name: user.parent.name,
                status: 'active',
                encryptionKey: `E2E-${user.parent.id.substring(0, 4).toUpperCase()}`
            });
        }

        // Collect distinct instructors from enrollments + assignedInstructor
        const instructorMap = new Map();
        if (user.assignedInstructor) {
            instructorMap.set(user.assignedInstructor.id, {
                id: user.assignedInstructor.id,
                name: user.assignedInstructor.name,
                role: 'Assigned Mentor',
                status: 'active'
            });
        }
        
        user.enrollments?.forEach(e => {
            if (e.course?.instructor) {
                instructorMap.set(e.course.instructor.id, {
                    id: e.course.instructor.id,
                    name: e.course.instructor.name,
                    role: 'Course Instructor',
                    status: 'active'
                });
            }
        });
        const instructors = Array.from(instructorMap.values());

        // Collect Sponsors
        const sponsors = user.sponsorships?.map(s => ({
            id: s.sponsor.id,
            name: s.sponsor.name,
            status: s.status === 'active' ? 'active' : 'pending_consent',
            encryptionKey: `E2E-${s.id.substring(0, 4).toUpperCase()}`
        })) || [];

        res.json({
            success: true,
            data: {
                parents,
                instructors,
                sponsors,
                admin: { id: 'admin-core', name: 'System Core Security', status: 'active' }
            }
        });
    } catch (error) {
        console.error('Ecosystem fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/ecosystem/authorize', protect, async (req, res) => {
    try {
        const { type, id } = req.body;
        
        if (type === 'sponsorship') {
            const sponsorship = await prisma.sponsorship.findFirst({
                where: { sponsorId: id, targetStudentId: req.user.id }
            });
            
            if (!sponsorship) {
                return res.status(404).json({ success: false, message: 'Sponsorship not found' });
            }
            
            await prisma.sponsorship.update({
                where: { id: sponsorship.id },
                data: { status: 'active', termsAccepted: true }
            });
            
            res.json({ success: true, message: 'Sponsorship authorized' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid type' });
        }
    } catch (error) {
        console.error('Authorize error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/ecosystem/reject', protect, async (req, res) => {
    try {
        const { type, id } = req.body;
        
        if (type === 'sponsorship') {
            const sponsorship = await prisma.sponsorship.findFirst({
                where: { sponsorId: id, targetStudentId: req.user.id }
            });
            
            if (!sponsorship) {
                return res.status(404).json({ success: false, message: 'Sponsorship not found' });
            }
            
            await prisma.sponsorship.delete({
                where: { id: sponsorship.id }
            });
            
            res.json({ success: true, message: 'Sponsorship rejected' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid type' });
        }
    } catch (error) {
        console.error('Reject error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/dashboard-metrics', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const unreadMessages = await prisma.message.count({
            where: { receiverId: userId, isRead: false }
        });
        
        let pendingCourses = 0;
        let pendingApprovals = 0;
        let pendingEnrollments = 0;
        let newCertificates = 0;
        let totalCertificates = 0;
        let readyToClaim = 0;
        let pendingCertificateRequirements = 0;
        let pendingUsers = 0;

        if (role === 'admin') {
            const adminStats = await dashboardService.getAdminStats();
            pendingApprovals = adminStats.pendingCourses; // 'pendingApprovals' in dashboard-metrics historically maps to pending courses
            pendingEnrollments = adminStats.pendingEnrollments;
            pendingUsers = adminStats.pendingUsers;
            pendingCourses = adminStats.pendingCourses;
        } else if (role === 'instructor') {
            pendingCourses = await prisma.course.count({ where: { instructorId: userId, status: 'pending' } });
        } else if (role === 'student' || role === 'parent') {
            totalCertificates = await prisma.certificate.count({ where: { userId } });
            newCertificates = await prisma.certificate.count({ where: { userId, isSeen: false } });

            const certificateCourseIds = new Set(
                (await prisma.certificate.findMany({ where: { userId }, select: { courseId: true } }))
                    .map(cert => cert.courseId)
            );

            const progressRecords = await prisma.userCourseProgress.findMany({
                where: { userId },
                include: { course: true }
            });

            progressRecords.forEach(progress => {
                const courseId = progress.courseId;
                const isCompleted = progress.progress === 100 || progress.status === 'completed' || progress.completed;
                const examPassed = !progress.course?.isExamRequired || progress.passedFinalExam;
                const hasCertificate = certificateCourseIds.has(courseId);

                if (!hasCertificate && isCompleted && examPassed) {
                    readyToClaim++;
                }

                if (!hasCertificate && isCompleted && progress.course?.isExamRequired && !progress.passedFinalExam) {
                    pendingCertificateRequirements++;
                }
            });
        }

        res.json({
            success: true,
            metrics: {
                unreadMessages,
                pendingApprovals,
                pendingEnrollments,
                pendingCourses,
                newCertificates,
                totalCertificates,
                readyToClaim,
                pendingCertificateRequirements,
                pendingUsers
            }
        });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/mark-certificates-seen', protect, async (req, res) => {
    try {
        await prisma.certificate.updateMany({
            where: { userId: req.user.id, isSeen: false },
            data: { isSeen: true }
        });
        res.json({ success: true, message: 'Certificates marked as seen' });
    } catch (error) {
        console.error('Mark certs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/connect', protect, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const currentUser = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            include: { children: true }
        });
        
        let parent, student;

        if (currentUser.role === 'parent' && targetUser.role === 'student') {
            parent = currentUser;
            student = targetUser;
        } else if (currentUser.role === 'student' && targetUser.role === 'parent') {
            parent = targetUser;
            student = currentUser;
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid connection request. Only parents and students can connect to each other.'
            });
        }

        if (currentUser.role === 'parent') {
            if (parent.children.some(child => child.id === student.id)) {
                return res.status(400).json({ success: false, message: 'Already connected to this user.' });
            }
            await prisma.user.update({
                where: { id: parent.id },
                data: { children: { connect: { id: student.id } } }
            });
        } else {
            const targetParent = await prisma.user.findUnique({
                where: { id: targetUser.id },
                include: { children: true }
            });
            if (targetParent.children.some(child => child.id === student.id)) {
                return res.status(400).json({ success: false, message: 'Already connected to this user.' });
            }
            await prisma.user.update({
                where: { id: targetParent.id },
                data: { children: { connect: { id: student.id } } }
            });
        }

        res.json({ success: true, message: 'Successfully connected!' });
    } catch (error) {
        console.error('Connect route error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/public/testimonials', async (req, res) => {
    try {
        // Fetch diverse testimonials from real users by role
        const testimonials = [];
        
        // Get a student
        const student = await prisma.user.findFirst({
            where: { role: 'student', NOT: { name: { contains: 'test', mode: 'insensitive' } } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, avatar: true, role: true }
        });

        // Get an instructor
        const instructor = await prisma.user.findFirst({
            where: { role: 'instructor' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, avatar: true, role: true }
        });

        // Get a parent
        const parent = await prisma.user.findFirst({
            where: { 
                role: 'parent',
                NOT: { name: { contains: 'sponsor', mode: 'insensitive' } }
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, avatar: true, role: true }
        });

        // Get a sponsor
        const sponsor = await prisma.user.findFirst({
            where: { role: 'parent' },
            orderBy: { createdAt: 'desc' },
            skip: 1,
            select: { id: true, name: true, avatar: true, role: true }
        });

        // Map testimonials with real user data and quotes
        if (student) {
            testimonials.push({
                id: student.id,
                name: student.name,
                avatar: student.avatar,
                role: 'Learner',
                roleType: 'student',
                quote: `EDOT gave me access to learning I couldn't find before. Now I understand and apply what I learn.`
            });
        }

        if (parent) {
            testimonials.push({
                id: parent.id,
                name: parent.name,
                avatar: parent.avatar,
                role: 'Parent',
                roleType: 'parent',
                quote: `I can clearly see my child's progress and growth, not just results, but real understanding.`
            });
        }

        if (instructor) {
            testimonials.push({
                id: instructor.id,
                name: instructor.name,
                avatar: instructor.avatar,
                role: 'Instructor',
                roleType: 'instructor',
                quote: `This platform allows me to truly guide learners, not just upload content.`
            });
        }

        if (sponsor) {
            testimonials.push({
                id: sponsor.id,
                name: sponsor.name,
                avatar: sponsor.avatar,
                role: 'Sponsor',
                roleType: 'sponsor',
                quote: `I can see exactly who I'm helping and how they are improving.`
            });
        }

        // Add default avatars if not set
        const enrichedTestimonials = testimonials.map(t => ({
            ...t,
            avatar: t.avatar && t.avatar !== 'default-avatar.png'
                ? t.avatar
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(t.name)}`
        }));

        res.json({
            success: true,
            testimonials: enrichedTestimonials
        });
    } catch (error) {
        console.error('Get testimonials error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;