/**
 * EDOT Intelligence Domain - Resumable Upload Lifecycle Service
 * Tracks chunked upload sessions and lifecycle states (PENDING, UPLOADING, UPLOADED, PROCESSING, READY, FAILED).
 */

import { prisma } from '../../../lib/prisma.js';
import crypto from 'crypto';

/**
 * Creates a resumable chunked upload session.
 */
export async function createUploadSession(mediaAssetId, chunkSizeBytes = 5242880) {
  const uploadToken = `uptok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + (24 * 3600 * 1000)); // 24-hour expiration

  const session = await prisma.uploadSession.create({
    data: {
      mediaAssetId,
      uploadToken,
      chunkSizeBytes,
      expiresAt
    }
  });

  await prisma.mediaAsset.update({
    where: { id: mediaAssetId },
    data: { status: 'UPLOADING' }
  });

  return session;
}

/**
 * Updates progress for a resumable upload session.
 */
export async function updateUploadSessionProgress(uploadToken, uploadedBytes) {
  const session = await prisma.uploadSession.findUnique({
    where: { uploadToken }
  });

  if (!session) {
    throw new Error('Upload session not found');
  }

  const updatedSession = await prisma.uploadSession.update({
    where: { uploadToken },
    data: { uploadedBytes: BigInt(uploadedBytes) }
  });

  return updatedSession;
}

/**
 * Finalizes an upload session and marks asset as UPLOADED.
 */
export async function finalizeUploadSession(uploadToken) {
  const session = await prisma.uploadSession.findUnique({
    where: { uploadToken }
  });

  if (!session) {
    throw new Error('Upload session not found');
  }

  const asset = await prisma.mediaAsset.update({
    where: { id: session.mediaAssetId },
    data: { status: 'UPLOADED' }
  });

  return asset;
}
