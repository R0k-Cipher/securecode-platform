import {
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class GithubInstallationCallbackDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  installation_id!: string;
}
