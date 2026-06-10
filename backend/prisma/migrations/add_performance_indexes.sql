-- EDOT Platform Performance Optimization - Database Indexes
-- This migration adds critical indexes for dashboard and general query performance
-- Expected improvement: 10-30x faster queries on indexed columns

-- User Table Indexes
CREATE INDEX idx_user_role_status 
ON "User"(role, status) 
WHERE status != 'deleted';

CREATE INDEX idx_user_created_at 
ON "User"("createdAt" DESC);

CREATE INDEX idx_user_email 
ON "User"(email);

-- Course Table Indexes
CREATE INDEX idx_course_status 
ON "Course"(status);

CREATE INDEX idx_course_instructor 
ON "Course"("instructorId");

CREATE INDEX idx_course_total_students 
ON "Course"("totalStudents" DESC);

CREATE INDEX idx_course_created_at 
ON "Course"("createdAt" DESC);

CREATE INDEX idx_course_instructor_status 
ON "Course"("instructorId", status);

-- UserCourseProgress Indexes (Critical for Dashboard)
CREATE INDEX idx_user_progress_user_id 
ON "UserCourseProgress"("userId") 
WHERE progress < 100;

CREATE INDEX idx_user_progress_enrolled_at 
ON "UserCourseProgress"("enrolledAt" DESC);

CREATE INDEX idx_user_progress_completed 
ON "UserCourseProgress"("completed", "enrolledAt" DESC);

-- Enrollment Table Indexes (Critical for Dashboard)
CREATE INDEX idx_enrollment_status_created 
ON "Enrollment"(status, "createdAt" DESC);

CREATE INDEX idx_enrollment_student_id 
ON "Enrollment"("studentId", status);

CREATE INDEX idx_enrollment_course_id 
ON "Enrollment"("courseId", status);

-- Message Table Indexes (Critical for Sidebar)
CREATE INDEX idx_message_receiver_unread 
ON "Message"("receiverId", "isRead");

CREATE INDEX idx_message_created_at 
ON "Message"("createdAt" DESC);

-- Certificate Table Indexes (Dashboard Stats)
CREATE INDEX idx_certificate_user_created 
ON "Certificate"("userId", "createdAt" DESC);

-- ProgressLog Indexes (Weekly Study Data)
CREATE INDEX idx_progress_log_user_week 
ON "ProgressLog"("userId", "updatedAt" DESC);

-- Activity Indexes
CREATE INDEX idx_activity_user_created 
ON "Activity"("userId", "createdAt" DESC);

-- Notice Indexes
CREATE INDEX idx_notice_created_at 
ON "Notice"("createdAt" DESC);

-- Achievement Indexes
CREATE INDEX idx_achievement_user_id 
ON "Achievement"("userId");

-- Sponsorship Indexes (Support Dashboard)
CREATE INDEX idx_sponsorship_sponsor_status 
ON "Sponsorship"("sponsorId", status);

CREATE INDEX idx_sponsorship_student_status 
ON "Sponsorship"("studentId", status);

CREATE INDEX idx_sponsorship_created 
ON "Sponsorship"("createdAt" DESC);

-- Composite Indexes for Common Query Patterns
CREATE INDEX idx_course_progress_stats 
ON "UserCourseProgress"("userId", "progress", "enrolledAt" DESC);

-- Note: If you want to drop all these indexes later, run:
-- DROP INDEX IF EXISTS idx_user_role_status;
-- DROP INDEX IF EXISTS idx_user_created_at;
-- ... (repeat for all indexes)
