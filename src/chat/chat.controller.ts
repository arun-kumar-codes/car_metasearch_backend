import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  private static guestQuotaByIp = new Map<string, { count: number; windowStartMs: number }>();
  private static GUEST_MESSAGE_LIMIT = 5;
  private static GUEST_WINDOW_MS = 24 * 60 * 60 * 1000; 

  private static getClientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'];
    const forwarded = typeof xf === 'string' ? xf.split(',')[0]?.trim() : undefined;
    const ip = forwarded || req.ip || 'unknown';
    return ip;
  }

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    const isAuthed = typeof authHeader === 'string' && authHeader.trim().toLowerCase().startsWith('bearer ');

    if (!isAuthed) {
      const ip = ChatController.getClientIp(req);
      const now = Date.now();
      const existing = ChatController.guestQuotaByIp.get(ip);

      if (!existing || now - existing.windowStartMs > ChatController.GUEST_WINDOW_MS) {
        ChatController.guestQuotaByIp.set(ip, { count: 0, windowStartMs: now });
      }

      const current = ChatController.guestQuotaByIp.get(ip)!;
      if (current.count >= ChatController.GUEST_MESSAGE_LIMIT) {
        // 429 aligns with "rate limited / quota exceeded" semantics.
        throw new HttpException(
          'You’ve used your free chat messages. Log in to keep chatting.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      current.count += 1;
    }

    const { reply, listings, chatState } = await this.chatService.chat({
      message: dto.message,
      city: dto.city,
      listingIds: dto.listingIds,
      conversationId: dto.conversationId,
      history: dto.history,
      chatState: dto.chatState,
    });
    return { reply, listings, chatState };
  }
}
