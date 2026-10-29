import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProgressBar from '../components/ProgressBar.jsx';

export default function MyCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.myCourses()
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>My courses</h1>
        <p className="muted">Courses you're enrolled in and your progress.</p>
      </div>
      {courses.length === 0 ? (
        <p className="muted">You haven't enrolled in any courses yet. <Link to="/">Browse the catalog</Link>.</p>
      ) : (
        <div className="grid">
          {courses.map((c) => (
            <Link to={`/courses/${c.id}`} key={c.id} className="card course-card">
              <h3>{c.title}</h3>
              <p className="muted">By {c.instructor_name}</p>
              <ProgressBar percent={c.progress_percent} />
              <div className="meta">
                <span>{c.progress_percent}% complete</span>
                <span>{c.completed_count}/{c.lesson_count} lessons</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
