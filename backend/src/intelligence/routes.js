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
import careerRoutes from './career/careerRoutes.js';
import projectRoutes from './projects/projectRoutes.js';
import collaborationRoutes from './collaboration/collaborationRoutes.js';
import opportunityRoutes from './opportunities/opportunityRoutes.js';
import experienceRoutes from './experience/experienceRoutes.js';
import auditRoutes from './audit/auditRoutes.js';
import pilotRoutes from './pilot/pilotRoutes.js';
import aiQualityRoutes from './ai-quality/aiQualityRoutes.js';
import performanceRoutes from './performance/performanceRoutes.js';
import productionRoutes from './production/productionRoutes.js';
import hyperscaleRoutes from './hyperscale/hyperscaleRoutes.js';
import domainRoutes from './domain/domainRoutes.js';
import voiceRoutes from './voice/voiceRoutes.js';
import { intelligenceErrorHandler } from './shared/errors.js';

const router = express.Router();

// Sub-domain route registrations
router.use('/events', eventRoutes);
router.use('/profile', profileRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/mentor', mentorRoutes);
router.use('/voice', voiceRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/courses', courseIntelligenceRoutes);
router.use('/career', careerRoutes);
router.use('/projects', projectRoutes);
router.use('/collaboration', collaborationRoutes);
router.use('/opportunities', opportunityRoutes);
router.use('/experience', experienceRoutes);
router.use('/product-experience', auditRoutes);
router.use('/pilots', pilotRoutes);
router.use('/ai-quality', aiQualityRoutes);
router.use('/performance', performanceRoutes);
router.use('/production', productionRoutes);
router.use('/hyperscale', hyperscaleRoutes);
router.use('/domains', domainRoutes);

// Intelligence Domain Error Boundary
router.use(intelligenceErrorHandler);

export default router;
