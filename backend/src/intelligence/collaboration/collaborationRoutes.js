/**
 * EDOT Intelligence Domain - Collaboration & Mentorship Router
 * REST API endpoints for mentor profiles, matching, relationship workflows, peer learning,
 * team health, communities, safety blocking, and role-based insights (instructor, admin, guardian).
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../middleware/auth.js';
import {
  createOrUpdateMentorProfile,
  updateMentorVerificationStatus,
  getRecommendedMentors,
  requestRelationship,
  respondToRelationshipRequest,
  createMentorshipGoal,
  scheduleMentorshipSession,
  updatePeerDiscoverability,
  getRecommendedPeers,
  getTeamHealthAnalysis,
  createCommunity,
  joinCommunity,
  getRecommendedCommunities,
  blockUser,
  reportUser,
  getInstructorCollaborationInsights,
  getAdminCollaborationIntelligence,
  getGuardianCollaborationSummary
} from './collaborationService.js';

const router = express.Router();

// POST /api/v2/intelligence/collaboration/mentor-profile
router.post('/mentor-profile', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const profile = await createOrUpdateMentorProfile(req.user.id, req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/collaboration/mentor-profile/verification
router.put('/mentor-profile/verification', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { userId, verificationStatus, reviewerNotes } = req.body;
    const profile = await updateMentorVerificationStatus(userId, verificationStatus, reviewerNotes);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/mentors/recommended
router.get('/mentors/recommended', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const mentors = await getRecommendedMentors(req.user.id);
    res.json({ success: true, count: mentors.length, data: mentors });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/requests
router.post('/requests', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { targetId, relationshipType, focusAreas, notes } = req.body;
    const relationship = await requestRelationship(req.user.id, targetId, { relationshipType, focusAreas, notes });
    res.status(201).json({ success: true, data: relationship });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v2/intelligence/collaboration/requests/:id/response
router.put('/requests/:id/response', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { action, notes } = req.body;
    const relationship = await respondToRelationshipRequest(req.params.id, req.user.id, {
      action,
      notes,
      requestingUserRole: req.user.role
    });
    res.json({ success: true, data: relationship });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/relationships/:id/goals
router.post('/relationships/:id/goals', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { title, category, targetDate } = req.body;
    const goal = await createMentorshipGoal(req.params.id, req.user.id, { title, category, targetDate });
    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/relationships/:id/sessions
router.post('/relationships/:id/sessions', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { scheduledAt, durationMinutes, meetingLink, actionItems } = req.body;
    const session = await scheduleMentorshipSession(req.params.id, req.user.id, {
      scheduledAt,
      durationMinutes,
      meetingLink,
      actionItems
    });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/peer-discoverability
router.post('/peer-discoverability', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { optIn, visibility, studyGoals, availableHours } = req.body;
    const profile = await updatePeerDiscoverability(req.user.id, { optIn, visibility, studyGoals, availableHours });
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/peers/recommended
router.get('/peers/recommended', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const result = await getRecommendedPeers(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/team-health/:submissionId
router.get('/team-health/:submissionId', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const analysis = await getTeamHealthAnalysis(req.params.submissionId);
    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/communities
router.post('/communities', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { name, description, type, accessType, courseId } = req.body;
    const community = await createCommunity(req.user.id, { name, description, type, accessType, courseId });
    res.status(201).json({ success: true, data: community });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/communities/:id/join
router.post('/communities/:id/join', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const member = await joinCommunity(req.user.id, req.params.id);
    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/communities/recommended
router.get('/communities/recommended', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const communities = await getRecommendedCommunities(req.user.id);
    res.json({ success: true, count: communities.length, data: communities });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/safety/block
router.post('/safety/block', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { targetId, reason } = req.body;
    const record = await blockUser(req.user.id, targetId, reason);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/collaboration/safety/report
router.post('/safety/report', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { targetId, reason } = req.body;
    const report = await reportUser(req.user.id, targetId, reason);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/instructor/insights
router.get('/instructor/insights', protect, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const insights = await getInstructorCollaborationInsights(req.user.id);
    res.json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/admin/intelligence
router.get('/admin/intelligence', protect, authorize('admin'), async (req, res, next) => {
  try {
    const intelligence = await getAdminCollaborationIntelligence();
    res.json({ success: true, data: intelligence });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/collaboration/guardian/students/:studentId/summary
router.get('/guardian/students/:studentId/summary', protect, authorize('guardian', 'admin'), async (req, res, next) => {
  try {
    const summary = await getGuardianCollaborationSummary(req.user.id, req.params.studentId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

export default router;
