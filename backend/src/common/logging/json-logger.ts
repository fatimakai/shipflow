import type { LoggerService } from '@nestjs/common';
import { redactLogValue } from './log-redaction';

type ApplicationLogLevel = 'debug' | 'info' | 'warn' | 'error';
type JsonLogLevel = ApplicationLogLevel | 'fatal';

const levelPriority: Record<JsonLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export class JsonLogger implements LoggerService {
  constructor(
    private readonly service: string,
    private readonly minimumLevel: ApplicationLogLevel,
  ) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  private write(
    level: JsonLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (levelPriority[level] < levelPriority[this.minimumLevel]) return;
    const context = this.extractContext(optionalParams);
    const details = optionalParams.slice(0, context ? -1 : undefined);
    const record: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      pid: process.pid,
      context,
    };
    if (this.isPlainObject(message)) {
      record.event = message.event ?? 'application.event';
      record.data = redactLogValue(message);
    } else {
      record.message = redactLogValue(message);
    }
    if (details.length > 0) record.details = redactLogValue(details);

    const output = `${JSON.stringify(record)}\n`;
    if (level === 'error' || level === 'fatal') process.stderr.write(output);
    else process.stdout.write(output);
  }

  private extractContext(optionalParams: unknown[]): string | undefined {
    const last = optionalParams.at(-1);
    return typeof last === 'string' && !last.includes('\n') ? last : undefined;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Error)
    );
  }
}
