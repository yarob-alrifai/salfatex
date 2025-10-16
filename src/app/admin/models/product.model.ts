import { Timestamp } from '@angular/fire/firestore';
import { ProductUnitOption } from 'src/app/models/catalog.models';

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
}
