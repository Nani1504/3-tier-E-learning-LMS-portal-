import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Catalog() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listCourses()
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading catalog…</p>;
  if (error) return <div className="alert">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Course catalog</h1>
        <p className="muted">Browse courses and enroll to start learning.</p>
      </div>
      {courses.length === 0 ? (
        <p className="muted">No courses yet. Instructors can create the first one.</p>
      ) : (
        <div className="grid">
          {courses.map((c) => (
            <Link to={`/courses/${c.id}`} key={c.id} className="card course-card">
              <h3>{c.title}</h3>
              <p className="muted clamp">{c.description}</p>
              <div className="meta">
                <span>👨‍🏫 {c.instructor_name}</span>
                <span>📚 {c.lesson_count} lessons</span>
                <span>👥 {c.enrollment_count} enrolled</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
