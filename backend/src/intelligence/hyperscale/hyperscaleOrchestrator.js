/**
 * EDOT Intelligence Domain - Hyperscale Infrastructure Master Orchestrator
 * Coordinates object storage abstractions, resumable upload sessions, asynchronous video pipelines,
 * CDN signed access, decoupled event streaming, search indexing, and data tiering.
 */

import { generatePresignedUploadUrl, generatePresignedDownloadUrl, STORAGE_PROVIDERS } from './storageService.js';
import { createUploadSession, updateUploadSessionProgress, finalizeUploadSession } from './uploadService.js';
import { triggerVideoProcessing } from './videoPipelineService.js';
import { generateSignedCdnUrl } from './cdnService.js';
import { publishHyperscaleEvent, getEventStreamMetrics } from './eventStreamService.js';
import { indexSearchRecord, searchEntities } from './searchService.js';
import { evaluateDataTier, DATA_TIERS } from './analyticsTierService.js';

export {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  STORAGE_PROVIDERS,
  createUploadSession,
  updateUploadSessionProgress,
  finalizeUploadSession,
  triggerVideoProcessing,
  generateSignedCdnUrl,
  publishHyperscaleEvent,
  getEventStreamMetrics,
  indexSearchRecord,
  searchEntities,
  evaluateDataTier,
  DATA_TIERS
};

/**
 * Returns Hyperscale Infrastructure & Capacity Overview.
 */
export async function getHyperscaleCapacityOverview() {
  const eventMetrics = getEventStreamMetrics();

  return {
    storageMode: 'OBJECT_STORAGE_DECOUPLED',
    supportedProviders: ['S3', 'GCS', 'AZURE', 'LOCAL'],
    eventStreamStatus: eventMetrics.status,
    pendingStreamEvents: eventMetrics.pendingEvents,
    searchEngine: 'DECOUPLED_SEARCH_INDEX',
    dataTiering: {
      hot: 'Recent 30 days operational',
      warm: '30-365 days analytics',
      cold: '365+ days archival'
    },
    generatedAt: new Date().toISOString()
  };
}
