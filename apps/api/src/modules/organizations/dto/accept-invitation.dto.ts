import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({
    description: "Token brut reçu dans le lien d'invitation",
    example: '6f2a52c2...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;
}
