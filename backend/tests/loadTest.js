/**
 * YenSync / EduTimes Production Readiness & Load Testing Suite
 * Measures Throughput (RPS), Latency percentiles (p50, p90, p99), Error Rates, and Resource Usage.
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const BASE_URL = process.env.TEST_TARGET_URL || 'http://localhost:5000';
const isHttps = BASE_URL.startsWith('https');
const httpModule = isHttps ? https : http;

// Helper: Make HTTP request returning status, duration, and body
function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const start = performance.now();
    
    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      timeout: 10000
    };

    const req = httpModule.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = performance.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({
          statusCode: res.statusCode,
          duration,
          data: parsed,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        error: err.message,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        statusCode: 408,
        duration,
        error: 'Request Timeout',
        success: false
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Concurrency Pool Runner
async function runConcurrentScenario({ name, concurrency, totalRequests, requestFn }) {
  console.log(`\n======================================================`);
  console.log(`🚀 Running Scenario: ${name}`);
  console.log(`   Concurrency: ${concurrency} | Total Requests: ${totalRequests}`);
  console.log(`======================================================`);

  const memBefore = process.memoryUsage();
  const startTime = performance.now();
  const latencies = [];
  const statusCounts = {};
  let completed = 0;
  let successCount = 0;
  let failureCount = 0;

  let requestIndex = 0;

  async function worker() {
    while (requestIndex < totalRequests) {
      const currentIdx = requestIndex++;
      const result = await requestFn(currentIdx);
      completed++;
      latencies.push(result.duration);
      
      const code = result.statusCode || 'ERR';
      statusCounts[code] = (statusCounts[code] || 0) + 1;
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }

  // Spawn concurrency pool
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  const totalDurationMs = performance.now() - startTime;
  const totalDurationSec = totalDurationMs / 1000;
  const rps = (totalRequests / totalDurationSec).toFixed(1);

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const min = latencies[0]?.toFixed(2) || 0;
  const max = latencies[latencies.length - 1]?.toFixed(2) || 0;
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.50)]?.toFixed(2) || 0;
  const p90 = latencies[Math.floor(latencies.length * 0.90)]?.toFixed(2) || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)]?.toFixed(2) || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)]?.toFixed(2) || 0;

  const memAfter = process.memoryUsage();
  const heapDiffMb = ((memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2);

  console.log(`📊 Results for [${name}]:`);
  console.log(`   - Throughput:       ${rps} req/sec`);
  console.log(`   - Total Time:       ${totalDurationSec.toFixed(2)}s`);
  console.log(`   - Success / Fail:   ${successCount} / ${failureCount} (${((failureCount / totalRequests) * 100).toFixed(1)}% error rate)`);
  console.log(`   - Status Breakdown: ${JSON.stringify(statusCounts)}`);
  console.log(`   - Latency (ms):     Min: ${min} | Avg: ${avg} | p50: ${p50} | p90: ${p90} | p95: ${p95} | p99: ${p99} | Max: ${max}`);
  console.log(`   - Memory Impact:    Heap delta: ${heapDiffMb} MB`);

  return {
    name,
    rps: parseFloat(rps),
    totalRequests,
    totalDurationSec,
    successCount,
    failureCount,
    errorRate: ((failureCount / totalRequests) * 100).toFixed(2),
    min, avg, p50, p90, p95, p99, max,
    statusCounts
  };
}

// Master Load Test Suite
async function runAllLoadTests() {
  console.log(`\n🔬 Initializing YenSync Load Test Suite against ${BASE_URL}...`);

  // Verify server is up
  const health = await makeRequest({ path: '/api/health' });
  if (!health.success) {
    console.error(`❌ Server at ${BASE_URL} is unreachable or unhealthy:`, health);
    process.exit(1);
  }
  console.log(`✅ Target server is online. Database mode: ${health.data.database?.mode || 'Unknown'}\n`);

  const results = [];

  // Scenario 1: Health check throughput (baseline HTTP engine speed)
  results.push(await runConcurrentScenario({
    name: 'Health Check (Liveness Probe)',
    concurrency: 20,
    totalRequests: 200,
    requestFn: () => makeRequest({ path: '/api/health' })
  }));

  // Scenario 1b: Deep Readiness Probe (Database connection & ping latency)
  results.push(await runConcurrentScenario({
    name: 'Readiness Probe (DB Latency & Connectivity)',
    concurrency: 10,
    totalRequests: 50,
    requestFn: () => makeRequest({ path: '/api/health/ready' })
  }));

  // Obtain auth token for authenticated scenarios
  console.log(`\n🔑 Authenticating test user for protected endpoint scenarios...`);
  let token = null;
  const loginRes = await makeRequest({
    method: 'POST',
    path: '/api/auth/login',
    body: {
      faculty_code: 'FAC_AIML_01',
      password: 'password123',
      department_code: 'AIML'
    }
  });

  if (loginRes.success && loginRes.data.token) {
    token = loginRes.data.token;
    console.log(`✅ Successfully authenticated as ${loginRes.data.user.name} (${loginRes.data.user.role}).`);
  } else {
    const jwt = require('../src/config/jwt');
    const jsonwebtoken = require('jsonwebtoken');
    token = jsonwebtoken.sign({
      id: 1,
      faculty_code: 'FAC_AIML_01',
      name: 'Dr. Test Coordinator',
      role: 'admin',
      department_id: 1,
      department_code: 'AIML'
    }, jwt.JWT_SECRET, { expiresIn: '1h' });
    console.log(`ℹ️ Generated test administrative JWT for benchmark scenarios.`);
  }

  // Scenario 2: Timeslots Retrieval (Authenticated & Cached)
  results.push(await runConcurrentScenario({
    name: 'Get Timeslots (Grid Retrieval - Cached)',
    concurrency: 20,
    totalRequests: 200,
    requestFn: () => makeRequest({
      path: '/api/timeslots',
      headers: { Authorization: `Bearer ${token}` }
    })
  }));

  // Scenario 3: Department Metadata Retrieval (Cached)
  results.push(await runConcurrentScenario({
    name: 'Get Departments (Metadata - Cached)',
    concurrency: 15,
    totalRequests: 150,
    requestFn: () => makeRequest({ path: '/api/departments' })
  }));

  // Scenario 4: Authenticated Timetable Read with full joins
  results.push(await runConcurrentScenario({
    name: 'Authenticated Timetable Query (Full Joins)',
    concurrency: 15,
    totalRequests: 150,
    requestFn: () => makeRequest({
      path: '/api/timetable?academic_year=2026-2027&department_id=1',
      headers: { Authorization: `Bearer ${token}` }
    })
  }));

  // Scenario 5: Real-time Live Clash Validator (Drag & Drop stress)
  results.push(await runConcurrentScenario({
    name: 'Live Clash Validation (Drag-and-Drop)',
    concurrency: 15,
    totalRequests: 150,
    requestFn: (idx) => makeRequest({
      method: 'POST',
      path: '/api/timetable/validate-move',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        subject_id: (idx % 10) + 1,
        semester_id: 1,
        timeslot_id: (idx % 30) + 1,
        academic_year: '2026-2027'
      }
    })
  }));

  // Print Summary Table
  console.log(`\n======================================================`);
  console.log(`📈 COMPREHENSIVE LOAD TEST SUMMARY REPORT`);
  console.log(`======================================================`);
  console.table(results.map(r => ({
    Scenario: r.name,
    'Throughput (RPS)': r.rps,
    'Avg Latency (ms)': r.avg,
    'p50 (ms)': r.p50,
    'p95 (ms)': r.p95,
    'p99 (ms)': r.p99,
    'Error Rate (%)': `${r.errorRate}%`
  })));

  return results;
}

if (require.main === module) {
  runAllLoadTests().catch(err => {
    console.error('Fatal load test error:', err);
    process.exit(1);
  });
}

module.exports = { runAllLoadTests };
