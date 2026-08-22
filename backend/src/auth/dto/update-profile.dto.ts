import { IsString, IsEmail, IsBoolean, IsOptional, Matches } from 'class-validator';

/**
 * Complete profile-update DTO — every field is optional, only provided fields
 * are changed. Mirrors the register-time validation rules:
 *  - username: 3-20 chars, letters/numbers/underscore only
 *  - email: must be a valid email (normalized to lowercase on write)
 *  - twoFactorEnabled: true = email-code 2FA required at login (add method),
 *    false = not required (remove method)
 *  - oauthToAdd / oauthToRemove: one of `google | github | 42`
 *  - currentPassword + newPassword: both required together to change password
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username must be 3-20 characters: letters, numbers, underscore only',
  })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsString()
  oauthToAdd?: string;

  @IsOptional()
  @IsString()
  oauthToRemove?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;
}