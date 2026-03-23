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
{"city": null, "brand": "string or null", "model": "string or null"}

Rules:
- city must ALWAYS be null (city resolution is handled by the backend resolver, not the LLM)
- brand: Car manufacturer (e.g. Hyundai, Maruti, Tata, Honda, Toyota, Mahindra). Fix misspellings.
- model: Car model name (e.g. Creta, Swift, Baleno, Nexon). Fix misspellings like creata/creta->Creta, swift->Swift.
- If the user did not mention a brand or model, set that key to null.
- Consider the full conversation when extracting brand/model (e.g. if the user earlier said "in Noida" and now says "show me Creta", extract model Creta).`;

export interface SearchHints {
  brand?: string;
  model?: string;
}

type ChatCitySource = 'currentMessage' | 'chatMemory' | 'requestCity' | 'resetToRequest' | 'none';

export interface ChatState {
  /**
   * The last city explicitly mentioned in chat (or reset to website location),
   * persisted and sent back by the frontend.
   */
  lastCityMemory?: string;
  /**
   * City used for this request.
   */
  resolvedCity?: string;
  citySource?: ChatCitySource;
  stage?: 'search' | 'advisory';
}

@Injectable()
export class ChatService {
  constructor(
    private config: ConfigService,
    private searchService: SearchService,
  ) {}

  private static knownCitiesCache: { cities: string[]; fetchedAtMs: number } | null = null;
  private static knownCitiesTtlMs = 6 * 60 * 60 * 1000; // 6 hours

  private async getKnownCities(): Promise<string[]> {
    const now = Date.now();
    if (
      ChatService.knownCitiesCache &&
      now - ChatService.knownCitiesCache.fetchedAtMs < ChatService.knownCitiesTtlMs
    ) {
      return ChatService.knownCitiesCache.cities;
    }
    const cities = await this.searchService.getCities();
    ChatService.knownCitiesCache = { cities, fetchedAtMs: now };
    return cities;
  }

  private normalizeCity(s: string): string {
    return String(s).toLowerCase().replace(/\s+/g, " ").trim();
  }

  private async parseCityDeterministically(message: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string | undefined> {
    const cities = await this.getKnownCities().catch(() => []);

    const currentText = String(message).toLowerCase();

    // Handle common alias forms explicitly, but PRIORITIZE current message.
    // This ensures "whatever city we select should not matter when mentioning another city in chat".
    if (/\bnew delhi\b|\bdelhi\b/.test(currentText)) return "Delhi";
    if (/\bgurugram\b|\bgurgaon\b/.test(currentText)) return "Gurgaon";
    if (/\bbengaluru\b|\bbangalore\b/.test(currentText)) return "Bangalore";
    if (/\bmumbai\b|\bbombay\b/.test(currentText)) return "Mumbai";

    const userMsgs = (history || [])
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .slice(-6);

    // Only fall back to history if current message didn't mention a city.
    const text = [userMsgs.join(" "), message].join(" ").toLowerCase();

    // Basic substring match against known cities.
    // Helps when LLM extraction fails or when user types "in Pune".
    // Prefer matches from the current message; only fall back to history if nothing is found.
    for (const c of cities) {
      const nc = this.normalizeCity(c);
      if (!nc) continue;
      if (currentText.includes(nc)) return c;
    }

    // Fallback: allow history to contribute only when the current message is ambiguous.
    for (const c of cities) {
      const nc = this.normalizeCity(c);
      if (!nc) continue;
      if (text.includes(nc)) return c;
    }

    return undefined;
  }

  /**
   * Extract the last mentioned city from ONLY the current user message.
   * Uses known city list + alias groups to avoid "nearby NCR" bias.
   */
  private async extractLastCityMentionFromMessage(message: string): Promise<string | undefined> {
    const cities = await this.getKnownCities().catch(() => []);
    if (!message) return undefined;

    const msgNormalized = this.normalizeCity(message);

    // Alias groups map common user spellings to canonical cities present in the DB.
    const aliasGroups: Array<{ variants: string[] }> = [
      { variants: ['new delhi', 'delhi'] },
      { variants: ['gurugram', 'gurgaon'] },
      { variants: ['bengaluru', 'bangalore'] },
      { variants: ['mumbai', 'bombay'] },
    ];

    const candidates: Array<{ city: string; index: number }> = [];

    // 1) Direct city substring matches against known city names.
    for (const c of cities) {
      const nc = this.normalizeCity(c);
      if (!nc) continue;
      const idx = msgNormalized.lastIndexOf(nc);
      if (idx >= 0) candidates.push({ city: c, index: idx });
    }

    // 2) Alias variant matches -> map to the best canonical city from known cities.
    for (const group of aliasGroups) {
      const normalizedVariants = group.variants.map((v) => this.normalizeCity(v));

      const bestCanonical = (() => {
        const matches: string[] = [];
        for (const c of cities) {
          const nc = this.normalizeCity(c);
          if (!nc) continue;
          if (normalizedVariants.some((v) => v && nc.includes(v))) matches.push(c);
        }
        if (matches.length === 0) return undefined;
        matches.sort((a, b) => this.normalizeCity(b).length - this.normalizeCity(a).length);
        return matches[0];
      })();

      if (!bestCanonical) continue;

      for (const v of normalizedVariants) {
        if (!v) continue;
        const idx = msgNormalized.lastIndexOf(v);
        if (idx >= 0) candidates.push({ city: bestCanonical, index: idx });
      }
    }

    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => (b.index - a.index) || (this.normalizeCity(b.city).length - this.normalizeCity(a.city).length));
    return candidates[0]?.city;
  }

  /**
   * Conversation-level city resolver (strict precedence):
   * 1) city in current user message
   * 2) chatState.lastCityMemory
   * 3) requestCity only when no chat memory exists
   * 4) if still missing, return undefined (caller should ask user)
   */
  private async resolveChatCity(params: {
    message: string;
    requestCity?: string;
    chatState?: ChatState;
  }): Promise<{ resolvedCity?: string; lastCityMemory?: string; userMentionedCity: boolean; citySource: ChatCitySource }> {
    const { message, requestCity, chatState } = params;
    const messageLower = String(message || '').toLowerCase();

    const resetRequested =
      /\buse my location\b|\buse my city\b|\buse website city\b|\bnear me\b|\bmy area\b|\baround here\b/.test(messageLower);

    const mentionedCity = await this.extractLastCityMentionFromMessage(message).catch(() => undefined);

    // 1) City explicitly mentioned in current user message.
    if (mentionedCity) {
      return {
        resolvedCity: mentionedCity,
        lastCityMemory: mentionedCity,
        userMentionedCity: true,
        citySource: 'currentMessage',
      };
    }

    // 2) Reset command to website/current location.
    if (resetRequested && requestCity) {
      return {
        resolvedCity: requestCity,
        lastCityMemory: requestCity,
        userMentionedCity: false,
        citySource: 'resetToRequest',
      };
    }

    // 3) Conversation memory.
    if (chatState?.lastCityMemory) {
      return {
        resolvedCity: chatState.lastCityMemory,
        lastCityMemory: chatState.lastCityMemory,
        userMentionedCity: false,
        citySource: 'chatMemory',
      };
    }

    // 4) Website / location fallback only when no memory exists.
    if (requestCity) {
      return {
        resolvedCity: requestCity,
        lastCityMemory: chatState?.lastCityMemory,
        userMentionedCity: false,
        citySource: 'requestCity',
      };
    }

    return {
      resolvedCity: undefined,
      lastCityMemory: chatState?.lastCityMemory,
      userMentionedCity: false,
      citySource: 'none',
    };
  }

  /**
   * Use the LLM to extract city, brand, model from the user message. Handles misspellings
   * and conversational context (e.g. "show me creta" after "in noida").
   */
  private async extractSearchHints(
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<SearchHints> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {};
    }

    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-5-nano';
    // Avoid bias from assistant messages (like welcome examples) when extracting city.
    const historyContext = (history || [])
      .filter((m) => m.role === 'user')
      .slice(-4)
      .map((m) => `user: ${m.content}`)
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
      const parsed = JSON.parse(raw) as { brand?: string | null; model?: string | null };
      const str = (v: string | null | undefined) => (v && String(v).trim()) || undefined;

      return {
        brand: str(parsed.brand),
        model: str(parsed.model),
      };
    } catch {
      // If extraction fails entirely, fall back to no brand/model hints.
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
      userMentionedCity: boolean;
      citySource: ChatCitySource;
      stage: 'search' | 'advisory';
      needsClarification: boolean;
    },
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return "Chat is not configured. Set OPENROUTER_API_KEY (or OPENAI_API_KEY) in the backend .env with your OpenRouter key.";
    }

    const {
      requestCity,
      effectiveCity,
      history,
      listingsCount,
      userMentionedCity,
      citySource,
      stage,
      needsClarification,
    } = context;
    const model = this.config.get<string>('OPENROUTER_MODEL') || 'openai/gpt-5-nano';
    const historyMessages = (history || []).slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let systemPrompt = SYSTEM_PROMPT_BASE + '\n\n';
    const cityForReply = effectiveCity || requestCity;
    const hasLocation = !!cityForReply;

    if (userMentionedCity && cityForReply) {
      systemPrompt += `The user explicitly mentioned a city (${cityForReply}). You may reference it in your reply.`;
    } else if (hasLocation) {
      if (citySource === 'chatMemory') {
        systemPrompt += `No city was provided in the latest message, so we are using your last mentioned city (${cityForReply}) from earlier chat.`;
      } else if (citySource === 'resetToRequest') {
        systemPrompt += `You asked to use your website/current location, so we are using (${cityForReply}).`;
      } else {
        systemPrompt += `We are using the user's current location/website city (${cityForReply}). Do NOT ask them which city—we already have it.`;
      }
    } else {
      systemPrompt += `We do not have a city for this chat yet. Ask naturally: "Which city are you looking for cars in?"`;
    }

    if (stage === 'advisory') {
      systemPrompt += `\n\nAdvisory style: reply as a person-like assistant. Start with a concise line that confirms the intent and the city. If needsClarification is true, ask 1-2 targeted follow-up questions before going deeper. Keep it brief (no long essays).`;
    } else {
      systemPrompt += `\n\nSearch style: be concise, then invite the user to check matching results.`;
    }
    if (listingsCount === 0) {
      systemPrompt += `\n\nImportant: Our search found ZERO matching cars. Do NOT say you will show cars, have options, or list anything. Say honestly that we don't have any matching listings right now for ${cityForReply || 'that area'}, and suggest they try a different city, different car, or use the search filters.`;
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
    conversationId?: string;
    listingIds?: string[];
    chatState?: ChatState;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ reply: string; listings: ListingResponseDto[]; chatState?: ChatState }> {
    const { message, city: requestCity, listingIds, history, chatState } = params;

    const cityResolution = await this.resolveChatCity({
      message,
      requestCity,
      chatState,
    });
    const searchCity = cityResolution.resolvedCity;

    if (process.env.NODE_ENV !== 'production') {
      // Helpful for verifying precedence decisions during development.
      console.debug('[chat][cityResolver]', {
        source: cityResolution.citySource,
        resolvedCity: searchCity,
        userMentionedCity: cityResolution.userMentionedCity,
        hasChatMemory: Boolean(chatState?.lastCityMemory),
      });
    }

    const messageLower = String(message || '').toLowerCase();
    const isRecommendationRequest =
      /\b(best|recommend|suggest|choose|which one|compare|help me choose|i should)\b/.test(messageLower);

    const hasBudget =
      /\b(under|below|upto|within|less than)\s*₹?\s*\d+([.,]\d+)?\s*(lakh|lakhs|L)?\b/.test(messageLower) ||
      /\b₹\s*\d+([.,]\d+)?\b/.test(messageLower);
    const hasFuel = /\b(petrol|diesel|cng|hybrid|ev|electric)\b/.test(messageLower);
    const hasBody = /\b(suv|hatchback|sedan|mpv|crossover|wagon|crossover|compact)\b/.test(messageLower);

    const needsClarification = isRecommendationRequest ? !(hasBudget && hasFuel && hasBody) : false;
    const stage: 'search' | 'advisory' = isRecommendationRequest ? 'advisory' : 'search';

    const hints = await this.extractSearchHints(message, history);

    let listings: ListingResponseDto[] = [];
    if (listingIds?.length) {
      listings = await this.searchService.getByIds(listingIds);
    }
    if (listings.length === 0 && searchCity) {
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
      requestCity,
      effectiveCity: searchCity,
      history,
      listingsCount: listings.length,
      userMentionedCity: cityResolution.userMentionedCity,
      citySource: cityResolution.citySource,
      stage,
      needsClarification,
    });

    const nextChatState: ChatState = {
      ...chatState,
      lastCityMemory: cityResolution.lastCityMemory,
      resolvedCity: searchCity,
      citySource: cityResolution.citySource,
      stage,
    };

    return { reply, listings, chatState: nextChatState };
  }
}
