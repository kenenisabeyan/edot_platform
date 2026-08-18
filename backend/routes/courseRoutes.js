import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from '../controllers/activityController.js';
import { onboardSingleCourse, onContentDeactivated } from '../src/intelligence/onboarding/courseOnboardingPipeline.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { 
            mainCategory,
            subCategory,
            level, 
            search, 
            page = 1, 
            limit = 9,
            sort = '-createdAt'
        } = req.query;

        let query = { isPublished: true, status: 'approved' };
        
        if (mainCategory) query.mainCategory = mainCategory;
        if (subCategory) query.subCategory = subCategory;
        if (level) query.level = level;
        if (search) {
            query.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        let orderBy = {};
        if (sort === '-createdAt') orderBy = { createdAt: 'desc' };
        else if (sort === 'createdAt') orderBy = { createdAt: 'asc' };
        
        const courses = await prisma.course.findMany({
            where: query,
            include: {
                instructor: { select: { name: true, email: true, avatar: true } },
                lessons: true
            },
            orderBy: Object.keys(orderBy).length ? orderBy : undefined,
            take: parseInt(limit),
            skip: skip
        });

        const total = await prisma.course.count({ where: query });

        res.json({
            success: true,
            count: courses.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            courses
        });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/categorized', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { isPublished: true, status: 'approved' },
            include: { instructor: { select: { name: true, email: true, avatar: true } } }
        });

        const grouped = {};
        courses.forEach(c => {
            if (!grouped[c.mainCategory]) {
                grouped[c.mainCategory] = {
                    mainCategory: c.mainCategory,
                    courses: [],
                    totalStudents: 0,
                    minDuration: c.duration,
                    maxDuration: c.duration,
                    subCategories: new Set()
                };
            }
            const g = grouped[c.mainCategory];
            g.courses.push(c);
            g.totalStudents += (c.totalStudents || 0);
            if (c.duration < g.minDuration) g.minDuration = c.duration;
            if (c.duration > g.maxDuration) g.maxDuration = c.duration;
            if (c.subCategory) g.subCategories.add(c.subCategory);
        });

        const formatted = Object.values(grouped).map(g => {
            let durationRange;
            if (g.minDuration === g.maxDuration) {
                 durationRange = `${g.minDuration} hours`;
            } else {
                 durationRange = `${g.minDuration}-${g.maxDuration} hours`;
            }

            return {
                mainCategory: g.mainCategory,
                courses: g.courses, 
                totalStudents: g.totalStudents,
                durationRange: durationRange,
                subCategories: Array.from(g.subCategories)
            };
        });

        res.json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error('Get categorized courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/enrolled', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const enrollments = await prisma.userCourseProgress.findMany({
            where: { userId, status: { in: ['active', 'completed', 'pending'] } },
            include: {
                course: {
                    include: { 
                        instructor: { select: { name: true, avatar: true } },
                        lessons: true 
                    }
                }
            }
        });

        // Add dummy enrollments from main enrollment table if no progress yet
        const pendingEnrollments = await prisma.enrollment.findMany({
            where: { studentId: userId, status: { in: ['active', 'pending', 'completed'] } },
            include: {
                course: {
                    include: { 
                        instructor: { select: { name: true, avatar: true } },
                        lessons: true 
                    }
                }
            }
        });
        
        // Merge without duplicates
        const courseIds = new Set(enrollments.map(e => e.courseId));
        const merged = [...enrollments];
        pendingEnrollments.forEach(e => {
            if (!courseIds.has(e.courseId)) {
                merged.push({
                    id: e.id,
                    courseId: e.courseId,
                    course: e.course,
                    progress: 0,
                    completedLessons: [],
                    status: 'active'
                });
            }
        });

        res.json({ success: true, data: merged });
    } catch (error) {
        console.error('Enrolled courses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/my-courses', protect, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        const query = req.user.role === 'admin' ? {} : { instructorId: userId };
        
        const courses = await prisma.course.findMany({
            where: query,
            include: {
                instructor: { select: { name: true, email: true, avatar: true } },
                lessons: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, courses });
    } catch (error) {
        console.error('My courses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                instructor: { select: { name: true, email: true, bio: true, avatar: true } },
                lessons: { orderBy: { order: 'asc' } }
            }
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        // Strip sensitive video URLs for public course preview
        const publicCourse = { ...course };
        delete publicCourse.videoUrl;
        if (publicCourse.lessons) {
            publicCourse.lessons = publicCourse.lessons.map(l => {
                const pubLesson = { ...l };
                if (!pubLesson.isPreview) {
                    delete pubLesson.videoUrl;
                }
                return pubLesson;
            });
        }

        res.json({
            success: true,
            course: publicCourse
        });
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.get('/:id/content', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.id;

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                instructor: { select: { name: true, email: true, bio: true, avatar: true } },
                lessons: { orderBy: { order: 'asc' } }
            }
        });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Check if user is instructor or admin
        const isInstructorOrAdmin = req.user.role === 'admin' || course.instructorId === userId;
        
        let isEnrolled = false;
        let enrollmentStatus = null;
        if (!isInstructorOrAdmin) {
            const enrollment = await prisma.enrollment.findFirst({
                where: { studentId: userId, courseId: courseId }
            });
            
            // Only allow active enrollments or if there's progress for active status
            if (enrollment) {
                enrollmentStatus = enrollment.status;
                isEnrolled = enrollment.status === 'active';
            }
            
            // Also check progress status
            if (!isEnrolled) {
                const progress = await prisma.userCourseProgress.findFirst({
                    where: { userId: userId, courseId: courseId, status: 'active' }
                });
                isEnrolled = !!progress;
            }
        }

        if (!isInstructorOrAdmin && !isEnrolled) {
            const message = enrollmentStatus === 'pending' 
                ? 'Your enrollment request is pending admin approval. You can access the course once approved.'
                : enrollmentStatus === 'rejected'
                ? 'Your enrollment request was rejected. Contact admin for more information.'
                : 'Access denied. You must be enrolled in this course to view its content.';
            
            return res.status(403).json({ 
                success: false, 
                message: message,
                enrollmentStatus: enrollmentStatus 
            });
        }

        res.json({
            success: true,
            course
        });
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.post('/', protect, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        const validFields = {
            title: req.body.title,
            description: req.body.description,
            mainCategory: req.body.category || req.body.mainCategory || 'General',
            subCategory: req.body.subCategory || '',
            level: req.body.level || 'Beginner',
            duration: Number(req.body.duration) || 1,
            thumbnail: req.body.thumbnail || 'default-course.jpg',
            videoUrl: req.body.videoUrl || '',
            price: Number(req.body.price) || 0,
            requirements: req.body.requirements || [],
            whatYouWillLearn: req.body.whatYouWillLearn || [],
            tags: req.body.tags || [],
            isExamRequired: Boolean(req.body.isExamRequired),
            finalExam: req.body.finalExam || []
        };
        
        validFields.instructorId = userId;
        validFields.slug = (validFields.title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
        
        if (req.user.role === 'admin') {
            validFields.status = 'approved';
            validFields.isPublished = true;
        } else {
            validFields.status = 'pending';
            validFields.isPublished = false;
        }

        const course = await prisma.course.create({
            data: validFields
        });

        await logActivity(userId, `Created a new course: ${course.title}`, 'course', course.title, course.id);

        // Non-blocking Intelligence Onboarding — AI failure never prevents course creation
        onboardSingleCourse(course.id).catch(err => console.error('[Intelligence] Non-blocking onboard failed:', err.message));

        res.status(201).json({
            success: true,
            course
        });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.put('/:id', protect, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        let course = await prisma.course.findUnique({ where: { id: req.params.id } });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        if (course.instructorId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this course'
            });
        }
        
        const validUpdateFields = {};
        if (req.body.title !== undefined) validUpdateFields.title = req.body.title;
        if (req.body.description !== undefined) validUpdateFields.description = req.body.description;
        if (req.body.category !== undefined) validUpdateFields.mainCategory = req.body.category;
        if (req.body.level !== undefined) validUpdateFields.level = req.body.level;
        if (req.body.duration !== undefined) validUpdateFields.duration = Number(req.body.duration);
        if (req.body.thumbnail !== undefined) validUpdateFields.thumbnail = req.body.thumbnail || 'default-course.jpg';
        if (req.body.price !== undefined) validUpdateFields.price = Number(req.body.price);
        if (req.body.requirements !== undefined) validUpdateFields.requirements = req.body.requirements;
        if (req.body.whatYouWillLearn !== undefined) validUpdateFields.whatYouWillLearn = req.body.whatYouWillLearn;
        if (req.body.tags !== undefined) validUpdateFields.tags = req.body.tags;
        if (req.body.videoUrl !== undefined) validUpdateFields.videoUrl = req.body.videoUrl;
        if (req.body.isExamRequired !== undefined) validUpdateFields.isExamRequired = Boolean(req.body.isExamRequired);
        if (req.body.finalExam !== undefined) validUpdateFields.finalExam = req.body.finalExam;

        course = await prisma.course.update({
            where: { id: req.params.id },
            data: validUpdateFields
        });

        // Non-blocking Intelligence Refresh — AI failure never prevents course updates
        onboardSingleCourse(course.id, { forceRefresh: true }).catch(err => console.error('[Intelligence] Non-blocking refresh failed:', err.message));

        res.json({
            success: true,
            course
        });
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

router.delete('/:id', protect, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const userId = req.user.id;
        const course = await prisma.course.findUnique({ where: { id: req.params.id } });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        if (course.instructorId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this course' });
        }

        // Non-blocking Intelligence Deactivation before delete — preserves historical evidence
        onContentDeactivated('COURSE', req.params.id).catch(err => console.error('[Intelligence] Non-blocking deactivation failed:', err.message));

        await prisma.course.delete({ where: { id: req.params.id } });
        
        await logActivity(userId, `Deleted a course: ${course.title}`, 'course', course.title);

        res.json({ success: true, data: {} });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {
    try {
        const userId = req.user.id;
        const course = await prisma.course.findUnique({ where: { id: req.params.id } });

        if (!course || course.status !== 'approved' || !course.isPublished) {
            return res.status(404).json({ success: false, message: 'Course not available for enrollment' });
        }

        const existing = await prisma.enrollment.findFirst({
            where: { studentId: userId, courseId: course.id }
        });
        
        if (existing) {
            if (existing.status === 'active') {
                return res.status(400).json({ success: false, message: 'Already active in this course' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ success: false, message: 'Enrollment request is already pending approval' });
            }
            if (existing.status === 'rejected') {
                await prisma.enrollment.update({
                    where: { id: existing.id },
                    data: { status: 'pending', reason: '', requestedAt: new Date() }
                });
            }
        } else {
            await prisma.enrollment.create({
                data: {
                    studentId: userId,
                    courseId: course.id,
                    status: 'pending'
                }
            });
        }

        const progressExisting = await prisma.userCourseProgress.findFirst({
            where: { userId, courseId: course.id }
        });
        
        if (progressExisting) {
            await prisma.userCourseProgress.update({
                where: { id: progressExisting.id },
                data: { status: 'pending' }
            });
        } else {
            await prisma.userCourseProgress.create({
                data: {
                    userId,
                    courseId: course.id,
                    status: 'pending',
                    progress: 0,
                    completedLessons: []
                }
            });
        }

        await logActivity(userId, `Requested enrollment in course: ${course.title}`, 'enrollment', course.title, course.id);

        res.json({ success: true, message: 'Enrollment request sent, awaiting admin approval' });
    } catch (error) {
        console.error('Enrollment request error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/:id/students', protect, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: req.params.id, status: 'active' },
            include: { student: { select: { id: true, name: true, email: true, avatar: true } } }
        });
        
        const students = enrollments.map(e => e.student).filter(Boolean);
        res.json({ success: true, count: students.length, data: students });
    } catch (error) {
        console.error('Get course students error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;