import { Product } from './catalog.models';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartSnapshot {
  items: CartItem[];
  total: number;
}

export interface CustomerInfo {
  name: string;
  email: string;
  restaurantName: string;
  phone: string;

  address: string;
  notes?: string;
}
