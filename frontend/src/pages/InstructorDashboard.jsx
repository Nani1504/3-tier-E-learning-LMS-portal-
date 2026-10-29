import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function InstructorDashboard() {
  const [courses, setCourses] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = () => api.myTeaching().then(setCourses).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function createCourse(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createCourse({ title, description });
      setTitle('');
      setDescription('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Instructor dashboard</h1>
        <p className="muted">Create courses, add lessons, and upload lesson videos.</p>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="card form-card">
        <h2>New course</h2>
        <form onSubmit={createCourse}>
          <label>Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <button className="btn btn-primary">Create course</button>
        </form>
      </div>

      <h2>Your courses</h2>
      {courses.length === 0 ? (
        <p className="muted">No courses yet — create one above.</p>
      ) : (
        <div className="stack">
          {courses.map((c) => (
            <div className="card" key={c.id}>
              <div className="row-between">
                <div>
                  <h3>{c.title}</h3>
                  <p className="muted">{c.lesson_count} lessons · {c.enrollment_count} students</p>
                </div>
                <button className="btn btn-ghost" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  {expanded === c.id ? 'Close' : 'Manage lessons'}
                </button>
              </div>
              {expanded === c.id && <LessonManager courseId={c.id} onChange={load} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LessonManager({ courseId, onChange }) {
  const [lessons, setLessons] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');

  const load = () => api.getCourse(courseId).then((c) => setLessons(c.lessons));
  useEffect(() => { load(); }, [courseId]);

  async function addLesson(e) {
    e.preventDefault();
    setStatus('');
    await api.addLesson(courseId, {
      title,
      description,
      position: lessons.length + 1,
    });
    setTitle('');
    setDescription('');
    load();
    onChange?.();
  }

  async function upload(lessonId, file) {
    if (!file) return;
    setStatus(`Uploading “${file.name}”…`);
    try {
      await api.uploadVideo(lessonId, file);
      setStatus('Upload complete.');
      load();
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`);
    }
  }

  return (
    <div className="lesson-manager">
      {status && <div className="alert alert-ok">{status}</div>}
      <ol>
        {lessons.map((l) => (
          <li key={l.id}>
            <strong>{l.title}</strong> {l.video_url ? '🎬' : '— no video'}
            <label className="upload-inline">
              <span className="btn btn-tiny">{l.video_url ? 'Replace video' : 'Upload video'}</span>
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => upload(l.id, e.target.files[0])}
              />
            </label>
          </li>
        ))}
      </ol>
      <form onSubmit={addLesson} className="inline-form">
        <input placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn btn-secondary">Add lesson</button>
      </form>
    </div>
  );
}
