import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { publicUrl } from '../storage.js';

const router = Router();

// GET /api/courses — public catalog with lesson + enrollment counts.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.description, c.created_at,
              u.name AS instructor_name, u.id AS instructor_id,
              COUNT(DISTINCT l.id)::int  AS lesson_count,
              COUNT(DISTINCT e.id)::int  AS enrollment_count
         FROM courses c
         JOIN users u        ON u.id = c.instructor_id
         LEFT JOIN lessons l ON l.course_id = c.id
         LEFT JOIN enrollments e ON e.course_id = c.id
        GROUP BY c.id, u.name, u.id
        ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id — course detail with ordered lessons.
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: courseRows } = await query(
      `SELECT c.id, c.title, c.description, c.created_at,
              u.name AS instructor_name, u.id AS instructor_id
         FROM courses c
         JOIN users u ON u.id = c.instructor_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!courseRows[0]) return res.status(404).json({ error: 'Course not found' });

    const { rows: lessons } = await query(
      `SELECT id, title, description, position, video_object
         FROM lessons WHERE course_id = $1 ORDER BY position ASC, id ASC`,
      [req.params.id]
    );

    const course = courseRows[0];
    course.lessons = lessons.map((l) => ({
      ...l,
      video_url: l.video_object ? publicUrl(l.video_object) : null,
    }));
    res.json(course);
  } catch (err) {
    next(err);
  }
});

// POST /api/courses — instructors only.
router.post('/', authenticate, requireRole('instructor'), async (req, res, next) => {
  try {
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    const { rows } = await query(
      `INSERT INTO courses (title, description, instructor_id)
       VALUES ($1, $2, $3)
       RETURNING id, title, description, created_at, instructor_id`,
      [title, description || '', req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/mine/teaching — courses owned by the logged-in instructor.
router.get('/mine/teaching', authenticate, requireRole('instructor'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.title, c.description, c.created_at,
              COUNT(DISTINCT l.id)::int AS lesson_count,
              COUNT(DISTINCT e.id)::int AS enrollment_count
         FROM courses c
         LEFT JOIN lessons l ON l.course_id = c.id
         LEFT JOIN enrollments e ON e.course_id = c.id
        WHERE c.instructor_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
