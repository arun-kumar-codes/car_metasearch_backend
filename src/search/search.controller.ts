import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('listings/:id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.searchService.getById(id);
    if (!listing) return { listing: null };
    return { listing };
  }

  @Get('brands/autocomplete')
  async autocompleteBrands(@Query() dto: AutocompleteQueryDto) {
    const brands = await this.searchService.autocompleteBrands(dto.city, dto.q);
    return { brands };
  }

  @Get('models/autocomplete')
  async autocompleteModels(@Query() dto: AutocompleteQueryDto) {
    const models = await this.searchService.autocompleteModels(dto.city, dto.q, dto.brand);
    return { models };
  }
}
