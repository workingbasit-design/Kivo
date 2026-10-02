/**
 * Structured JSON logger (playbook layer 13a).
 *
 * Emits one JSON object per line: { timestamp, level, message, ...context }.
 * - Levels: debug < info < warn < error. `debug` is disabled when
 *   NODE_ENV=production. Minimum level is overridable via LOG_LEVEL.
 * - Sensitive data is redacted automatically: any field whose name looks
 *   like password/token/secret/authorization/apiKey/clientSecret (nested
 *   objects included), and any string value shaped like a bearer token.
 * - Pass requestId/userId/businessId (or anything else) via the context
 *   param; use `logger.child({...})` to bind context once for a request.
 *
 * Dependency-free. Safe to import from server actions, route handlers,
 * and middleware-adjacent lib code.
 *
 * Migration: remaining `console.*` call sites carry a `// TODO(logging)`
 * comment — migrate them to this logger when touched (see 13c).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  businessId?: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const REDACTED = '[REDACTED]';

/** Field names whose values must never reach the logs. */
const SENSITIVE_KEY =
  /(password|passwd|pwd|passcode|token|secret|authorization|api[_-]?key|client[_-]?secret|access[_-]?key|private[_-]?key|bearer|session[_-]?token|auth)/i;

/** A string value shaped like "Bearer <credentials>". */
const BEARER_VALUE = /^\s*Bearer\s+[A-Za-z0-9\-._~+/=]+=*$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Error) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

/** Serialize an Error without dropping message/stack (Object.entries misses them). */
function serializeError(err: Error): Record<string, unknown> {
  const out: Record<string, unknown> = { name: err.name, message: err.message };
  if (typeof err.stack === 'string') out.stack = err.stack;
  // Carry enumerable custom props (e.g. `code`) through redaction.
  for (const [k, v] of Object.entries(err)) {
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function redactValue(value: unknown, key: string | undefined, seen: Set<object>): unknown {
  if (typeof value === 'string') {
    if ((key && SENSITIVE_KEY.test(key)) || BEARER_VALUE.test(value)) return REDACTED;
    return value;
  }
  if (value instanceof Error) {
    return redactValue(serializeError(value), key, seen);
  }
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, undefined, seen));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redactValue(v, k, seen);
      }
      return out;
    }
    return String(value);
  }
  return value;
}

/** Deep-clone with secrets redacted. Never throws — logging must not break the app. */
export function redactForLog(value: unknown): unknown {
  try {
    return redactValue(value, undefined, new Set());
  } catch {
    return REDACTED;
  }
}

function parseLevel(raw: string | undefined): LogLevel | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return v === 'debug' || v === 'info' || v === 'warn' || v === 'error' ? v : null;
}

function minLevel(): LogLevel {
  // Explicit override wins; otherwise debug is off in production.
  return (
    parseLevel(process.env.LOG_LEVEL) ??
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  );
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel()];
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Logger with bound context merged into every call (e.g. { requestId }). */
  child(context: LogContext): Logger;
}

function emit(level: LogLevel, message: string, context: LogContext, bound: LogContext): void {
  if (!shouldLog(level)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(redactForLog({ ...bound, ...context }) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  // Errors and warnings go to stderr so platform log routers can split them.
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

function makeLogger(bound: LogContext = {}): Logger {
  return {
    debug: (message, context = {}) => emit('debug', message, context, bound),
    info: (message, context = {}) => emit('info', message, context, bound),
    warn: (message, context = {}) => emit('warn', message, context, bound),
    error: (message, context = {}) => emit('error', message, context, bound),
    child: (context) => makeLogger({ ...bound, ...context }),
  };
}

/** Shared structured logger. */
export const logger: Logger = makeLogger();
