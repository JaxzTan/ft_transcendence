import { IsString, Matches } from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username must be 3-20 characters: letters, numbers, underscore only',
  })
  username: string;
}
