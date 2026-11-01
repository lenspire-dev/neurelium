import { ID } from 'appwrite';
import type { ClockPort } from '../../domain/ports/clock-port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator-port';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export class AppwriteIdGenerator implements IdGeneratorPort {
  next(): string {
    return ID.unique();
  }
}
