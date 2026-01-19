import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/listing-response.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchService.search(query);
  }

  @Get('brands')
  async getBrands(): Promise<string[]> {
    return this.searchService.getBrands();
  }

  @Get('models')
  async getModels(@Query('brand') brand?: string): Promise<string[]> {
    return this.searchService.getModels(brand);
  }
}
