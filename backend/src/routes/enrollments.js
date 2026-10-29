import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/enrollments — student enrolls in a course.
router.post('/', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const { course_id } = req.body || {};
    if (!course_id) return res.status(400).json({ error: 'course_id is required' });

    const course = await query(`SELECT id FROM courses WHERE id = $1`, [course_id]);
    if (!course.rows[0]) return res.status(404).json({ error: 'Course not found' });

    const { rows } = await query(
      `INSERT INTO enrollments (student_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (student_id, course_id) DO UPDATE SET student_id = EXCLUDED.student_id
       RETURNING id, student_id, course_id, enrolled_at`,
      [req.user.id, course_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/enrollments/mine — "My Courses" with completion percentage.
router.get('/mine', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.description, e.enrolled_at,
              u.name AS instructor_name,
              COUNT(DISTINCT l.id)::int AS lesson_count,
              COUNT(DISTINCT p.lesson_id) FILTER (WHERE p.completed)::int AS completed_count,
              CASE WHEN COUNT(DISTINCT l.id) = 0 THEN 0
                   ELSE ROUND(
                     100.0 * COUNT(DISTINCT p.lesson_id) FILTER (WHERE p.completed)
                     / COUNT(DISTINCT l.id))
              END::int AS progress_percent
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN users u   ON u.id = c.instructor_id
         LEFT JOIN lessons l  ON l.course_id = c.id
         LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = e.student_id
        WHERE e.student_id = $1
        GROUP BY c.id, e.enrolled_at, u.name
        ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
