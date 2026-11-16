import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp-up to 20 users
    { duration: '20s', target: 20 }, // Stay at 20 users
    { duration: '10s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000';

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Fetch Timeslots
  const timeslotsRes = http.get(`${BASE_URL}/api/timeslots`);
  check(timeslotsRes, {
    'timeslots status is 200': (r) => r.status === 200,
    'timeslots returned items': (r) => JSON.parse(r.body).length > 0,
  });

  // 3. Fetch Departments
  const deptsRes = http.get(`${BASE_URL}/api/departments`);
  check(deptsRes, {
    'departments status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
