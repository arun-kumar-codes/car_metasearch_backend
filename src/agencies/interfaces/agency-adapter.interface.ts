import { SearchQueryDto } from '../../search/dto/search-query.dto';

export interface RawAgencyListing {
  id: string;
  agencyId: string;
  brand?: string;
  make?: string;
  model: string;
  variant?: string;
  trim?: string;
  year: number;
  mileage?: number;
  odometer?: number;
  price: number;
  currency: string;
  color?: string;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  city?: string;
  state?: string;
  country?: string;
  isAvailable: boolean;
  externalUrl?: string;
  [key: string]: any;
}

export interface AgencySearchResult {
  agencyId: string;
  agencyName: string;
  listings: RawAgencyListing[];
  success: boolean;
  error?: string;
  responseTime?: number;
}

export interface IAgencyAdapter {
  search(query: SearchQueryDto): Promise<AgencySearchResult>;
}
