import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token reçu lors de la connexion.' })
  @IsJWT()
  refreshToken!: string;
}
