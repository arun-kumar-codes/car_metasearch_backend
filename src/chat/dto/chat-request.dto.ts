import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatStateDto {
  /**
   * Last city explicitly mentioned in chat, persisted by the frontend.
   * Backend uses it as the conversation-level city memory.
   */
  @IsString()
  @IsOptional()
  lastCityMemory?: string;
}

export class ChatRequestDto {
  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsArray()
  @IsOptional()
  listingIds?: string[];

  @IsString()
  @IsOptional()
  conversationId?: string;

  @ValidateNested()
  @Type(() => ChatStateDto)
  @IsOptional()
  chatState?: ChatStateDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];
}
