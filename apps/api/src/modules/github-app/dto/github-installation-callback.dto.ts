import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class GithubInstallationCallbackDto {
  @ApiProperty({
    description: "Identifiant de l'installation GitHub App",
    example: '12345678',
  })
  @IsString()
  @MinLength(1)
  installation_id!: string;

  @ApiPropertyOptional({
    description: "Action effectuée sur l'installation",
    enum: ['install', 'update'],
    example: 'install',
  })
  @IsOptional()
  @IsIn(['install', 'update'])
  setup_action?: 'install' | 'update';

  @ApiProperty({
    description:
      "État sécurisé généré avant la redirection vers GitHub",
  })
  @IsString()
  @MinLength(20)
  state!: string;
}
