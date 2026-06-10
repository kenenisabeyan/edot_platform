import express from 'express';
import { protect, authorize, checkNotBlocked } from '../middleware/auth.js';
import dashboardService from '../services/dashboardService.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

/**
 * CONSOLIDATED DASHBOARD ROUTES
 * Replaces both dashboardRoutes.js and newDashboardRoutes.js
 */

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/dashboard/admin/stats
 * Admin-only dashboard statistics
 * @performance: Optimized with pagination and selective field loading
 */
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await dashboardService.getAdminStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error.message
        });
    }
});

/**
 * GET /api/dashboard/stats (Legacy - redirects to /admin/stats)
 * Kept for backward compatibility
 */
router.get('/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await dashboardService.getAdminStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats'
        });
    }
});

// ==================== STUDENT ROUTES ====================

/**
 * GET /api/dashboard/student
 * Unified student dashboard (Single Source of Truth)
 * @performance: Optimized field selection, top 20 courses max
 * @caching: Client-side caching via React Query (30s refresh)
 */
router.get('/student', protect, checkNotBlocked, async (req, res) => {
    try {
        const userId = req.user.id;
        const dashboardData = await dashboardService.getStudentDashboard(userId);
        
        res.status(200).json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('Student Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * GET /api/student/dashboard (Legacy - redirects to new endpoint)
 * Kept for backward compatibility with frontend
 */
router.get('/student/dashboard', protect, checkNotBlocked, async (req, res) => {
    try {
        const userId = req.user.id;
        const dashboardData = await dashboardService.getStudentDashboard(userId);
        
        res.status(200).json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('Student Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== INSTRUCTOR ROUTES ====================

/**
 * GET /api/dashboard/instructor
 * Instructor dashboard statistics
 */
router.get('/instructor', protect, authorize('instructor'), async (req, res) => {
    try {
        const instructorId = req.user.id;
        const stats = await dashboardService.getInstructorStats(instructorId);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Instructor Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch instructor stats'
        });
    }
});

// ==================== SPONSOR ROUTES ====================

/**
 * GET /api/dashboard/sponsor
 * Sponsor dashboard statistics
 */
router.get('/sponsor', protect, authorize('sponsor'), async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const stats = await dashboardService.getSponsorStats(sponsorId);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Sponsor Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sponsor stats'
        });
    }
});

// ==================== SHARED ROUTES ====================

/**
 * GET /api/dashboard/metrics
 * General dashboard metrics for all authenticated users
 * Used for sidebar badge counts
 */
router.get('/metrics', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const [
            unreadMessages,
            pendingApprovals,
            pendingCourses,
            newCertificates,
            pendingUsers
        ] = await Promise.all([
            prisma.message.count({ where: { receiverId: userId, isRead: false } }),
            userRole === 'admin' 
                ? prisma.enrollment.count({ where: { status: 'pending' } })
                : 0,
            userRole === 'instructor'
                ? prisma.course.count({ where: { instructorId: userId, status: 'pending' } })
                : 0,
            userRole === 'student'
                ? prisma.certificate.count({ where: { userId } })
                : 0,
            userRole === 'admin'
                ? prisma.user.count({ where: { status: 'pending' } })
                : 0
        ]);

        res.status(200).json({
            success: true,
            metrics: {
                unreadMessages,
                pendingApprovals,
                pendingCourses,
                newCertificates,
                totalCertificates: newCertificates,
                readyToClaim: 0,
                pendingCertificateRequirements: 0,
                pendingUsers
            }
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch metrics'
        });
    }
});

/**
 * GET /api/dashboard/courses/enrolled
 * Get user's enrolled courses with pagination
 */
router.get('/courses/enrolled', protect, checkNotBlocked, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 per page
        const skip = (page - 1) * limit;

        const [enrollments, total] = await Promise.all([
            prisma.userCourseProgress.findMany({
                where: { userId },
                select: {
                    id: true,
                    courseId: true,
                    progress: true,
                    course: {
                        select: {
                            id: true,
                            title: true,
                            thumbnail: true,
                            instructor: { select: { name: true } }
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { enrolledAt: 'desc' }
            }),
            prisma.userCourseProgress.count({ where: { userId } })
        ]);

        res.status(200).json({
            success: true,
            data: enrollments,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Enrolled courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enrolled courses'
        });
    }
});

export default router;
