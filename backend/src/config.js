import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'lms',
    password: process.env.DB_PASSWORD || 'lms',
    database: process.env.DB_NAME || 'lms',
    // Small pool so a handful of replicas don't exhaust Postgres connections.
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  storage: {
    // Directory where lesson videos live. In Kubernetes this is the EFS
    // volume mounted at /data/videos; locally any writable folder works.
    dataDir: process.env.VIDEO_DATA_DIR || './data/videos',
  },

  // Comma-separated list, or "*" for any origin (fine for a demo).
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
