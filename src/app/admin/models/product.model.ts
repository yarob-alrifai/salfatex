import { Timestamp } from '@angular/fire/firestore';
import { ProductUnitOption, ProductFabric } from 'src/app/models/catalog.models';

export interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  color?: string;
  categoryId: string;
  subcategoryId?: string;
  mainImageUrl?: string;
  colors?: string[];

  galleryUrls?: string[];
  createdAt?: Timestamp;
  sequence?: number;
  unitOptions?: ProductUnitOption[];
  fabrics?: ProductFabric[];
}
