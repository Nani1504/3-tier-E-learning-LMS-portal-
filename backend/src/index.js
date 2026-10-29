import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { ping } from './db.js';
import { ensureStorageDir, videoRoot } from './storage.js';

import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import enrollmentRoutes from './routes/enrollments.js';
import progressRoutes from './routes/progress.js';

const app = express();

app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json());
app.use(morgan('tiny'));

// --- Health probes (used by Kubernetes) ---------------------------------
// Liveness: process is up. Readiness: dependencies reachable.
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.get('/readyz', async (_req, res) => {
  try {
    await ping();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not-ready' });
  }
});

// --- API routes ----------------------------------------------------------
// Lesson videos live on a shared volume (EFS in Kubernetes, so every replica
// sees the same files). express.static streams them with HTTP Range support,
// which is what makes <video> seeking work. The dot-prefixed .uploads staging
// dir is ignored by express.static, so in-flight uploads are never served.
app.use('/api/videos', express.static(videoRoot));
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', lessonRoutes); // exposes /api/courses/:id/lessons and /api/lessons/:id/video
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/progress', progressRoutes);

app.get('/', (_req, res) => res.json({ service: 'lms-backend', status: 'ok' }));

// 404 + error handlers
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

function start() {
  // Make sure the video directory (the EFS mount in Kubernetes) is writable.
  ensureStorageDir();
  app.listen(config.port, () => {
    console.log(`lms-backend listening on :${config.port}`);
  });
}

start();
