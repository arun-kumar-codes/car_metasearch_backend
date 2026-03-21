import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '../search/search.service';
import { SearchQueryDto } from '../search/dto/search-query.dto';
import { ListingResponseDto } from '../search/dto/listing-response.dto';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT_BASE = `You are Atlas, a friendly used-car search partner for this car search app in India. You ONLY help with:
- Finding or searching for used cars (by brand, model, budget, city, fuel type, etc.)
- Explaining search results, filters, or how to use the app
- Helping users narrow down or refine their car search

If the user asks about anything else (weather, general knowledge, other topics), reply in a friendly way: you're here to help with car search on this app, and suggest they try something like "Show me Swift under 5 lakh" or "Best diesel SUVs in Mumbai". Be warm and brief (1-2 sentences). Use markdown for emphasis (**bold**). Do not invent listing IDs, prices, or car counts.`;

const EXTRACTION_SYSTEM = `You extract search intent from the user's message for a used-car search in India. Return ONLY a valid JSON object, no other text. Use this exact shape:
{"city": "string or null", "brand": "string or null", "model": "string or null"}

Rules:
- city: Indian city name with correct spelling (e.g. Noida, Delhi, New Delhi, Mumbai, Bangalore, Pune, Gurgaon, Ghaziabad). Fix misspellings. If the user says "my area", "near me", "in my area", "around here", "my city", or "available cars" without naming a city, use null (the app will use their current location).
- If the user did not mention a city and did not say "my area" etc., use null.
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

    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-5-nano';
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
      effectiveCity?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      listingsCount: number;
      userSpecifiedCity: boolean;
    },
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return "Chat is not configured. Set OPENROUTER_API_KEY (or OPENAI_API_KEY) in the backend .env with your OpenRouter key.";
    }

    const { requestCity, effectiveCity, history, listingsCount, userSpecifiedCity } =
      context;
    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-5-nano';
    const historyMessages = (history || []).slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let systemPrompt = SYSTEM_PROMPT_BASE + '\n\n';
    const cityForReply = requestCity || effectiveCity;
    const hasLocation = !!cityForReply;
    if (userSpecifiedCity) {
      systemPrompt += `The user mentioned a city. You may reference it in your reply.`;
    } else if (hasLocation) {
      systemPrompt += `We are using the user's current location (${cityForReply}) for this search. Reply as a helpful partner: mention we're showing cars in ${cityForReply}. Do NOT ask them which city—we already have their location.`;
    } else {
      systemPrompt += `The user has NOT specified a city and we have no location. Ask them naturally: "In which city are you looking for cars?" or "Which city do you prefer?" Be conversational.`;
    }
    if (listingsCount === 0) {
      systemPrompt += `\n\nImportant: Our search found ZERO matching cars. Do NOT say you will show cars, have options, or list anything. Say honestly that we don't have any matching listings right now for ${requestCity || 'that area'}, and suggest they try a different city, different car, or use the search filters.`;
    } else {
      systemPrompt += `\n\nOur search found ${listingsCount} matching listing(s). Reply briefly and invite them to check the results below.`;
    }

    const currentUserContent = hasLocation
      ? `[Search location: ${cityForReply}.] User: ${message}`
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
    if (content) return content;

    // If the LLM fails (empty output), still be a good "partner" by summarizing the search truthfully.
    const fallbackCity = cityForReply;
    if (listingsCount === 0) {
      if (fallbackCity) {
        return `I couldn't find matching listings in **${fallbackCity}** right now. Try a different city, brand/model, or adjust your budget/filters.`;
      }
      return `I couldn't find matching listings right now. Tell me your **city** and what you're looking for (brand/model/budget), and I'll help you search.`;
    }
    if (fallbackCity) {
      return `I found **${listingsCount}** matching car(s) in **${fallbackCity}**—check the results below. Want to filter by **budget**, **brand**, or **fuel type**?`;
    }
    return `I found **${listingsCount}** matching car(s)—check the results below. Tell me your **city** if you want more accurate results.`;
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
      effectiveCity: searchCity,
      history,
      listingsCount: listings.length,
      userSpecifiedCity,
    });

    return { reply, listings };
  }
}
