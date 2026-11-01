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

export interface AuthPort {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  signIn(input: SignInInput): Promise<AuthenticatedUser>;
  signUp(input: SignUpInput): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
}
