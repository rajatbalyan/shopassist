type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

/** One JSON line per event; Cloud Logging picks up `severity` and `message`. */
export function log(severity: Severity, message: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === 'test' && severity !== 'ERROR') return;
  const line = JSON.stringify({ severity, message, ...fields });
  if (severity === 'ERROR' || severity === 'WARNING') console.error(line);
  else console.log(line);
}
