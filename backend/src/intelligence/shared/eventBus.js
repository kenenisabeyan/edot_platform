/**
 * EDOT Intelligence Domain - Background Processing & Event Bus
 * Decouples learning event ingestion from downstream intelligence calculations.
 */

import EventEmitter from 'events';

class IntelligenceEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publish an event into the intelligence pipeline.
   * Dispatches asynchronously to avoid blocking user-facing requests.
   * 
   * @param {string} eventType 
   * @param {object} payload 
   */
  publish(eventType, payload) {
    setImmediate(() => {
      try {
        this.emit(eventType, payload);
        this.emit('*', { eventType, payload });
      } catch (err) {
        console.error(`[IntelligenceEventBus] Unhandled error during event '${eventType}':`, err);
      }
    });
  }

  /**
   * Subscribe to specific event types with isolated error boundary.
   * 
   * @param {string} eventType 
   * @param {Function} handler 
   */
  subscribe(eventType, handler) {
    this.on(eventType, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[IntelligenceEventBus] Subscriber failed for event '${eventType}':`, err);
      }
    });
  }
}

export const eventBus = new IntelligenceEventBus();
export default eventBus;
