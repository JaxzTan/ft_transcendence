import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { PASSWORD_MIN, PASSWORD_MAX, PASSWORD_REGEX, PASSWORD_MESSAGE } from './password.rules';

/**
 * Logged-in password change. `currentPassword` is REQUIRED for accounts that
 * already have a password, but OAuth-only accounts (no password_hash) can leave
 * it empty — there is no existing password to prove, they are setting their
 * first one. The service enforces this per-account.
 */
export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}