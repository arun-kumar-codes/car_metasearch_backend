import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) { }

  async seed() {
    await this.prisma.listing.deleteMany();
    await this.prisma.agency.deleteMany();

    const agency1 = await this.prisma.agency.create({
      data: { name: 'AutoDealer India', integrationType: 'API', isActive: true },
    });

    const agency2 = await this.prisma.agency.create({
      data: { name: 'CarMarket Hub India', integrationType: 'API', isActive: true },
    });

    const agency3 = await this.prisma.agency.create({
      data: { name: 'Premium Motors India', integrationType: 'FEED', isActive: true },
    });

    const listings = [
      // 1–3 Maruti Swift
      { agencyId: agency1.id, brand: 'Maruti Suzuki', model: 'Swift', variant: 'VDI', year: 2020, mileage: 35000, price: 550000, currency: 'INR', color: 'Silver', fuelType: 'Diesel', transmission: 'Manual', bodyType: 'Hatchback', city: 'Mumbai', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/1' },
      { agencyId: agency2.id, brand: 'Maruti Suzuki', model: 'Swift', variant: 'ZXI', year: 2021, mileage: 25000, price: 680000, currency: 'INR', color: 'Black', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'Hatchback', city: 'Delhi', state: 'Delhi', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/2' },
      { agencyId: agency3.id, brand: 'Maruti Suzuki', model: 'Swift', variant: 'LXI', year: 2019, mileage: 48000, price: 480000, currency: 'INR', color: 'White', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'Hatchback', city: 'Bangalore', state: 'Karnataka', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/3' },

      // 4–6 Hyundai Creta
      { agencyId: agency1.id, brand: 'Hyundai', model: 'Creta', variant: 'SX', year: 2021, mileage: 28000, price: 1450000, currency: 'INR', color: 'Blue', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Mumbai', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/4' },
      { agencyId: agency2.id, brand: 'Hyundai', model: 'Creta', variant: 'EX', year: 2020, mileage: 42000, price: 1180000, currency: 'INR', color: 'Gray', fuelType: 'Diesel', transmission: 'Manual', bodyType: 'SUV', city: 'Indore', state: 'Madhya Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/5' },
      { agencyId: agency3.id, brand: 'Hyundai', model: 'Creta', variant: 'SX(O)', year: 2022, mileage: 14000, price: 1680000, currency: 'INR', color: 'Red', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Delhi', state: 'Delhi', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/6' },

      // 7–9 Honda City
      { agencyId: agency1.id, brand: 'Honda', model: 'City', variant: 'VX', year: 2021, mileage: 20000, price: 1250000, currency: 'INR', color: 'Black', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'Sedan', city: 'Hyderabad', state: 'Telangana', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/7' },
      { agencyId: agency2.id, brand: 'Honda', model: 'City', variant: 'SV', year: 2019, mileage: 50000, price: 950000, currency: 'INR', color: 'White', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'Sedan', city: 'Nagpur', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/8' },
      { agencyId: agency3.id, brand: 'Honda', model: 'City', variant: 'ZX', year: 2022, mileage: 12000, price: 1480000, currency: 'INR', color: 'Blue', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'Sedan', city: 'Pune', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/9' },

      // 10–12 Tata Nexon
      { agencyId: agency1.id, brand: 'Tata', model: 'Nexon', variant: 'XZ+', year: 2021, mileage: 26000, price: 1050000, currency: 'INR', color: 'Red', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'SUV', city: 'Ahmedabad', state: 'Gujarat', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/10' },
      { agencyId: agency2.id, brand: 'Tata', model: 'Nexon', variant: 'XM', year: 2020, mileage: 38000, price: 890000, currency: 'INR', color: 'Gray', fuelType: 'Diesel', transmission: 'Manual', bodyType: 'SUV', city: 'Surat', state: 'Gujarat', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/11' },
      { agencyId: agency3.id, brand: 'Tata', model: 'Nexon EV', variant: 'XZ+', year: 2022, mileage: 15000, price: 1680000, currency: 'INR', color: 'Blue', fuelType: 'Electric', transmission: 'Automatic', bodyType: 'SUV', city: 'Jaipur', state: 'Rajasthan', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/12' },

      // 13–15 Toyota Innova
      { agencyId: agency1.id, brand: 'Toyota', model: 'Innova Crysta', variant: 'GX', year: 2019, mileage: 60000, price: 1850000, currency: 'INR', color: 'White', fuelType: 'Diesel', transmission: 'Manual', bodyType: 'MPV', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/13' },
      { agencyId: agency2.id, brand: 'Toyota', model: 'Innova Crysta', variant: 'VX', year: 2021, mileage: 22000, price: 2250000, currency: 'INR', color: 'Silver', fuelType: 'Diesel', transmission: 'Automatic', bodyType: 'MPV', city: 'Mumbai', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/14' },
      { agencyId: agency3.id, brand: 'Toyota', model: 'Innova Crysta', variant: 'ZX', year: 2022, mileage: 12000, price: 2550000, currency: 'INR', color: 'Black', fuelType: 'Diesel', transmission: 'Automatic', bodyType: 'MPV', city: 'Delhi', state: 'Delhi', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/15' },

      // 16–18 Mahindra XUV
      { agencyId: agency1.id, brand: 'Mahindra', model: 'XUV500', variant: 'W10', year: 2020, mileage: 42000, price: 1680000, currency: 'INR', color: 'Gray', fuelType: 'Diesel', transmission: 'Manual', bodyType: 'SUV', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/16' },
      { agencyId: agency2.id, brand: 'Mahindra', model: 'XUV700', variant: 'AX7', year: 2022, mileage: 16000, price: 2350000, currency: 'INR', color: 'White', fuelType: 'Diesel', transmission: 'Automatic', bodyType: 'SUV', city: 'Noida', state: 'Uttar Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/17' },
      { agencyId: agency3.id, brand: 'Mahindra', model: 'XUV300', variant: 'W8', year: 2021, mileage: 30000, price: 980000, currency: 'INR', color: 'Red', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'SUV', city: 'Patna', state: 'Bihar', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/18' },

      // 19–21 Volkswagen / Skoda
      { agencyId: agency1.id, brand: 'Volkswagen', model: 'Polo', variant: 'GT', year: 2021, mileage: 21000, price: 890000, currency: 'INR', color: 'Blue', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'Hatchback', city: 'Mumbai', state: 'Maharashtra', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/19' },
      { agencyId: agency2.id, brand: 'Skoda', model: 'Rapid', variant: 'Style', year: 2020, mileage: 35000, price: 920000, currency: 'INR', color: 'White', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'Sedan', city: 'Chandigarh', state: 'Punjab', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/20' },
      { agencyId: agency3.id, brand: 'Skoda', model: 'Slavia', variant: 'Ambition', year: 2022, mileage: 14000, price: 1320000, currency: 'INR', color: 'Silver', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'Sedan', city: 'Udaipur', state: 'Rajasthan', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/21' },

      // 22–30 mixed
      { agencyId: agency1.id, brand: 'Ford', model: 'EcoSport', variant: 'Titanium', year: 2020, mileage: 47000, price: 950000, currency: 'INR', color: 'Gray', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Delhi', state: 'Delhi', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/22' },
      { agencyId: agency2.id, brand: 'Nissan', model: 'Magnite', variant: 'XV', year: 2021, mileage: 30000, price: 750000, currency: 'INR', color: 'White', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'SUV', city: 'Bangalore', state: 'Karnataka', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/23' },
      { agencyId: agency3.id, brand: 'Renault', model: 'Kiger', variant: 'RXZ', year: 2022, mileage: 18000, price: 820000, currency: 'INR', color: 'Red', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Raipur', state: 'Chhattisgarh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/24' },
      { agencyId: agency1.id, brand: 'Kia', model: 'Seltos', variant: 'HTX', year: 2021, mileage: 26000, price: 1550000, currency: 'INR', color: 'Black', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Kochi', state: 'Kerala', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/25' },
      { agencyId: agency2.id, brand: 'Kia', model: 'Sonet', variant: 'GTX+', year: 2022, mileage: 15000, price: 1250000, currency: 'INR', color: 'Blue', fuelType: 'Diesel', transmission: 'Automatic', bodyType: 'SUV', city: 'Trivandrum', state: 'Kerala', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/26' },
      { agencyId: agency3.id, brand: 'MG', model: 'Hector', variant: 'Sharp', year: 2021, mileage: 29000, price: 1750000, currency: 'INR', color: 'White', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'SUV', city: 'Gurgaon', state: 'Haryana', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/27' },
      { agencyId: agency1.id, brand: 'MG', model: 'ZS EV', variant: 'Exclusive', year: 2022, mileage: 12000, price: 2150000, currency: 'INR', color: 'Silver', fuelType: 'Electric', transmission: 'Automatic', bodyType: 'SUV', city: 'Noida', state: 'Uttar Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/28' },
      { agencyId: agency2.id, brand: 'Hyundai', model: 'i20', variant: 'Asta', year: 2021, mileage: 24000, price: 780000, currency: 'INR', color: 'Blue', fuelType: 'Petrol', transmission: 'Manual', bodyType: 'Hatchback', city: 'Amritsar', state: 'Punjab', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/29' },
      { agencyId: agency3.id, brand: 'Maruti Suzuki', model: 'Baleno', variant: 'Alpha', year: 2022, mileage: 17000, price: 880000, currency: 'INR', color: 'Red', fuelType: 'Petrol', transmission: 'Automatic', bodyType: 'Hatchback', city: 'Jabalpur', state: 'Madhya Pradesh', country: 'India', isAvailable: true, externalUrl: 'https://example.com/car/30' },
    ];

    for (const listing of listings) {
      await this.prisma.listing.create({ data: listing });
    }

    console.log(`✅ Seeded ${listings.length} car listings`);
    return { success: true, count: listings.length };
  }
}
