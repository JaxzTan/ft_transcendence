import { IsString, MinLength, MaxLength, IsOptional, IsEmail, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username must be 3-20 characters: letters, numbers, underscore only',
  })
  username: string;

  // Required: signup verification and login 2FA codes are both delivered here.
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72) // bcrypt ignores bytes past 72, so cap here
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'password must be 12+ characters with an uppercase letter, a lowercase letter, a number, and a special character',
  })
  password: string;
}
