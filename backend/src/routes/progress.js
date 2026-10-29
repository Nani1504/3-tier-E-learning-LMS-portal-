import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/progress/course/:courseId — the student's per-lesson completion
// map plus an overall percentage for one course.
router.get(
  '/course/:courseId',
  authenticate,
  requireRole('student'),
  async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT l.id AS lesson_id, l.title,
                COALESCE(p.completed, false) AS completed,
                p.completed_at
           FROM lessons l
           LEFT JOIN progress p
                  ON p.lesson_id = l.id AND p.student_id = $1
          WHERE l.course_id = $2
          ORDER BY l.position ASC, l.id ASC`,
        [req.user.id, req.params.courseId]
      );
      const total = rows.length;
      const done = rows.filter((r) => r.completed).length;
      res.json({
        lessons: rows,
        completed_count: done,
        lesson_count: total,
        progress_percent: total === 0 ? 0 : Math.round((100 * done) / total),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/progress/lesson/:lessonId — mark a lesson complete/incomplete.
router.put(
  '/lesson/:lessonId',
  authenticate,
  requireRole('student'),
  async (req, res, next) => {
    try {
      const completed = req.body?.completed !== false; // default true
      const { rows } = await query(
        `INSERT INTO progress (student_id, lesson_id, completed, completed_at)
         VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END)
         ON CONFLICT (student_id, lesson_id)
         DO UPDATE SET completed = EXCLUDED.completed,
                       completed_at = CASE WHEN EXCLUDED.completed THEN now() ELSE NULL END
         RETURNING lesson_id, completed, completed_at`,
        [req.user.id, req.params.lessonId, completed]
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
