// Thin fetch wrapper. All calls are same-origin (/api/...), proxied to the
// backend by Vite in dev and by nginx in production.
const BASE = '/api';

function getToken() {
  return localStorage.getItem('lms_token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // auth
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  // courses
  listCourses: () => request('/courses'),
  getCourse: (id) => request(`/courses/${id}`),
  createCourse: (payload) => request('/courses', { method: 'POST', body: payload }),
  myTeaching: () => request('/courses/mine/teaching'),

  // lessons
  addLesson: (courseId, payload) =>
    request(`/courses/${courseId}/lessons`, { method: 'POST', body: payload }),
  uploadVideo: (lessonId, file) => {
    const form = new FormData();
    form.append('video', file);
    return request(`/lessons/${lessonId}/video`, {
      method: 'POST',
      body: form,
      isForm: true,
    });
  },

  // enrollments
  enroll: (courseId) =>
    request('/enrollments', { method: 'POST', body: { course_id: courseId } }),
  myCourses: () => request('/enrollments/mine'),

  // progress
  courseProgress: (courseId) => request(`/progress/course/${courseId}`),
  setLessonComplete: (lessonId, completed) =>
    request(`/progress/lesson/${lessonId}`, { method: 'PUT', body: { completed } }),
};
