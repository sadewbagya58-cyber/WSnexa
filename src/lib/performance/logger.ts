import { performance } from 'perf_hooks';

export interface PerformanceTimingLog {
  requestId: string;
  pathname: string;
  proxyDurationMs: number;
  authLookupDurationMs?: number;
  tenantResolverDurationMs?: number;
  serverComponentDurationMs?: number;
  totalDurationMs: number;
}

export function startTimer() {
  return performance.now();
}

export function stopTimer(startTime: number): number {
  return Math.round(performance.now() - startTime);
}

export function logPerformanceMetric(
  metricName: string,
  pathname: string,
  durationMs: number,
  details?: Record<string, unknown>
) {
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_PERF_LOGS === 'true') {
    console.log(
      `⚡ [PERF_METRIC] [${metricName}] Route: "${pathname}" | Duration: ${durationMs}ms`,
      details ? JSON.stringify(details) : ''
    );
  }
}
