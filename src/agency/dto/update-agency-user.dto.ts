import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateAgencyUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['DEALER_ADMIN', 'DEALER_USER'])
  role?: 'DEALER_ADMIN' | 'DEALER_USER';
}
