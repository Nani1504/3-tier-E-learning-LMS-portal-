import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form-card">
      <h1>Create your account</h1>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label>Full name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={update('password')} minLength={6} required />
        </label>
        <label>I am a…
          <select value={form.role} onChange={update('role')}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
