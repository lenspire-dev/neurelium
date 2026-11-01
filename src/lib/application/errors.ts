export type ApplicationErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT';

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
