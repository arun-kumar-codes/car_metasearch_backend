export class ListingResponseDto {
  id: string;
  brand: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
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
  agency: {
    id: string;
    name: string;
  };
}

export class SearchResponseDto {
  listings: ListingResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
