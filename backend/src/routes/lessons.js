import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadTmpDir, storeVideo, deleteVideo, publicUrl } from '../storage.js';

const router = Router();

// Stream uploads straight to the shared volume (EFS in Kubernetes) via a
// staging dir, then rename into place. 500MB cap for demo videos.
const upload = multer({
  storage: multer.diskStorage({ destination: uploadTmpDir }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// Confirms the course exists and is owned by the requesting instructor.
async function assertOwnsCourse(courseId, userId) {
  const { rows } = await query(
    `SELECT instructor_id FROM courses WHERE id = $1`,
    [courseId]
  );
  if (!rows[0]) return { ok: false, status: 404, error: 'Course not found' };
  if (rows[0].instructor_id !== userId) {
    return { ok: false, status: 403, error: 'You do not own this course' };
  }
  return { ok: true };
}

// POST /api/courses/:courseId/lessons — create a lesson (instructor/owner).
router.post(
  '/courses/:courseId/lessons',
  authenticate,
  requireRole('instructor'),
  async (req, res, next) => {
    try {
      const check = await assertOwnsCourse(req.params.courseId, req.user.id);
      if (!check.ok) return res.status(check.status).json({ error: check.error });

      const { title, description, position } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title is required' });

      const { rows } = await query(
        `INSERT INTO lessons (course_id, title, description, position)
         VALUES ($1, $2, $3, COALESCE($4, 0))
         RETURNING id, course_id, title, description, position, video_object`,
        [req.params.courseId, title, description || '', position ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/lessons/:lessonId/video — upload/replace the lesson video.
router.post(
  '/lessons/:lessonId/video',
  authenticate,
  requireRole('instructor'),
  upload.single('video'),
  async (req, res, next) => {
    // Multer has already written the file to the staging dir; drop it if
    // anything below rejects the request.
    const discardUpload = () =>
      req.file && fs.promises.unlink(req.file.path).catch(() => {});
    try {
      if (!req.file) return res.status(400).json({ error: 'video file is required' });

      const { rows } = await query(
        `SELECT l.id, l.video_object, c.instructor_id
           FROM lessons l JOIN courses c ON c.id = l.course_id
          WHERE l.id = $1`,
        [req.params.lessonId]
      );
      if (!rows[0]) {
        await discardUpload();
        return res.status(404).json({ error: 'Lesson not found' });
      }
      if (rows[0].instructor_id !== req.user.id) {
        await discardUpload();
        return res.status(403).json({ error: 'You do not own this lesson' });
      }

      const ext = path.extname(req.file.originalname) || '.mp4';
      const objectName = `lessons/${req.params.lessonId}/${randomUUID()}${ext}`;
      await storeVideo(req.file.path, objectName);

      await query(`UPDATE lessons SET video_object = $1 WHERE id = $2`, [
        objectName,
        req.params.lessonId,
      ]);

      // Replacing a video leaves the old file orphaned — clean it up.
      if (rows[0].video_object) await deleteVideo(rows[0].video_object);

      res.json({ video_object: objectName, video_url: publicUrl(objectName) });
    } catch (err) {
      await discardUpload();
      next(err);
    }
  }
);

export default router;
