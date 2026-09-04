/**
 * Centralized API client for YenSync
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('yensync_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `HTTP Error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status === 401) {
      // Auto logout on token expiration
      localStorage.removeItem('yensync_token');
      localStorage.removeItem('yensync_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (faculty_code, password, department_id = null, department_code = null) => 
    apiRequest('/auth/login', { method: 'POST', body: { faculty_code, password, department_id, department_code } }),
  getMe: () => apiRequest('/auth/me'),

  // Departments
  getPublicDepartments: () => apiRequest('/departments/public').catch(() => apiRequest('/departments')),
  getDepartments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/departments${qs ? `?${qs}` : ''}`);
  },
  createDepartment: (data) => apiRequest('/departments', { method: 'POST', body: data }),
  updateDepartment: (id, data) => apiRequest(`/departments/${id}`, { method: 'PUT', body: data }),
  deleteDepartment: (id) => apiRequest(`/departments/${id}`, { method: 'DELETE' }),

  // Faculty
  getFaculty: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/faculty${qs ? `?${qs}` : ''}`);
  },
  createFaculty: (data) => apiRequest('/faculty', { method: 'POST', body: data }),
  updateFaculty: (id, data) => apiRequest(`/faculty/${id}`, { method: 'PUT', body: data }),
  deleteFaculty: (id) => apiRequest(`/faculty/${id}`, { method: 'DELETE' }),

  // Semesters
  getSemesters: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/semesters${qs ? `?${qs}` : ''}`);
  },
  createSemester: (data) => apiRequest('/semesters', { method: 'POST', body: data }),
  updateSemester: (id, data) => apiRequest(`/semesters/${id}`, { method: 'PUT', body: data }),
  deleteSemester: (id) => apiRequest(`/semesters/${id}`, { method: 'DELETE' }),

  // Subjects
  getSubjects: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/subjects${qs ? `?${qs}` : ''}`);
  },
  createSubject: (data) => apiRequest('/subjects', { method: 'POST', body: data }),
  updateSubject: (id, data) => apiRequest(`/subjects/${id}`, { method: 'PUT', body: data }),
  deleteSubject: (id) => apiRequest(`/subjects/${id}`, { method: 'DELETE' }),

  // Timeslots
  getTimeslots: () => apiRequest('/timeslots'),
  createTimeslot: (data) => apiRequest('/timeslots', { method: 'POST', body: data }),
  updateTimeslot: (id, data) => apiRequest(`/timeslots/${id}`, { method: 'PUT', body: data }),
  deleteTimeslot: (id) => apiRequest(`/timeslots/${id}`, { method: 'DELETE' }),

  // Timetable
  getTimetable: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return apiRequest(`/timetable?${searchParams.toString()}`);
  },
  validateMove: (data) => apiRequest('/timetable/validate-move', { method: 'POST', body: data }),
  createTimetableEntry: (data) => apiRequest('/timetable', { method: 'POST', body: data }),
  updateTimetableEntry: (id, data) => apiRequest(`/timetable/${id}`, { method: 'PUT', body: data }),
  deleteTimetableEntry: (id) => apiRequest(`/timetable/${id}`, { method: 'DELETE' }),
  autoGenerateTimetable: (academic_year, overwrite = true) => 
    apiRequest('/timetable/auto-generate', { method: 'POST', body: { academic_year, overwrite } }),
  clearTimetable: (data) => apiRequest('/timetable/clear', { method: 'POST', body: data }),

  // Calendar
  getCalendar: () => apiRequest('/calendar'),
};
