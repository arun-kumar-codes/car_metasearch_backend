import { Injectable } from '@nestjs/common';

@Injectable()
export class FieldMapperService {
  extractString(item: any, ...fieldNames: string[]): string | undefined {
    for (const field of fieldNames) {
      const value = this.getNestedValue(item, field);
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value);
        if (typeof value === 'boolean') return String(value);
      }
    }
    return undefined;
  }

  extractNumber(item: any, ...fieldNames: string[]): number {
    for (const field of fieldNames) {
      const value = this.getNestedValue(item, field);
      if (value !== null && value !== undefined) {
        if (typeof value === 'number') return Math.floor(value);
        if (typeof value === 'string') {
          const cleaned = value.replace(/[^\d.]/g, '');
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) return Math.floor(parsed);
        }
        if (typeof value === 'object' && value.value !== undefined) {
          return this.extractNumber(value, 'value');
        }
      }
    }
    return 0;
  }

  extractInt(item: any, ...fieldNames: string[]): number {
    return this.extractNumber(item, ...fieldNames);
  }

  extractFloat(item: any, ...fieldNames: string[]): number {
    for (const field of fieldNames) {
      const value = this.getNestedValue(item, field);
      if (value !== null && value !== undefined) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const cleaned = value.replace(/[^\d.]/g, '');
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) return parsed;
        }
        if (typeof value === 'object' && value.value !== undefined) {
          return this.extractFloat(value, 'value');
        }
      }
    }
    return 0;
  }

  extractBoolean(item: any, ...fieldNames: string[]): boolean {
    for (const field of fieldNames) {
      const value = this.getNestedValue(item, field);
      if (value !== null && value !== undefined) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          if (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'available') return true;
          if (lower === 'false' || lower === 'no' || lower === '0' || lower === 'sold' || lower === 'unavailable') return false;
        }
        if (typeof value === 'number') return value !== 0;
      }
    }
    return true;
  }

  extractOwnership(item: any, ...fieldNames: string[]): string | undefined {
    for (const field of fieldNames) {
      const value = this.getNestedValue(item, field);
      if (value !== null && value !== undefined) {
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
        if (typeof value === 'number') {
          if (value === 0) return 'First';
          if (value === 1) return 'Second';
          if (value === 2) return 'Third';
          return `Owner ${value + 1}`;
        }
      }
    }
    return undefined;
  }

  extractBrand(item: any, modelName?: string, externalUrl?: string, ...fieldNames: string[]): string | undefined {
    const expandedFields = [
      ...fieldNames,
      'title',
      'name',
      'carName',
      'fullName',
      'vehicleName',
      'listingTitle',
      'carTitle',
      'vehicleTitle',
    ];
    const brand = this.extractString(item, ...expandedFields);
    if (brand && brand.toLowerCase() !== 'unknown' && brand.trim() !== '') {
      return brand;
    }
    if (modelName) {
      const inferred = this.inferBrandFromModel(modelName);
      if (inferred) return inferred;
    }
    if (externalUrl) {
      const urlInferred = this.inferBrandFromUrl(externalUrl);
      if (urlInferred) return urlInferred;
    }
    const titleOrName = this.extractString(item, 'title', 'name', 'carName', 'fullName', 'vehicleName', 'listingTitle');
    if (titleOrName) {
      const titleInferred = this.inferBrandFromModel(titleOrName);
      if (titleInferred) return titleInferred;
    }
    return brand || undefined;
  }

  private inferBrandFromModel(modelName: string): string | undefined {
    if (!modelName || typeof modelName !== 'string') return undefined;
    const modelLower = modelName.toLowerCase().trim();
    const brands = this.getBrandList();
    for (const brand of brands) {
      const brandLower = brand.toLowerCase();
      if (modelLower.startsWith(brandLower + ' ') || modelLower === brandLower) {
        return this.capitalizeBrand(brand);
      }
    }
    const words = modelName.split(/\s+/);
    for (const word of words) {
      const wordLower = word.toLowerCase();
      for (const brand of brands) {
        const brandLower = brand.toLowerCase();
        if (wordLower === brandLower || wordLower.startsWith(brandLower) || brandLower.startsWith(wordLower)) {
          return this.capitalizeBrand(brand);
        }
      }
    }
    return undefined;
  }

  private inferBrandFromUrl(url: string): string | undefined {
    if (!url || typeof url !== 'string') return undefined;
    const urlLower = url.toLowerCase();
    const brands = this.getBrandList();
    for (const brand of brands) {
      const brandLower = brand.toLowerCase();
      if (urlLower.includes(`/${brandLower}/`) || urlLower.includes(`/${brandLower}-`) || urlLower.includes(`-${brandLower}-`)) {
        return this.capitalizeBrand(brand);
      }
    }
    return undefined;
  }

  private getBrandList(): string[] {
    return [
      'maruti', 'suzuki', 'hyundai', 'honda', 'tata', 'mahindra', 'toyota', 'ford', 'volkswagen', 'skoda',
      'nissan', 'renault', 'chevrolet', 'fiat', 'datsun', 'isuzu', 'force', 'ashok', 'eicher',
      'bmw', 'mercedes', 'mercedes-benz', 'audi', 'jaguar', 'land rover', 'porsche', 'volvo', 'lexus', 'mini',
      'bentley', 'rolls-royce', 'lamborghini', 'ferrari', 'mclaren', 'aston martin', 'maserati',
      'jeep', 'dodge', 'chrysler', 'cadillac', 'lincoln', 'buick', 'gmc', 'tesla', 'rivian',
      'kia', 'mg', 'citroen', 'peugeot', 'ds', 'opel', 'seat', 'cupra', 'genesis',
      'haval', 'great wall', 'gwm', 'geely', 'byd', 'xuv', 'xuv700', 'xuv300',
      'mitsubishi', 'subaru', 'mazda', 'infiniti', 'acura', 'alfa romeo', 'fiat', 'lancia',
    ];
  }

  private capitalizeBrand(brand: string): string {
    const parts = brand.split(/\s+/);
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }
}
