import { Injectable } from '@nestjs/common';
import { RawAgencyListing } from '../interfaces/agency-adapter.interface';
import { ListingResponseDto } from '../../search/dto/listing-response.dto';

@Injectable()
export class NormalizationService {
  normalize(rawListing: RawAgencyListing): ListingResponseDto {
    return {
      id: rawListing.id,
      brand: rawListing.brand || rawListing.make || 'Unknown',
      model: rawListing.model,
      variant: rawListing.variant || rawListing.trim,
      year: rawListing.year,
      mileage: rawListing.mileage || rawListing.odometer || 0,
      price: rawListing.price,
      currency: rawListing.currency,
      color: rawListing.color,
      fuelType: rawListing.fuelType,
      transmission: rawListing.transmission,
      bodyType: rawListing.bodyType,
      city: rawListing.city,
      state: rawListing.state,
      country: rawListing.country,
      isAvailable: rawListing.isAvailable,
      externalUrl: rawListing.externalUrl,
      ownership: rawListing.ownership,
      agency: {
        id: rawListing.agencyId,
        name: '',
      },
    };
  }

  normalizeMany(rawListings: RawAgencyListing[], agencyName: string): ListingResponseDto[] {
    return rawListings.map((listing) => {
      const normalized = this.normalize(listing);
      normalized.agency.name = agencyName;
      return normalized;
    });
  }
}
