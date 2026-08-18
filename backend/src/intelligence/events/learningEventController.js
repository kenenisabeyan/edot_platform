/**
 * EDOT Intelligence Domain - Learning Event Controllers
 */

import {
  publishLearningEvent,
  publishLearningEventsBatch,
  queryLearningEvents
} from './learningEventService.js';

export async function createEventHandler(req, res, next) {
  try {
    const result = await publishLearningEvent(req.body, req.user);
    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      isDuplicate: result.isDuplicate,
      data: result.event
    });
  } catch (error) {
    next(error);
  }
}

export async function createBatchEventsHandler(req, res, next) {
  try {
    const eventsArray = Array.isArray(req.body) ? req.body : req.body.events;
    const result = await publishLearningEventsBatch(eventsArray, req.user);
    res.status(201).json({
      success: true,
      processedCount: result.processedCount,
      duplicatesCount: result.duplicatesCount,
      data: result.events.map(r => r.event)
    });
  } catch (error) {
    next(error);
  }
}

export async function listEventsHandler(req, res, next) {
  try {
    // Normal users can only view their own events, admins can filter by any userId
    const filterUserId = req.user.role === 'admin' && req.query.userId
      ? req.query.userId
      : req.user.id;

    const filters = {
      ...req.query,
      userId: filterUserId
    };

    const results = await queryLearningEvents(filters);
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
}
