/**
 * EDOT Intelligence Domain - Integration Layer Router
 * Endpoints for adapter registration lookup, enablement toggles, execution wrappers, and provider audit logs.
 */

import express from 'express';
import { protect, authorize, checkNotBlocked } from '../../../middleware/auth.js';
import { globalProviderRegistry } from './providerAdapterRegistry.js';

const router = express.Router();

// GET /intelligence/integrations/adapters
router.get('/adapters', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const adapters = globalProviderRegistry.listAdapters();
    res.json({
      success: true,
      count: adapters.length,
      data: adapters
    });
  } catch (error) {
    next(error);
  }
});

// PUT /intelligence/integrations/adapters/:name/toggle
router.put('/adapters/:name/toggle', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const result = globalProviderRegistry.setEnablement(req.params.name, enabled);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /intelligence/integrations/adapters/:name/execute
router.post('/adapters/:name/execute', protect, checkNotBlocked, async (req, res, next) => {
  try {
    const { actionName, payload } = req.body;
    const adapter = globalProviderRegistry.getAdapter(req.params.name);

    const result = await adapter.executeWithAdapter(
      actionName || 'default_action',
      payload || {},
      async (data) => {
        return { status: 'PROCESSED', payloadReceived: data };
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /intelligence/integrations/audit-logs
router.get('/audit-logs', protect, authorize('admin'), async (req, res, next) => {
  try {
    const logs = globalProviderRegistry.getAuditLogs();
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
