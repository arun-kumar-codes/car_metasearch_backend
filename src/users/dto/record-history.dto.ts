import { IsString, IsUUID } from 'class-validator';

export class RecordHistoryDto {
  @IsString()
  @IsUUID()
  listingId: string;
}
