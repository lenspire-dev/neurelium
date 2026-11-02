import type { UserId } from '../models/identifiers';

export interface AuthenticatedUser {
  readonly id: UserId;
  readonly email: string;
  readonly name: string | null;
}

export interface SignInInput {
  readonly email: string;
  readonly password: string;
}

export interface SignUpInput extends SignInInput {
  readonly name: string;
}

export interface UpdateEmailInput {
  readonly email: string;
  readonly password: string;
}

export interface UpdatePasswordInput {
  readonly password: string;
  readonly oldPassword: string;
}

export interface AuthPort {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  signIn(input: SignInInput): Promise<AuthenticatedUser>;
  signUp(input: SignUpInput): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
  updateName(name: string): Promise<AuthenticatedUser>;
  updateEmail(input: UpdateEmailInput): Promise<AuthenticatedUser>;
  updatePassword(input: UpdatePasswordInput): Promise<void>;
  deleteSessions(): Promise<void>;
}
