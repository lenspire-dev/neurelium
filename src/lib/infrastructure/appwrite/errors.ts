import { AppwriteException } from 'appwrite';

export function isAppwriteException(error: unknown): error is AppwriteException {
  return error instanceof AppwriteException;
}

export function isNotFoundError(error: unknown): boolean {
  return isAppwriteException(error) && error.code === 404;
}

export function isUnauthorizedError(error: unknown): boolean {
  return isAppwriteException(error) && error.code === 401;
}
