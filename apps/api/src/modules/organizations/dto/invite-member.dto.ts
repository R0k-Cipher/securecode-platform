import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
  Type,
} from 'class-transformer';

import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ORGANIZATION_INVITATION_ROLES = [
  'MEMBER',
  'ADMIN',
] as const;

export const PROJECT_INVITATION_ROLES = [
  'PROJECT_ADMIN',
  'MANAGER',
  'SECURITY_ANALYST',
  'DEVELOPER',
  'AUDITOR',
  'VIEWER',
] as const;

export type OrganizationInvitationRoleCode =
  typeof ORGANIZATION_INVITATION_ROLES[number];

export type ProjectInvitationRoleCode =
  typeof PROJECT_INVITATION_ROLES[number];

export class InviteMemberProjectDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Projet auquel donner accès à l’utilisateur invité.',
  })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    enum: PROJECT_INVITATION_ROLES,
    example: 'DEVELOPER',
  })
  @IsString()
  @IsIn(PROJECT_INVITATION_ROLES)
  roleCode!: ProjectInvitationRoleCode;
}

export class InviteMemberDto {
  @ApiProperty({
    example: 'rkia@example.com',
    description:
      'Adresse email réelle du compte global de la personne invitée.',
  })
  @Transform(({ value }) =>
    String(value)
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({
    example: 'Rkia',
    description:
      'Prénom requis uniquement si cette adresse email ne possède pas encore de compte global.',
  })
  @Transform(({ value }) =>
    value === undefined ||
    value === null
      ? value
      : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Ait Abdelkarim',
    description:
      'Nom requis uniquement si cette adresse email ne possède pas encore de compte global.',
  })
  @Transform(({ value }) =>
    value === undefined ||
    value === null
      ? value
      : String(value).trim(),
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  /*
   * Compatibilité frontend historique.
   * Le backend privilégie organizationRoleCode.
   */
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Compatibilité legacy : identifiant du rôle organisation.',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({
    enum: ORGANIZATION_INVITATION_ROLES,
    example: 'MEMBER',
  })
  @IsOptional()
  @IsString()
  @IsIn(ORGANIZATION_INVITATION_ROLES)
  organizationRoleCode?:
    OrganizationInvitationRoleCode;

  @ApiPropertyOptional({
    type: [
      InviteMemberProjectDto,
    ],
    description:
      'Projets auxquels l’utilisateur doit avoir accès après activation.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({
    each: true,
  })
  @Type(
    () =>
      InviteMemberProjectDto,
  )
  projects:
    InviteMemberProjectDto[] =
      [];
}
