import { Account, ID } from 'appwrite';
import type {
  AuthPort,
  AuthenticatedUser,
  SignInInput,
  SignUpInput,
  UpdateEmailInput,
  UpdatePasswordInput
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
      return this.rememberUser(user);
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

  async updateName(name: string): Promise<AuthenticatedUser> {
    const user = await this.account.updateName({ name: name.trim() });
    return this.rememberUser(user);
  }

  async updateEmail(input: UpdateEmailInput): Promise<AuthenticatedUser> {
    const user = await this.account.updateEmail({
      email: input.email.trim(),
      password: input.password
    });
    return this.rememberUser(user);
  }

  async updatePassword(input: UpdatePasswordInput): Promise<void> {
    await this.account.updatePassword({
      password: input.password,
      oldPassword: input.oldPassword
    });
    this.cachedUser = undefined;
  }

  async deleteSessions(): Promise<void> {
    await this.account.deleteSessions();
    this.cachedUser = null;
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

  private rememberUser(user: {
    $id: string;
    email: string;
    name: string;
    labels: string[];
  }): AuthenticatedUser {
    this.cachedUser = {
      id: asUserId(user.$id),
      email: user.email,
      name: user.name.trim().length === 0 ? null : user.name,
      labels: user.labels
    };
    return this.cachedUser;
  }

  private async requireUser(): Promise<AuthenticatedUser> {
    const user = await this.getCurrentUser();
    if (user === null) throw new Error('Authentication is required.');
    return user;
  }
}
