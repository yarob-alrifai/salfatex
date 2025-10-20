import { Timestamp } from '@angular/fire/firestore';

export interface CategoryGroup {
  id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
  sequence?: number;
}
