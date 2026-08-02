=-098/**
 * imiqX Local Load Test — k6
 *
 * Usage:
 *   # Light smoke test (5 users, 30s)
 *   k6 run scripts/load-test.js
 *
 *   # Medium load (50 users, 1 min)
 *   k6 run --vus 50 --duration 1m scripts/load-test.js
 *
 *   # Ramp-up stress test
 *   k6 run --stage 0s:0,30s:20,1m:50,30s:0 scripts/load-test.js
 *
 * Make sure the dev server is running first:
 *   npm run dev
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────
const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:3000';
const TENANT      = __ENV.TENANT      || 'fashionhub';
const PREFIX      = `${BASE_URL}/${TENANT}`;

// ── Custom metrics ─────────────────────────────────────────
const apiDuration  = new Trend('api_duration_ms', true);
const errorRate    = new Rate('error_rate');

// ── Default options (override with CLI flags) ───────────────
export const options = {
  vus:      5,
  duration: '30s',
  thresholds: {
    http_req_duration:              ['p(95)<6000'],   // relaxed for cold-start Vercel
    'http_req_duration{name:products}':  ['p(95)<3000'],
    'http_req_duration{name:settings}':  ['p(95)<3000'],
    'http_req_duration{name:pwa_manifest}': ['p(95)<2000'],
    error_rate:                     ['rate<0.05'],
  },
};

// ── Scenarios ──────────────────────────────────────────────
export default function () {
  const headers = {
    'Accept': 'application/json',
    'x-tenant-slug-candidate': TENANT,
    'x-tenant-source': 'path',
  };

  // 1. Storefront / home page
  let r = http.get(`${PREFIX}`, { tags: { name: 'storefront' } });
  check(r, { 'storefront 200': (res) => res.status === 200 });
  errorRate.add(r.status >= 400);
  sleep(0.5);

  // 2. Products API
  r = http.get(`${PREFIX}/api/products`, { headers, tags: { name: 'products' } });
  check(r, { 'products 200': (res) => res.status === 200 });
  apiDuration.add(r.timings.duration, { endpoint: 'products' });
  errorRate.add(r.status >= 400);
  sleep(0.3);

  // 3. Settings API
  r = http.get(`${PREFIX}/api/settings`, { headers, tags: { name: 'settings' } });
  check(r, { 'settings 200': (res) => res.status === 200 });
  apiDuration.add(r.timings.duration, { endpoint: 'settings' });
  errorRate.add(r.status >= 400);
  sleep(0.3);

  // 4. Banners API
  r = http.get(`${PREFIX}/api/banners`, { headers, tags: { name: 'banners' } });
  check(r, { 'banners ok': (res) => res.status < 500 });
  apiDuration.add(r.timings.duration, { endpoint: 'banners' });
  sleep(0.3);

  // 5. Product detail page
  r = http.get(`${PREFIX}/search`, { tags: { name: 'search_page' } });
  check(r, { 'search page 200': (res) => res.status === 200 });
  errorRate.add(r.status >= 400);
  sleep(0.3);

  // 6. PWA manifest
  r = http.get(`${PREFIX}/api/pwa-manifest`, { headers, tags: { name: 'pwa_manifest' } });
  check(r, { 'manifest 200': (res) => res.status === 200 });
  apiDuration.add(r.timings.duration, { endpoint: 'pwa_manifest' });
  sleep(0.2);

  // 7. Coupons API
  r = http.get(`${PREFIX}/api/coupons`, { headers, tags: { name: 'coupons' } });
  check(r, { 'coupons ok': (res) => res.status < 500 });
  sleep(0.2);

  // Pause between iterations to simulate real user think time
  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  const p95  = data.metrics.http_req_duration?.values?.['p(95)']
  const p50  = data.metrics.http_req_duration?.values?.['p(50)']
  const rps  = data.metrics.http_reqs?.values?.rate
  const errs = data.metrics.error_rate?.values?.rate
  const reqs = data.metrics.http_reqs?.values?.count

  const endpoints = [
    'storefront', 'products', 'settings', 'banners',
    'search_page', 'pwa_manifest', 'coupons',
  ]

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║         imiqX Production Load Test Results       ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Target       : ${__ENV.BASE_URL}/${__ENV.TENANT}`)
  console.log(`  Total reqs   : ${reqs ?? 'N/A'}`)
  console.log(`  Req/sec      : ${rps?.toFixed(2) ?? 'N/A'}`)
  console.log(`  Median (p50) : ${p50?.toFixed(0) ?? 'N/A'} ms`)
  console.log(`  p95 latency  : ${p95?.toFixed(0) ?? 'N/A'} ms  ${p95 > 4000 ? '🔴 SLOW' : p95 > 2500 ? '🟡 OK' : '🟢 FAST'}`)
  console.log(`  Error rate   : ${((errs ?? 0) * 100).toFixed(2)}%`)
  console.log('')
  console.log('  Per-endpoint p95:')
  for (const ep of endpoints) {
    const key = `http_req_duration{name:${ep}}`
    const val = data.metrics[key]?.values?.['p(95)']
    if (val !== undefined) {
      const icon = val > 4000 ? '🔴' : val > 2000 ? '🟡' : '🟢'
      console.log(`    ${icon}  ${ep.padEnd(16)} ${val.toFixed(0)} ms`)
    }
  }
  console.log('══════════════════════════════════════════════════\n')
  return {}
}
