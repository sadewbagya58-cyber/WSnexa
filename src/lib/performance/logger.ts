const perf = typeof globalThis !== 'undefined' && globalThis.performance ? globalThis.performance : Date;

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
  return perf.now();
}

export function stopTimer(startTime: number): number {
  return Math.round(perf.now() - startTime);
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
