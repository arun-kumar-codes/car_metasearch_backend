import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '../search/search.service';
import { SearchQueryDto } from '../search/dto/search-query.dto';
import { ListingResponseDto } from '../search/dto/listing-response.dto';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT_BASE = `You are Atlas, a friendly used-car search assistant in India. Talk like a helpful person, not a bot. Reply in 1-3 short sentences. Use markdown for emphasis (**bold**). Do not invent listing IDs, prices, or car counts.`;

const EXTRACTION_SYSTEM = `You extract search intent from the user's message for a used-car search in India. Return ONLY a valid JSON object, no other text. Use this exact shape:
{"city": "string or null", "brand": "string or null", "model": "string or null"}

Rules:
- city: Indian city name with correct spelling (e.g. Noida, Delhi, New Delhi, Mumbai, Bangalore, Pune, Gurgaon, Ghaziabad). Fix misspellings (e.g. noidaa->Noida, delhii->Delhi, mumbi->Mumbai, creata in noida -> city Noida). If the user did not mention a city, use null.
- brand: Car manufacturer (e.g. Hyundai, Maruti, Tata, Honda, Toyota, Mahindra). Fix misspellings.
- model: Car model name (e.g. Creta, Swift, Baleno, Nexon). Fix misspellings like creata/creta->Creta, swift->Swift.
- If the user did not mention a city, brand, or model, set that key to null.
- Consider the full conversation: if the user said "in noida" in a previous message and now says "show me creta", extract city Noida and model Creta.`;

export interface SearchHints {
  city?: string;
  brand?: string;
  model?: string;
}

@Injectable()
export class ChatService {
  constructor(
    private config: ConfigService,
    private searchService: SearchService,
  ) {}

  /**
   * Use the LLM to extract city, brand, model from the user message. Handles misspellings
   * and conversational context (e.g. "show me creta" after "in noida").
   */
  private async extractSearchHints(
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<SearchHints> {
    const apiKey = this.getApiKey();
    if (!apiKey) return {};

    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-3.5-turbo';
    const historyContext = (history || [])
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    const userContent = historyContext
      ? `Conversation so far:\n${historyContext}\n\nLatest user message: ${message}\n\nReturn JSON only.`
      : `User message: ${message}\n\nReturn JSON only.`;

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: userContent },
      ],
      max_tokens: 150,
    };
    if (this.config.get<string>('OPENROUTER_JSON_MODE') === 'true') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return {};
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      let raw = data?.choices?.[0]?.message?.content?.trim() || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { city?: string | null; brand?: string | null; model?: string | null };
      const str = (v: string | null | undefined) => (v && String(v).trim()) || undefined;
      return {
        city: str(parsed.city),
        brand: str(parsed.brand),
        model: str(parsed.model),
      };
    } catch {
      return {};
    }
  }

  private getApiKey(): string | undefined {
    return (
      this.config.get<string>('OPENROUTER_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY')
    );
  }

  async getReply(
    message: string,
    context: {
      requestCity?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      listingsCount: number;
      userSpecifiedCity: boolean;
    },
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return "Chat is not configured. Set OPENROUTER_API_KEY (or OPENAI_API_KEY) in the backend .env with your OpenRouter key.";
    }

    const { requestCity, history, listingsCount, userSpecifiedCity } = context;
    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-3.5-turbo';
    const historyMessages = (history || []).slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let systemPrompt = SYSTEM_PROMPT_BASE + '\n\n';
    if (!userSpecifiedCity) {
      systemPrompt += `The user has NOT specified a city. Do NOT assume or use any default city (e.g. do not use their location). Ask them naturally: "In which city are you looking for cars?" or "Which city or area do you prefer?" Be conversational.`;
    } else {
      systemPrompt += `The user has specified a city. You may reference it in your reply.`;
    }
    if (listingsCount === 0) {
      systemPrompt += `\n\nImportant: Our search found ZERO matching cars. Do NOT say you will show cars, have options, or list anything. Say honestly that we don't have any matching listings right now, and suggest they try a different city, different car, or use the search filters.`;
    } else {
      systemPrompt += `\n\nOur search found ${listingsCount} matching listing(s). You can say we have some options to show.`;
    }

    const currentUserContent = requestCity && userSpecifiedCity
      ? `[User's location context: ${requestCity}.] User: ${message}`
      : message;
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: currentUserContent },
    ];

    const body = {
      model,
      messages,
      max_tokens: 400,
    };

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('OpenRouter error', res.status, text);
      if (res.status === 401) {
        return "Chat is not configured or the API key is invalid. Check OPENROUTER_API_KEY in the backend. Meanwhile, check the car suggestions below.";
      }
      if (res.status === 429) {
        return "Too many requests to the assistant right now. Please try again in a moment, or use the search filters and suggestions below.";
      }
      return "Sorry, I couldn't process that. Please try again or use the search filters below.";
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      console.error('OpenRouter invalid JSON');
      return "Sorry, I couldn't process that. Please try again or use the search filters below.";
    }
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || "I'm not sure how to help with that. Try asking for a car by brand, budget, or city, or use the search form below.";
  }

  async chat(params: {
    message: string;
    city?: string;
    listingIds?: string[];
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ reply: string; listings: ListingResponseDto[] }> {
    const { message, city, listingIds, history } = params;
    const hints = await this.extractSearchHints(message, history);
    const userSpecifiedCity = !!hints.city;
    const searchCity = hints.city || city || 'Delhi';

    let listings: ListingResponseDto[] = [];
    if (listingIds?.length) {
      listings = await this.searchService.getByIds(listingIds);
    }
    if (listings.length === 0) {
      const query: SearchQueryDto = {
        city: searchCity,
        page: 1,
        limit: 10,
        sortBy: 'price_asc',
      };
      if (hints.brand) query.brand = hints.brand;
      if (hints.model) query.model = hints.model;
      const result = await this.searchService.search(query);
      listings = result.listings || [];
    }

    const reply = await this.getReply(message, {
      requestCity: city,
      history,
      listingsCount: listings.length,
      userSpecifiedCity,
    });

    return { reply, listings };
  }
}
