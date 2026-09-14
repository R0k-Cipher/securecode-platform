import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId!: string;
}