import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { ListQueryDto } from './dto/list-query.dto';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('listings')
  async getByIds(@Query('ids') idsParam: string) {
    const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const listings = await this.searchService.getByIds(ids);
    return { listings };
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

  @Get('brands')
  async getBrands(@Query() dto: ListQueryDto) {
    return this.searchService.getBrands(dto.city, dto.state);
  }

  @Get('models')
  async getModels(@Query() dto: ListQueryDto) {
    return this.searchService.getModels(dto.brand, dto.city, dto.state);
  }

  @Get('cities')
  async getCities(@Query() dto: ListQueryDto) {
    return this.searchService.getCities(dto.state);
  }

  @Get('states')
  async getStates() {
    return this.searchService.getStates();
  }

  @Get('body-types')
  async getBodyTypes(@Query() dto: ListQueryDto) {
    return this.searchService.getBodyTypes(dto.city, dto.state);
  }
}
