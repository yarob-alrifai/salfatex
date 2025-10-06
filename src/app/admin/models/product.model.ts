import { Timestamp } from '@angular/fire/firestore';

export interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  color?: string;
  categoryId: string;
  subcategoryId?: string;
  mainImageUrl?: string;
  galleryUrls?: string[];
  createdAt?: Timestamp;
}
