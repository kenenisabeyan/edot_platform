/**
 * EDOT Intelligence Domain - Master Route Aggregate
 * Mounts all sub-domain routes under unified intelligence namespaces.
 */

import express from 'express';
import eventRoutes from './events/eventRoutes.js';
import profileRoutes from './profile/profileRoutes.js';
import analyticsRoutes from './analytics/analyticsRoutes.js';
import mentorRoutes from './mentor/mentorRoutes.js';
import recommendationRoutes from './recommendations/recommendationRoutes.js';
import courseIntelligenceRoutes from './course-intelligence/courseIntelligenceRoutes.js';
import { intelligenceErrorHandler } from './shared/errors.js';

const router = express.Router();

// Sub-domain route registrations
router.use('/events', eventRoutes);
router.use('/profile', profileRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/mentor', mentorRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/courses', courseIntelligenceRoutes);

// Intelligence Domain Error Boundary
router.use(intelligenceErrorHandler);

export default router;
