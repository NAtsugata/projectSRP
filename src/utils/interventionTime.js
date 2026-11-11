const timestamp = value => value ? Date.parse(value) : NaN;

export function readInterventionTiming(report) {
  return {
    arrivalTime: report.arrivalTime || null,
    departureTime: report.departureTime || null,
    arrivalGeo: report.arrivalGeo || null,
    departureGeo: report.departureGeo || null,
    isPaused: !!report.isPaused,
    pauseStartedAt: report.pauseStartedAt || null,
    pauseHistory: Array.isArray(report.pauseHistory) ? report.pauseHistory : [],
  };
}

export function interventionTimeStats(report, now = Date.now()) {
  const start = timestamp(report.arrivalTime);
  const end = timestamp(report.departureTime) || now;
  if (!Number.isFinite(start)) return null;

  const elapsed = Math.max(0, end - start);
  const pauses = Array.isArray(report.pauseHistory) ? report.pauseHistory : [];
  const overlap = (from, to) => Math.max(0, Math.min(to, end) - Math.max(from, start)) || 0;
  const recorded = pauses.reduce((sum, pause) => sum + overlap(timestamp(pause?.start), timestamp(pause?.end)), 0);
  const open = report.isPaused ? overlap(timestamp(report.pauseStartedAt), end) : 0;
  const paused = Math.min(elapsed, recorded + open);

  return { elapsed: Math.floor(elapsed / 1000), worked: Math.floor((elapsed - paused) / 1000) };
}

export function finishInterventionPause(report, at) {
  const history = Array.isArray(report.pauseHistory) ? report.pauseHistory : [];
  const start = timestamp(report.pauseStartedAt);
  const end = timestamp(at);
  const pauseHistory = report.isPaused && Number.isFinite(start) && end >= start
    ? [...history, { start: report.pauseStartedAt, end: at, duration: Math.floor((end - start) / 1000) }]
    : history;
  return { isPaused: false, pauseStartedAt: null, pauseHistory };
}
