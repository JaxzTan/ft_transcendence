import { IsString, IsEmail, IsBoolean, IsOptional, Length, Matches } from 'class-validator';

/**
 * Complete profile-update DTO — every field is optional, only provided fields
 * are changed. Mirrors the register-time validation rules:
 *  - displayName: 1-30 chars, letters/numbers/spaces and _ - ' only. The
 *    username itself is auto-generated and immutable — it is NOT editable.
 *  - email: must be a valid email (normalized to lowercase on write)
 *  - twoFactorEnabled: true = email-code 2FA required at login (add method),
 *    false = not required (remove method)
 *  - oauthToAdd / oauthToRemove: one of `google | github | 42`
 *  - currentPassword + newPassword: both required together to change password
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 30, {
    message: 'display name must be 1-30 characters',
  })
  @Matches(/^[a-zA-Z0-9 _'-]+$/, {
    message: 'display name can only contain letters, numbers, spaces, underscores, apostrophes and hyphens',
  })
  displayName?: string;

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