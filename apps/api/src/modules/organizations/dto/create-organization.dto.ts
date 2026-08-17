import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({
    description: "Nom de l'organisation",
    example: 'OPTIZAWORKS',
    minLength: 2,
    maxLength: 150,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    description:
      "Identifiant lisible utilisé dans les URLs. S'il n'est pas fourni, il sera généré automatiquement depuis le nom.",
    example: 'optizaworks',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Le slug doit contenir uniquement des lettres minuscules, des chiffres et des tirets',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: "Description de l'organisation",
    example:
      'Entreprise spécialisée dans le développement de solutions numériques.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: "URL du logo de l'organisation",
    example: 'https://example.com/logos/optizaworks.png',
  })
  @IsOptional()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    {
      message: 'logoUrl doit être une URL HTTP ou HTTPS valide',
    },
  )
  logoUrl?: string;
}
