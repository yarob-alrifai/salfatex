import { Timestamp } from '@angular/fire/firestore';

export interface Category {
  id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
  sequence?: number;
}
