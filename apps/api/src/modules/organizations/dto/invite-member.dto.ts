import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsUUID,
} from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'uuid-role',
  })
  @IsUUID()
  roleId!: string;
}