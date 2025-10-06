import { Timestamp } from '@angular/fire/firestore';

export interface Subcategory {
  id?: string;
  name: string;
  description?: string;
  categoryId: string;
  imageUrl?: string;
  createdAt?: Timestamp;
}
