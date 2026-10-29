import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

export default function CourseDetail() {
  const { id } = useParams();
  const { user, isStudent } = useAuth();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null); // { lessons, progress_percent, ... }
  const [active, setActive] = useState(null); // currently playing lesson
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadProgress = useCallback(async () => {
    if (!isStudent) return;
    try {
      const p = await api.courseProgress(id);
      setProgress(p);
      setEnrolled(true);
    } catch {
      // 404-ish means not enrolled yet — leave progress null.
    }
  }, [id, isStudent]);

  useEffect(() => {
    api.getCourse(id).then((c) => {
      setCourse(c);
      setActive(c.lessons[0] || null);
    }).catch((e) => setError(e.message));
    loadProgress();
  }, [id, loadProgress]);

  async function handleEnroll() {
    setMsg('');
    try {
      await api.enroll(id);
      setEnrolled(true);
      setMsg('Enrolled! You can now track your progress.');
      loadProgress();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleComplete(lesson) {
    const current = progress?.lessons.find((l) => l.lesson_id === lesson.id)?.completed;
    await api.setLessonComplete(lesson.id, !current);
    loadProgress();
  }

  if (error) return <div className="alert">{error}</div>;
  if (!course) return <p>Loading…</p>;

  const completedMap = new Map(
    (progress?.lessons || []).map((l) => [l.lesson_id, l.completed])
  );

  return (
    <div className="course-detail">
      <div className="page-head">
        <h1>{course.title}</h1>
        <p className="muted">By {course.instructor_name}</p>
        <p>{course.description}</p>

        {isStudent && !enrolled && (
          <button className="btn btn-primary" onClick={handleEnroll}>Enroll in this course</button>
        )}
        {!user && <p className="muted">Log in as a student to enroll and track progress.</p>}
        {msg && <div className="alert alert-ok">{msg}</div>}
        {enrolled && progress && (
          <div className="progress-summary">
            <ProgressBar percent={progress.progress_percent} />
            <span>{progress.progress_percent}% complete
              ({progress.completed_count}/{progress.lesson_count})</span>
          </div>
        )}
      </div>

      <div className="course-body">
        <section className="player">
          {active ? (
            <>
              <h2>{active.title}</h2>
              {active.video_url ? (
                <video key={active.id} controls width="100%" src={active.video_url} />
              ) : (
                <div className="video-placeholder">No video uploaded for this lesson yet.</div>
              )}
              <p className="muted">{active.description}</p>
            </>
          ) : (
            <p className="muted">This course has no lessons yet.</p>
          )}
        </section>

        <aside className="lesson-list">
          <h3>Lessons</h3>
          <ol>
            {course.lessons.map((l) => (
              <li key={l.id} className={active?.id === l.id ? 'active' : ''}>
                <button className="lesson-link" onClick={() => setActive(l)}>
                  {completedMap.get(l.id) ? '✅' : '▶️'} {l.title}
                </button>
                {enrolled && (
                  <button className="btn btn-tiny" onClick={() => toggleComplete(l)}>
                    {completedMap.get(l.id) ? 'Undo' : 'Mark done'}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
