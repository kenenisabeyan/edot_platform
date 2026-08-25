/**
 * EDOT Intelligence Domain - Hyperscale Infrastructure Router
 * REST API endpoints for object storage presigned URLs, resumable upload sessions,
 * video processing pipeline triggers, search queries, and hyperscale capacity metrics.
 */

import express from 'express';
import { protect, authorize } from '../../../middleware/auth.js';
import {
  generatePresignedUploadUrl,
  createUploadSession,
  triggerVideoProcessing,
  searchEntities,
  getHyperscaleCapacityOverview
} from './hyperscaleOrchestrator.js';

const router = express.Router();

// POST /api/v2/intelligence/hyperscale/storage/presigned-url
router.post('/storage/presigned-url', protect, async (req, res, next) => {
  try {
    const { title, mimeType, fileSizeBytes, provider } = req.body;
    const result = await generatePresignedUploadUrl(req.user.id, title, mimeType, fileSizeBytes, provider);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/hyperscale/upload/session
router.post('/upload/session', protect, async (req, res, next) => {
  try {
    const { mediaAssetId, chunkSizeBytes } = req.body;
    const session = await createUploadSession(mediaAssetId, chunkSizeBytes);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// POST /api/v2/intelligence/hyperscale/media/process
router.post('/media/process', protect, async (req, res, next) => {
  try {
    const { mediaAssetId } = req.body;
    const result = await triggerVideoProcessing(mediaAssetId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/hyperscale/search
router.get('/search', protect, async (req, res, next) => {
  try {
    const { q, entityType, limit } = req.query;
    const results = await searchEntities(q || '', entityType || null, Number(limit) || 20);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// GET /api/v2/intelligence/hyperscale/metrics
router.get('/metrics', protect, authorize('admin'), async (req, res, next) => {
  try {
    const metrics = await getHyperscaleCapacityOverview();
    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
});

export default router;
