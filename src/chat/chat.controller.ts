import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto) {
    const { reply, listings } = await this.chatService.chat({
      message: dto.message,
      city: dto.city,
      listingIds: dto.listingIds,
      history: dto.history,
    });
    return { reply, listings };
  }
}
