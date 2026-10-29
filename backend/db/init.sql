-- E-Learning & Course Management System — schema + demo seed data.
-- Runs automatically on first Postgres start (mounted into
-- /docker-entrypoint-initdb.d in compose, and via an initdb ConfigMap in k8s).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('student', 'instructor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id            SERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  instructor_id INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id           SERIAL PRIMARY KEY,
  course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0,
  video_object TEXT,   -- object key in the video bucket, NULL until uploaded
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS progress (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course     ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_student   ON progress(student_id);

-- ---------------------------------------------------------------------------
-- Demo seed data. Passwords are bcrypt hashes of "password123".
-- Instructor: alice@lms.dev  |  Student: bob@lms.dev
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Alice Instructor', 'alice@lms.dev',
   '$2b$10$FsfTzpBieNfLjgPw3AwCQeIB/1IbcdR.NC.L2VEru62eYReb/m4fW', 'instructor'),
  ('Bob Student', 'bob@lms.dev',
   '$2b$10$FsfTzpBieNfLjgPw3AwCQeIB/1IbcdR.NC.L2VEru62eYReb/m4fW', 'student')
ON CONFLICT (email) DO NOTHING;

INSERT INTO courses (title, description, instructor_id)
SELECT 'Kubernetes 101',
       'Learn container orchestration from pods to deployments and services.',
       u.id
  FROM users u WHERE u.email = 'alice@lms.dev'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (course_id, title, description, position)
SELECT c.id, v.title, v.description, v.position
  FROM courses c
  CROSS JOIN (VALUES
     ('What is Kubernetes?', 'Orchestration concepts and architecture.', 1),
     ('Pods and Deployments', 'The core workload primitives.', 2),
     ('Services and Ingress', 'Exposing your apps to traffic.', 3)
  ) AS v(title, description, position)
 WHERE c.title = 'Kubernetes 101'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.course_id = c.id);
