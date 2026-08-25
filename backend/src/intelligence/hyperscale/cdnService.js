/**
 * EDOT Intelligence Domain - CDN Content Delivery & Signed Access Service
 * Generates signed CDN access tokens for protected course videos, documents, and media resources.
 */

import crypto from 'crypto';

/**
 * Generates a signed CDN access URL for protected media files.
 */
export function generateSignedCdnUrl(mediaPath, requesterId = null, ttlSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = crypto.createHash('sha256').update(`${mediaPath}:${expires}:${requesterId}`).digest('hex');

  const cdnBase = 'https://cdn.edot.internal';
  return {
    mediaPath,
    signedUrl: `${cdnBase}/${mediaPath}?expires=${expires}&sig=${signature.substring(0, 16)}`,
    expiresAt: new Date(expires * 1000).toISOString()
  };
}
