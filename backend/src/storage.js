import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// Root directory for lesson videos. In Kubernetes this is an EFS-backed
// PersistentVolume (ReadWriteMany) mounted into every backend replica, so a
// video uploaded through one pod is instantly readable by all the others.
export const videoRoot = path.resolve(config.storage.dataDir);

// Staging area for in-flight uploads, on the same filesystem as the final
// destination so the post-upload rename is cheap and atomic.
export const uploadTmpDir = path.join(videoRoot, '.uploads');

// Idempotently ensure the storage directories exist. Called once at startup.
export function ensureStorageDir() {
  fs.mkdirSync(uploadTmpDir, { recursive: true });
}

// Resolve an object name ("lessons/<id>/<uuid>.mp4") to an absolute path,
// refusing anything that would escape the video root.
export function videoPath(objectName) {
  const abs = path.resolve(videoRoot, objectName);
  if (!abs.startsWith(videoRoot + path.sep)) {
    throw new Error(`Unsafe video object name: ${objectName}`);
  }
  return abs;
}

// Move a finished upload from the staging area to its final object path.
export async function storeVideo(tmpPath, objectName) {
  const dest = videoPath(objectName);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.rename(tmpPath, dest);
}

// Best-effort delete, used when a lesson's video is replaced.
export async function deleteVideo(objectName) {
  try {
    await fs.promises.unlink(videoPath(objectName));
  } catch {
    // Already gone (or never written) — nothing to do.
  }
}

// Browser-facing URL for a stored object. The backend serves the shared
// volume at /api/videos, so a relative URL works behind any host or ingress.
export function publicUrl(objectName) {
  return `/api/videos/${objectName}`;
}
