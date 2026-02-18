type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) =>
    emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) =>
    emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) =>
    emit('error', event, data),
};
