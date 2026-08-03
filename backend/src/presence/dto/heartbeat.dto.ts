import { IsBoolean, IsOptional } from 'class-validator';

export class HeartbeatDto {
  // true while the client is inside an active match; absent/false = plain online.
  @IsOptional()
  @IsBoolean()
  playing?: boolean;
}
