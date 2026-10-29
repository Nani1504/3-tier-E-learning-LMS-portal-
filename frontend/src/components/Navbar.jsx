import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, isInstructor, isStudent, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="brand">
          <img src="/aviz-logo.png" alt="Aviz Academy" className="brand-logo" />
          <span className="brand-text">Aviz Academy</span>
        </Link>
        <nav className="nav-links">
          <Link to="/">Catalog</Link>
          {isStudent && <Link to="/my-courses">My Courses</Link>}
          {isInstructor && <Link to="/teach">Teach</Link>}
          {user ? (
            <>
              <span className="nav-user">
                {user.name} <span className={`badge badge-${user.role}`}>{user.role}</span>
              </span>
              <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup" className="btn btn-primary">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
