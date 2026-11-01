import { Account, ID } from 'appwrite';
import type {
  AuthPort,
  AuthenticatedUser,
  SignInInput,
  SignUpInput
} from '../../domain/ports/auth-port';
import { asUserId, type UserId } from '../../domain/models/identifiers';
import { isUnauthorizedError } from './errors';

export interface CurrentUserIdProvider {
  currentUserId(): Promise<UserId>;
}

export class AppwriteAuthAdapter implements AuthPort, CurrentUserIdProvider {
  private cachedUser: AuthenticatedUser | null | undefined;

  constructor(private readonly account: Account) {}

  async currentUserId(): Promise<UserId> {
    const user = await this.getCurrentUser();
    if (user === null) throw new Error('Authentication is required.');
    return user.id;
  }

  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    if (this.cachedUser !== undefined) return this.cachedUser;

    try {
      const user = await this.account.get();
      this.cachedUser = {
        id: asUserId(user.$id),
        email: user.email,
        name: user.name.trim().length === 0 ? null : user.name
      };
      return this.cachedUser;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        this.cachedUser = null;
        return null;
      }
      throw error;
    }
  }

  async signIn(input: SignInInput): Promise<AuthenticatedUser> {
    await this.account.createEmailPasswordSession({
      email: input.email,
      password: input.password
    });
    this.cachedUser = undefined;
    return this.requireUser();
  }

  async signUp(input: SignUpInput): Promise<AuthenticatedUser> {
    await this.account.create({
      userId: ID.unique(),
      email: input.email,
      password: input.password,
      name: input.name
    });
    return this.signIn(input);
  }

  async signOut(): Promise<void> {
    try {
      await this.account.deleteSession({ sessionId: 'current' });
    } catch (error) {
      if (!isUnauthorizedError(error)) throw error;
    } finally {
      this.cachedUser = null;
    }
  }

  private async requireUser(): Promise<AuthenticatedUser> {
    const user = await this.getCurrentUser();
    if (user === null) throw new Error('Authentication is required.');
    return user;
  }
}
